"use client";

import { useEffect, useRef } from "react";
import { Howl } from "howler";
import { useAudioStore, type BGMTrack } from "@/store/useAudioStore";

const TRACK_MAP: Record<NonNullable<BGMTrack>, string> = {
  lobby: "/audio/lobby-bgm.mp3",
  battle: "/audio/battle-bgm.mp3",
};

export function useBgm() {
  const howlRef = useRef<Howl | null>(null);
  const {
    currentTrack,
    bgmEnabled,
    bgmVolume,
    setCurrentTrack,
  } = useAudioStore();

  const playingRef = useRef<BGMTrack>(null);

  useEffect(() => {
    if (!currentTrack || !bgmEnabled) {
      if (howlRef.current) {
        howlRef.current.fade(howlRef.current.volume(), 0, 800);
        const h = howlRef.current;
        setTimeout(() => h.unload(), 800);
        howlRef.current = null;
      }
      playingRef.current = null;
      return;
    }

    if (playingRef.current === currentTrack && howlRef.current) {
      return;
    }

    if (howlRef.current) {
      howlRef.current.fade(howlRef.current.volume(), 0, 500);
      const h = howlRef.current;
      setTimeout(() => h.unload(), 500);
      howlRef.current = null;
    }

    const src = TRACK_MAP[currentTrack];
    const vol = bgmVolume;

    const howl = new Howl({
      src: [src],
      loop: true,
      volume: 0,
      html5: true,
      onload: () => {
        howl.fade(0, vol, 1000);
      },
    });

    howlRef.current = howl;
    howl.play();
    playingRef.current = currentTrack;
  }, [currentTrack, bgmEnabled]);

  useEffect(() => {
    if (howlRef.current) {
      howlRef.current.volume(bgmVolume);
    }
  }, [bgmVolume]);

  useEffect(() => {
    return () => {
      if (howlRef.current) {
        howlRef.current.unload();
        howlRef.current = null;
      }
    };
  }, []);

  return { setCurrentTrack, currentTrack };
}
