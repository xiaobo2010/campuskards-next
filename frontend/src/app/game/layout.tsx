"use client";

import Sidebar from "@/components/game/sidebar";
import MobileHeader from "@/components/game/mobile-header";
import AuthGuard from "@/components/game/auth-guard";
import { useCachedBackground } from "@/hooks/use-cached-background";

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dynamicBg = useCachedBackground();
  const bgUrl = dynamicBg || "/images/lobby-bg.png";

  return (
    <AuthGuard>
      {/* Fixed full-viewport background layer */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Dark overlay for readability */}
      <div className="fixed inset-0 backdrop-blur-sm bg-black/60 -z-10" />

      <div className="min-h-screen">
        {/* Sidebar — single navigation element */}
        <Sidebar />

        {/* Mobile Header (visible on small screens) */}
        <MobileHeader />

        {/* Main Content Area — sidebar auto-adjusts width */}
        <div className="flex-1 lg:ml-64">
          <main className="pt-14 lg:pt-0 min-h-screen">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
