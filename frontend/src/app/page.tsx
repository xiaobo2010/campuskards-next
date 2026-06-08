"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace("/game");
      } else {
        router.replace("/auth/login");
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-zinc-100">CampusKards</h1>
        <p className="text-zinc-400">校园卡牌对战</p>
        <p className="text-zinc-500 text-sm">加载中...</p>
      </div>
    </div>
  );
}
