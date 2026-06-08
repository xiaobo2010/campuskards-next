"use client";

import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-zinc-400">验证权限中...</p>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-5xl">🔒</div>
        <h2 className="text-xl font-bold text-zinc-200">无权访问</h2>
        <p className="text-zinc-400 text-sm">仅管理员可以访问此页面</p>
        <Button
          variant="outline"
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          onClick={() => (window.location.href = "/game")}
        >
          返回大厅
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
