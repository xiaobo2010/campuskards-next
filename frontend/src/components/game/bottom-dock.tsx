"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Home,
  BookOpen,
  Briefcase,
  Swords,
  Shield,
  History,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  isCenter?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/game", label: "大厅", icon: Home },
  { href: "/game/collection", label: "图鉴", icon: BookOpen },
  { href: "/game/deck-builder", label: "书包", icon: Briefcase },
  { href: "/game/history", label: "战绩", icon: History },
  { href: "/game/play", label: "对战", icon: Swords, isCenter: true },
  { href: "/game/admin", label: "管理", icon: Shield, adminOnly: true },
];

export default function BottomDock() {
  const pathname = usePathname();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.adminOnly || isAdmin
  );

  // Find the center item index (对战)
  const centerIndex = visibleItems.findIndex((item) => item.isCenter);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 md:h-16 h-14"
      style={{
        backgroundColor: "var(--bg-secondary)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <nav className="h-full flex items-center justify-around px-2 max-w-lg mx-auto">
        {visibleItems.map((item, index) => {
          const isActive =
            item.href === "/game"
              ? pathname === "/game"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          const isCenter = item.isCenter;

          // Mobile: center item gets special treatment
          if (isCenter) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-end"
                style={{ marginTop: "-20px" }}
              >
                <motion.div
                  className="flex items-center justify-center rounded-full shadow-lg"
                  style={{
                    width: 56,
                    height: 56,
                    backgroundColor: isActive
                      ? "var(--accent)"
                      : "var(--accent)",
                    opacity: isActive ? 1 : 0.85,
                    color: "white",
                    boxShadow: `0 4px 14px color-mix(in srgb, var(--accent) 40%, transparent)`,
                  }}
                  whileTap={{ scale: 0.92 }}
                  transition={{ type: "spring", stiffness: 400, damping: 17 }}
                >
                  <Icon className="w-6 h-6" />
                </motion.div>
                {/* Label: show on tablet, hide on phone */}
                <span
                  className="mt-1 text-[10px] font-medium hidden md:block"
                  style={{
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  }}
                >
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex flex-col items-center justify-center"
            >
              <motion.div
                className="flex items-center justify-center"
                whileTap={{ scale: 0.9 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                style={{
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                <Icon className="w-5 h-5" />
              </motion.div>
              {/* Label: show on tablet, hide on phone */}
              <span
                className="mt-1 text-[10px] font-medium hidden md:block"
                style={{
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {item.label}
              </span>
              {/* Active dot indicator on mobile */}
              {isActive && (
                <motion.div
                  layoutId="dock-accent"
                  className="absolute -bottom-1 w-1 h-1 rounded-full md:hidden"
                  style={{ backgroundColor: "var(--accent)" }}
                  transition={{
                    type: "spring",
                    stiffness: 350,
                    damping: 30,
                  }}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
