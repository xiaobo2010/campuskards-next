import random
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.rate_limiter import rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models import Card, User, UserCard
from app.schemas.admin import SetCookieRequest
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserOut,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def _get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    # Try Authorization header first, then httpOnly cookie
    auth_header = request.headers.get("authorization", "")
    token = auth_header.removeprefix("Bearer ") if auth_header.startswith("Bearer ") else None
    cookie_token = request.cookies.get("campuskards_token")
    effective_token = token or cookie_token
    if not effective_token:
        raise HTTPException(status_code=401, detail="未提供认证凭据")

    payload = decode_token(effective_token)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="无效的访问令牌")

    user_id = payload.get("sub")
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被封禁")
    token_ver = payload.get("ver", 0)
    if token_ver != user.token_version:
        raise HTTPException(status_code=401, detail="令牌已过期，请重新登录")
    return user


async def _require_admin(user: User = Depends(_get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")
    return user


def _cookie_kwargs(remember: bool = False) -> dict:
    """Cookie options: production uses cross-site Secure cookies; dev uses lax HTTP."""
    is_prod = settings.ENVIRONMENT == "production"
    kwargs: dict = {
        "path": "/",
        "httponly": True,
        "samesite": "none" if is_prod else "lax",
        "secure": is_prod,
    }
    if remember:
        kwargs["max_age"] = 30 * 24 * 3600  # 30 days
    return kwargs


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str, remember: bool = False) -> None:
    """Set httpOnly auth cookies on a response."""
    common_kwargs = _cookie_kwargs(remember)
    response.set_cookie(key="campuskards_token", value=access_token, **common_kwargs)
    response.set_cookie(key="campuskards_refresh_token", value=refresh_token, **common_kwargs)


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("campuskards_token", path="/")
    response.delete_cookie("campuskards_refresh_token", path="/")


# ── 新建卡组构建常量 ──
UNIT_TYPES = frozenset({"character", "unit"})
SPELL_TYPES = frozenset({"command", "event", "buff"})
COUNTER_TYPES = frozenset({"snitch", "counter"})
CLASS_FACTIONS = ["key_class", "arts_class", "normal_class", "intl_class", "competition_class"]
NEWBIE_DECK_SIZE = 30
NEWBIE_MIN_MAIN_FACTION = 20
NEWBIE_MAX_UNITS = 22
NEWBIE_MAX_EFFECTS = 20
NEWBIE_MAX_COUNTERS = 10


async def _grant_newbie_deck(db: AsyncSession, user: User) -> None:
    """为新手赠送 30 张可直接开始对战的卡牌。"""
    from collections import Counter as ColCounter

    result = await db.execute(select(Card).where(Card.is_token == False))
    all_cards: list[Card] = list(result.scalars().all())

    pool = [c for c in all_cards if c.rarity in ("common", "uncommon")]
    if len(pool) < NEWBIE_DECK_SIZE:
        pool = all_cards

    card_map = {c.id: c for c in all_cards}
    main_faction = random.choice(CLASS_FACTIONS)

    def _type_set(card: Card) -> str:
        ct = (card.card_type or "").lower()
        if ct in UNIT_TYPES: return "unit"
        if ct in SPELL_TYPES: return "effect"
        if ct in COUNTER_TYPES: return "counter"
        return "unit"

    main_units = [c for c in pool if c.faction_code == main_faction and _type_set(c) == "unit"]
    main_effects = [c for c in pool if c.faction_code == main_faction and _type_set(c) == "effect"]
    main_counters = [c for c in pool if c.faction_code == main_faction and _type_set(c) == "counter"]
    other_units = [c for c in pool if c.faction_code != main_faction and _type_set(c) == "unit"]
    other_effects = [c for c in pool if c.faction_code != main_faction and _type_set(c) == "effect"]
    other_counters = [c for c in pool if c.faction_code != main_faction and _type_set(c) == "counter"]

    def _pick(src: list[Card], target: int, used: ColCounter) -> list[Card]:
        random.shuffle(src)
        picked: list[Card] = []
        for card in src:
            if len(picked) >= target:
                break
            if used[card.id] >= 3:
                continue
            picked.append(card)
            used[card.id] += 1
        return picked

    used = ColCounter()
    chosen: list[Card] = []

    # Main faction: ~14 units, ~5 effects, ~1 counter
    chosen += _pick(main_units, 14, used)
    chosen += _pick(main_effects, 5, used)
    chosen += _pick(main_counters, 1, used)
    # Other factions: ~4 units, ~4 effects, ~2 counters
    chosen += _pick(other_units, 4, used)
    chosen += _pick(other_effects, 4, used)
    chosen += _pick(other_counters, 2, used)

    # Fill remaining up to 30 with any faction
    remaining = NEWBIE_DECK_SIZE - len(chosen)
    if remaining > 0:
        fill_pool = [c for c in pool if used[c.id] < 3]
        random.shuffle(fill_pool)
        for card in fill_pool:
            if len(chosen) >= NEWBIE_DECK_SIZE:
                break
            unit_cnt = sum(1 for c in chosen if _type_set(c) == "unit")
            eff_cnt = sum(1 for c in chosen if _type_set(c) == "effect")
            cnt_cnt = sum(1 for c in chosen if _type_set(c) == "counter")
            t = _type_set(card)
            if t == "unit" and unit_cnt >= NEWBIE_MAX_UNITS: continue
            if t == "effect" and eff_cnt >= NEWBIE_MAX_EFFECTS: continue
            if t == "counter" and cnt_cnt >= NEWBIE_MAX_COUNTERS: continue
            if used[card.id] >= 3: continue
            chosen.append(card)
            used[card.id] += 1

    for card in chosen:
        existing = await db.execute(
            select(UserCard).where(UserCard.user_id == user.id, UserCard.card_id == card.id)
        )
        uc = existing.scalar_one_or_none()
        if uc:
            uc.count = (uc.count or 0) + 1
        else:
            db.add(UserCard(user_id=user.id, card_id=card.id, count=1, level=1, fragments=0))

    user.newbie_claimed = True


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    _r: None = Depends(rate_limit(3, 3600, "register")),
    db: AsyncSession = Depends(get_db),
) -> Response:
    stmt = select(User).where(or_(User.username == body.username, User.email == body.email))
    result = await db.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="用户名或邮箱已存在")

    user = User(
        username=body.username,
        email=body.email,
        password_hash=hash_password(body.password),
        ink=500,
    )
    db.add(user)
    await db.flush()

    await _grant_newbie_deck(db, user)

    await db.commit()
    await db.refresh(user)

    token_resp = TokenResponse(
        access_token=create_access_token(str(user.id), token_version=user.token_version),
        refresh_token=create_refresh_token(str(user.id), token_version=user.token_version),
    )
    json_resp = JSONResponse(content=token_resp.model_dump(), status_code=status.HTTP_201_CREATED)
    _set_auth_cookies(json_resp, token_resp.access_token, token_resp.refresh_token, remember=body.remember)
    return json_resp


