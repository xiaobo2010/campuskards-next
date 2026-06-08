"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { DEMO_MODE_ENABLED } from "@/lib/api";

/** Routes accessible without login when demo mode is on (UI review only). */
const DEMO_PUBLIC_ROUTES = ["/game/verify"];

/**
 * AuthGuard — client-side session gate.
 * Middleware cannot read localStorage; this component redirects unauthenticated users.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isDemoPublicRoute =
    DEMO_MODE_ENABLED && DEMO_PUBLIC_ROUTES.some((r) => pathname?.startsWith(r));

  useEffect(() => {
    if (!loading && !user && !isDemoPublicRoute) {
      router.replace("/auth/login");
    }
  }, [loading, user, router, isDemoPublicRoute]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !isDemoPublicRoute) {
    return null;
  }

  return <>{children}</>;
}
