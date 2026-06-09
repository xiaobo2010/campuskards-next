"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Howl } from "howler";
import { useAudioStore, type BGMTrack } from "@/store/useAudioStore";
import { useBgm } from "@/hooks/use-bgm";

function FirstClickOverlay() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const unlocked = localStorage.getItem("campuskards_audio_unlocked");
    if (unlocked === "1") {
      setVisible(false);
      return;
    }
    const handler = () => {
      Howler.ctx?.resume();
      localStorage.setItem("campuskards_audio_unlocked", "1");
      setVisible(false);
    };
    document.addEventListener("click", handler, { once: true });
    return () => document.removeEventListener("click", handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="text-center space-y-4 px-6">
        <div className="text-5xl">🎵</div>
        <p className="text-xl font-semibold text-white">点击任意位置开启音效</p>
        <p className="text-sm text-zinc-400">享受完整的游戏体验</p>
      </div>
    </div>
  );
}

export default function BgmPlayer() {
  const pathname = usePathname();
  const { setCurrentTrack } = useBgm();
  const lastTrackRef = useRef<BGMTrack>(null);
  const bgmEnabled = useAudioStore((s) => s.bgmEnabled);

  useEffect(() => {
    let track: BGMTrack = null;
    if (!bgmEnabled) {
      track = null;
    } else if (pathname === "/game/play") {
      track = "battle";
    } else if (pathname?.startsWith("/game") || pathname?.startsWith("/auth")) {
      track = "lobby";
    } else {
      track = null;
    }

    if (track !== lastTrackRef.current) {
      lastTrackRef.current = track;
      setCurrentTrack(track);
    }
  }, [pathname, bgmEnabled, setCurrentTrack]);

  return <FirstClickOverlay />;
}