@router.post("/login")
async def login(
    body: LoginRequest,
    _r: None = Depends(rate_limit(5, 60, "login")),
    db: AsyncSession = Depends(get_db),
) -> Response:
    stmt = select(User).where(or_(User.username == body.login, User.email == body.login))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被封禁")

    token_resp = TokenResponse(
        access_token=create_access_token(str(user.id), token_version=user.token_version),
        refresh_token=create_refresh_token(str(user.id), token_version=user.token_version),
    )
    json_resp = JSONResponse(content=token_resp.model_dump())
    _set_auth_cookies(json_resp, token_resp.access_token, token_resp.refresh_token, remember=body.remember)
    return json_resp


@router.post("/refresh")
async def refresh(
    request: Request,
    body: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
) -> Response:
    token = (body.refresh_token if body and body.refresh_token else None) or request.cookies.get(
        "campuskards_refresh_token"
    )
    if not token:
        raise HTTPException(status_code=401, detail="未提供刷新令牌")

    payload = decode_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="无效的刷新令牌")

    user_id = payload.get("sub")
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="用户不存在")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被封禁")
    token_ver = payload.get("ver", 0)
    if token_ver != user.token_version:
        raise HTTPException(status_code=401, detail="刷新令牌已过期，请重新登录")

    token_resp = TokenResponse(
        access_token=create_access_token(str(user.id), token_version=user.token_version),
        refresh_token=create_refresh_token(str(user.id), token_version=user.token_version),
    )
    json_resp = JSONResponse(content=token_resp.model_dump())
    _set_auth_cookies(json_resp, token_resp.access_token, token_resp.refresh_token)
    return json_resp


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(_get_current_user)) -> UserOut:
    return UserOut.model_validate(user)


@router.post("/logout")
async def logout(
    _user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    _user.token_version += 1
    await db.commit()
    response = JSONResponse(content={"message": "已登出"})
    _clear_auth_cookies(response)
    return response


@router.post("/set-cookie")
async def set_cookie(
    body: SetCookieRequest,
    current_user: User = Depends(_get_current_user),
) -> Response:
    access_payload = decode_token(body.access_token)
    if not access_payload or access_payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="无效的访问令牌")

    refresh_payload = decode_token(body.refresh_token)
    if not refresh_payload or refresh_payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="无效的刷新令牌")

    if access_payload.get("sub") != refresh_payload.get("sub"):
        raise HTTPException(status_code=400, detail="访问令牌与刷新令牌用户不一致")

    if str(current_user.id) != access_payload.get("sub"):
        raise HTTPException(status_code=403, detail="令牌不属于当前用户")

    response = JSONResponse({"message": "Cookie set"}, status_code=200)
    common_kwargs = _cookie_kwargs(body.remember)
    response.set_cookie(key="campuskards_token", value=body.access_token, **common_kwargs)
    response.set_cookie(key="campuskards_refresh_token", value=body.refresh_token, **common_kwargs)
    return response


@router.post("/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    _r: None = Depends(rate_limit(3, 600, "reset_password")),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    stmt = select(User).where(User.username == body.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    invalid_msg = "用户名或重置密钥无效"
    if not user:
        raise HTTPException(status_code=400, detail=invalid_msg)
    if not user.is_active:
        raise HTTPException(status_code=403, detail="账号已被封禁")
    if user.reset_key is None or not secrets.compare_digest(user.reset_key, body.reset_key):
        raise HTTPException(status_code=400, detail=invalid_msg)
    user.password_hash = hash_password(body.new_password)
    user.token_version += 1
    user.reset_key = None
    await db.commit()
    return {"message": "密码重置成功"}


@router.patch("/me", response_model=UserOut)
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(_get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    if body.new_password is not None:
        # Must verify current password before allowing change
        if body.current_password is None:
            raise HTTPException(status_code=400, detail="修改密码需要提供当前密码")
        if not verify_password(body.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="当前密码错误")
        user.password_hash = hash_password(body.new_password)
        user.token_version += 1
    if body.email is not None and body.email != user.email:
        stmt = select(User).where(User.email == body.email)
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="邮箱已被使用")
        user.email = body.email
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)
