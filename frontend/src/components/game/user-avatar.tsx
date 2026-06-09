"use client";

import { resolveAvatarUrl } from "@/lib/avatar-url";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  username: string;
  avatarUrl?: string | null;
  className?: string;
  textClassName?: string;
}

export function UserAvatar({
  username,
  avatarUrl,
  className,
  textClassName,
}: UserAvatarProps) {
  const resolved = resolveAvatarUrl(avatarUrl);
  const initial = username.charAt(0).toUpperCase();

  if (resolved) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={resolved}
        src={resolved}
        alt={`${username} 头像`}
        className={cn("rounded-full object-cover shrink-0", className)}
        onError={(e) => {
          // Fallback: retry with explicit API origin if same-origin path failed
          const img = e.currentTarget;
          if (img.dataset.retried === "1") return;
          img.dataset.retried = "1";
          const path = avatarUrl?.split("?")[0];
          const apiBase = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");
          if (apiBase && path?.startsWith("/")) {
            img.src = `${apiBase}${path}?v=${Date.now()}`;
          }
        }}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full shrink-0 flex items-center justify-center font-bold text-white",
        className,
      )}
      style={{ backgroundColor: "var(--accent)" }}
    >
      <span className={textClassName}>{initial}</span>
    </div>
  );
}
