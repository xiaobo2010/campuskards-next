"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Layers, Megaphone, ArrowLeft } from "lucide-react";
import { AdminGuard } from "@/components/admin/admin-guard";

const ADMIN_NAV: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
}[] = [
  { href: "/game/admin", label: "概览", icon: LayoutDashboard, exact: true },
  { href: "/game/admin/users", label: "用户管理", icon: Users },
  { href: "/game/admin/cards", label: "卡牌管理", icon: Layers },
  { href: "/game/admin/announcements", label: "公告管理", icon: Megaphone },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AdminGuard>
      <div className="min-h-screen bg-zinc-950">
        <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <Link
                  href="/game"
                  className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 mb-1 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  返回游戏大厅
                </Link>
                <h1 className="text-xl font-bold text-zinc-100">管理游戏</h1>
                <p className="text-sm text-zinc-400 mt-0.5">CampusKards 后台管理</p>
              </div>
            </div>

            <nav className="flex gap-1 mt-4 overflow-x-auto pb-1 -mx-1 px-1">
              {ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                      isActive
                        ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/30"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">{children}</div>
      </div>
    </AdminGuard>
  );
}
