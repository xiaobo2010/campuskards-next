"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, ChevronDown, LogOut, Home, Swords, BookOpen, ShoppingBag, Trophy, History, Camera, Settings2, KeyRound, Map } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

import AvatarUploadDialog from "@/components/game/avatar-upload-dialog";
import ResetPasswordDialog from "@/components/game/reset-password-dialog";
import { UserAvatar } from "@/components/game/user-avatar";

export default function MobileHeader() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [avatarDialog, setAvatarDialog] = useState(false);
  const [resetPasswordDialog, setResetPasswordDialog] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  // Close nav drawer on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false);
      }
    }
    if (navOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [navOpen]);

  const navItems = [
    { href: "/game", icon: Home, label: "主页" },
    { href: "/game/play", icon: Swords, label: "对战" },
    { href: "/game/collection", icon: BookOpen, label: "图鉴" },
    { href: "/game/shop", icon: ShoppingBag, label: "商店" },
    { href: "/game/leaderboard", icon: Trophy, label: "排名" },
    { href: "/game/history", icon: History, label: "战绩" },
    { href: "/game/story", icon: Map, label: "故事" },
    { href: "/game/settings", icon: Settings2, label: "设置" },
    ...(user?.role === "admin"
      ? [{ href: "/game/admin", icon: Settings2, label: "管理游戏" }]
      : []),
  ];
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  return (
    <>
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center h-14 px-4 lg:hidden"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border)",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Hamburger — toggles nav drawer */}
      <button
        onClick={() => setNavOpen(!navOpen)}
        className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors duration-150"
        style={{ color: "var(--text-secondary)" }}
        aria-label="导航菜单"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Title */}
      <h1
        className="flex-1 text-center text-base font-bold select-none"
        style={{ color: "var(--text-primary)" }}
      >
        CampusKards
      </h1>

      {/* User dropdown */}
      {user && (
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1.5 h-9 px-2 rounded-lg transition-colors duration-150"
            style={{ color: "var(--text-secondary)" }}
            aria-label="用户菜单"
          >
            <UserAvatar
              username={user.username}
              avatarUrl={user.avatar_url}
              className="w-7 h-7"
              textClassName="text-xs"
            />
            <span className="text-sm font-medium hidden sm:inline max-w-[80px] truncate">
              {user.username}
            </span>
            <ChevronDown
              className="w-3.5 h-3.5 transition-transform duration-200"
              style={{
                transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 top-full mt-2 w-48 rounded-xl overflow-hidden shadow-xl"
                style={{
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
              >
                {/* User info header */}
                <div
                  className="px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <p
                    className="text-sm font-medium"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {user.username}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    ELO {user.elo} · 🎨 {user.ink}
                  </p>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setAvatarDialog(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150"
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Camera className="w-4 h-4" />
                    修改头像
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setResetPasswordDialog(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150"
                    style={{ color: "var(--text-primary)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <KeyRound className="w-4 h-4" />
                    重置密码
                  </button>
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await logout();
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150"
                    style={{ color: "var(--danger)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "color-mix(in srgb, var(--danger) 10%, transparent)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </header>

      {/* Navigation Drawer (mobile) */}
      <AnimatePresence>
        {navOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 lg:hidden"
              style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
              onClick={() => setNavOpen(false)}
            />
            {/* Drawer */}
            <motion.nav
              ref={navRef}
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-14 bottom-0 z-50 w-64 lg:hidden flex flex-col"
              style={{
                backgroundColor: "var(--bg-secondary)",
                borderRight: "1px solid var(--border)",
                paddingTop: "env(safe-area-inset-top, 0px)",
              }}
            >
              <div className="flex-1 py-4">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/game"
                      ? pathname === "/game"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setNavOpen(false)}
                      className="flex items-center gap-3 px-5 py-3 text-sm font-medium transition-colors duration-150"
                      style={{
                        color: isActive ? "var(--accent)" : "var(--text-secondary)",
                        backgroundColor: isActive
                          ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                          : "transparent",
                      }}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
      <AvatarUploadDialog
        open={avatarDialog}
        onOpenChange={setAvatarDialog}
        currentAvatar={user?.avatar_url}
        username={user?.username}
      />
      <ResetPasswordDialog
        open={resetPasswordDialog}
        onOpenChange={setResetPasswordDialog}
        defaultUsername={user?.username}
      />
    </>
  );
}
