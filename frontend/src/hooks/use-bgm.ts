"use client";

import { useEffect, useRef } from "react";
import { Howl, Howler } from "howler";
import { useAudioStore, type BGMTrack } from "@/store/useAudioStore";

const TRACK_MAP: Record<NonNullable<BGMTrack>, string> = {
  lobby: "/audio/lobby-bgm.mp3",
  battle: "/audio/battle-bgm.mp3",
};

export const AUDIO_UNLOCK_EVENT = "campuskards-audio-unlock";

export function useBgm() {
  const howlRef = useRef<Howl | null>(null);
  const {
    currentTrack,
    bgmEnabled,
    bgmVolume,
    setCurrentTrack,
  } = useAudioStore();

  const playingRef = useRef<BGMTrack>(null);

  const startPlayback = (howl: Howl, vol: number) => {
    const id = howl.play();
    if (id !== undefined) {
      howl.volume(vol, id);
    }
  };

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
      volume: vol,
      html5: true,
      onload: () => {
        startPlayback(howl, vol);
      },
      onloaderror: (_id, err) => {
        console.warn("[BGM] failed to load", src, err);
      },
      onplayerror: () => {
        // Autoplay blocked — will retry after user gesture unlock
        howl.once("unlock", () => startPlayback(howl, vol));
      },
    });

    howlRef.current = howl;
    startPlayback(howl, vol);
    playingRef.current = currentTrack;
    // bgmVolume changes handled by dedicated effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack, bgmEnabled]);

  useEffect(() => {
    const onUnlock = () => {
      Howler.ctx?.resume();
      if (howlRef.current && currentTrack && bgmEnabled) {
        if (!howlRef.current.playing()) {
          startPlayback(howlRef.current, bgmVolume);
        }
      }
    };
    window.addEventListener(AUDIO_UNLOCK_EVENT, onUnlock);
    return () => window.removeEventListener(AUDIO_UNLOCK_EVENT, onUnlock);
  }, [currentTrack, bgmEnabled, bgmVolume]);

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
