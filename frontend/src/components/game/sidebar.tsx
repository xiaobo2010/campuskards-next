"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  BookOpen,
  Briefcase,
  Swords,
  Settings2,
  Store,
  Trophy,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Key,
  Mail,
  Camera,
  KeyRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import AvatarUploadDialog from "@/components/game/avatar-upload-dialog";
import ResetPasswordDialog from "@/components/game/reset-password-dialog";
import { UserAvatar } from "@/components/game/user-avatar";
import { useUIStore, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from "@/store/useUIStore";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

const PLAYER_NAV_ITEMS: NavItem[] = [
  { href: "/game", label: "大厅", icon: Home },
  { href: "/game/shop", label: "商店", icon: Store },
  { href: "/game/collection", label: "卡牌图鉴", icon: BookOpen },
  { href: "/game/decks", label: "我的卡组", icon: Briefcase },
  { href: "/game/leaderboard", label: "天梯排行", icon: Trophy },
  { href: "/game/history", label: "对战历史", icon: History },
  { href: "/game/matchmaking", label: "开始对战", icon: Swords },
  { href: "/game/settings", label: "设置", icon: Settings2 },
];

const ADMIN_NAV_ITEM: NavItem = {
  href: "/game/admin",
  label: "管理游戏",
  icon: Settings2,
  adminOnly: true,
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const collapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebarCollapsed = useUIStore((s) => s.toggleSidebarCollapsed);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 1024);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [menuOpen, setMenuOpen] = useState(false);
  const [avatarDialog, setAvatarDialog] = useState(false);
  const [emailDialog, setEmailDialog] = useState(false);
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = user?.role === "admin";
  const visiblePlayerItems = PLAYER_NAV_ITEMS;

  async function handleUpdateEmail() {
    if (!newEmail) {
      toast.error("请输入新邮箱");
      return;
    }
    setSubmitting(true);
    try {
      await api.patch("/api/auth/me", { email: newEmail });
      toast.success("邮箱修改成功");
      setEmailDialog(false);
      setNewEmail("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "修改失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdatePassword() {
    if (!curPwd || !newPwd) {
      toast.error("请填写所有字段");
      return;
    }
    setSubmitting(true);
    try {
      // 后端 UpdateProfileRequest 字段名是 current_password + new_password
      await api.patch("/api/auth/me", {
        current_password: curPwd,
        new_password: newPwd,
      });
      toast.success("密码修改成功，请重新登录");
      setPasswordDialog(false);
      setCurPwd("");
      setNewPwd("");
      logout();
      router.push("/auth/login");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "修改失败");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    logout();
    router.push("/auth/login");
  }

  // Hidden on mobile — MobileHeader handles nav
  if (isMobile) return null;

  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <>
      <motion.aside
        className="fixed left-0 top-0 h-screen z-40 lg:flex flex-col hidden"
        style={{
          width: sidebarWidth,
          backgroundColor: "var(--bg-secondary)",
          borderRight: "1px solid var(--border)",
        }}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        {/* Logo */}
        <div
          className="flex items-center h-16 px-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-lg"
            style={{ backgroundColor: "var(--accent)" }}
          >
            🏫
          </div>
          <AnimatePresence initial={false}>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="ml-3 font-bold text-lg whitespace-nowrap overflow-hidden"
                style={{ color: "var(--text-primary)" }}
              >
                CampusKards
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2 overflow-y-auto">
          {visiblePlayerItems.map((item) => {
            const isActive =
              item.href === "/game"
                ? pathname === "/game"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className="flex items-center rounded-lg transition-colors duration-150 cursor-pointer"
                  style={{
                    padding: collapsed ? "8px 0" : "8px 12px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    backgroundColor: isActive
                      ? "color-mix(in srgb, var(--accent) 15%, transparent)"
                      : "transparent",
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.backgroundColor =
                        "color-mix(in srgb, var(--text-secondary) 8%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Link>
            );
          })}

          {isAdmin && (
            <>
              {!collapsed && (
                <div
                  className="mx-2 my-2 border-t"
                  style={{ borderColor: "var(--border)" }}
                />
              )}
              <Link href={ADMIN_NAV_ITEM.href}>
                <div
                  className="flex items-center rounded-lg transition-colors duration-150 cursor-pointer"
                  style={{
                    padding: collapsed ? "8px 0" : "8px 12px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    backgroundColor: pathname.startsWith(ADMIN_NAV_ITEM.href)
                      ? "color-mix(in srgb, var(--warning) 15%, transparent)"
                      : "transparent",
                    color: pathname.startsWith(ADMIN_NAV_ITEM.href)
                      ? "var(--warning)"
                      : "var(--text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    if (!pathname.startsWith(ADMIN_NAV_ITEM.href))
                      e.currentTarget.style.backgroundColor =
                        "color-mix(in srgb, var(--text-secondary) 8%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    if (!pathname.startsWith(ADMIN_NAV_ITEM.href))
                      e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <Settings2 className="w-5 h-5 shrink-0" />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="ml-3 text-sm font-medium whitespace-nowrap overflow-hidden"
                      >
                        {ADMIN_NAV_ITEM.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </Link>
            </>
          )}
        </nav>

        {/* User menu */}
        {user && (
          <div
            className="px-2 pb-2 shrink-0"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center rounded-lg overflow-hidden cursor-pointer hover:bg-zinc-800/50 transition-colors w-full"
                  style={{
                    padding: collapsed ? "8px 0" : "8px 12px",
                    justifyContent: collapsed ? "center" : "flex-start",
                    background: "none",
                    border: "none",
                  }}
                >
                  <UserAvatar
                    username={user.username}
                    avatarUrl={user.avatar_url}
                    className="w-8 h-8"
                    textClassName="text-xs"
                  />
                  <AnimatePresence initial={false}>
                    {!collapsed && (
                      <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="ml-3 overflow-hidden whitespace-nowrap text-left"
                      >
                        <p
                          className="text-sm font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {user.username}
                          {isAdmin && (
                            <span
                              className="ml-1 inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded"
                              style={{
                                backgroundColor:
                                  "color-mix(in srgb, var(--warning) 20%, transparent)",
                                color: "var(--warning)",
                              }}
                            >
                              管理员
                            </span>
                          )}
                        </p>
                        <p
                          className="text-xs truncate"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          ELO {user.elo ?? 0} · 💧{user.ink ?? 0}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="right"
                align="end"
                className="bg-zinc-900 border-zinc-800 w-48"
              >
                <div className="px-2 py-1.5 text-xs text-zinc-400">
                  {user.username} · ELO {user.elo ?? 0}
                </div>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    setAvatarDialog(true);
                  }}
                >
                  <Camera className="w-4 h-4 mr-2" /> 修改头像
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    setEmailDialog(true);
                    setNewEmail(user.email || "");
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" /> 修改邮箱
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    setPasswordDialog(true);
                    setCurPwd("");
                    setNewPwd("");
                  }}
                >
                  <Key className="w-4 h-4 mr-2" /> 修改密码
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-zinc-200 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                  onClick={() => {
                    setMenuOpen(false);
                    setResetPasswordDialog(true);
                  }}
                >
                  <KeyRound className="w-4 h-4 mr-2" /> 重置密码
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  className="text-red-400 focus:bg-zinc-800 focus:text-red-300 cursor-pointer"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4 mr-2" /> 退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Collapse toggle */}
        <div className="px-2 pb-2 shrink-0">
          <button
            onClick={toggleSidebarCollapsed}
            className="w-full flex items-center justify-center rounded-lg h-9 transition-colors duration-150"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--text-secondary) 8%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </motion.aside>

      {/* Email Dialog */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">修改邮箱</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-zinc-300">新邮箱</Label>
              <Input
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
                type="email"
              />
            </div>
            <Button
              onClick={handleUpdateEmail}
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {submitting ? "修改中..." : "确认修改"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialog} onOpenChange={setPasswordDialog}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">修改密码</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label className="text-zinc-300">当前密码</Label>
              <Input
                type="password"
                value={curPwd}
                onChange={(e) => setCurPwd(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-300">新密码</Label>
              <Input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="bg-zinc-800/50 border-zinc-700 text-zinc-100"
              />
            </div>
            <Button
              onClick={handleUpdatePassword}
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {submitting ? "修改中..." : "确认修改"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ResetPasswordDialog
        open={resetPasswordDialog}
        onOpenChange={setResetPasswordDialog}
        defaultUsername={user?.username}
      />

      {/* Avatar upload dialog */}
      <AvatarUploadDialog
        open={avatarDialog}
        onOpenChange={setAvatarDialog}
        currentAvatar={user?.avatar_url}
        username={user?.username}
      />
    </>
  );
}
