"use client";

import Sidebar from "@/components/game/sidebar";
import MobileHeader from "@/components/game/mobile-header";
import AuthGuard from "@/components/game/auth-guard";
import { useCachedBackground } from "@/hooks/use-cached-background";
import { useUIStore, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from "@/store/useUIStore";
import { useEffect, useState } from "react";

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const dynamicBg = useCachedBackground();
  const bgUrl = dynamicBg || "/images/lobby-bg.png";
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 1024);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const mainMarginLeft = isDesktop ? sidebarWidth : 0;

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
        <Sidebar />
        <MobileHeader />

        <div
          className="flex-1 transition-[margin-left] duration-200 ease-in-out"
          style={{ marginLeft: mainMarginLeft }}
        >
          <main className="pt-14 lg:pt-0 min-h-screen">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
