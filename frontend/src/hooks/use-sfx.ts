"use client";

import { useRef, useCallback } from "react";
import { Howl } from "howler";
import { useAudioStore } from "@/store/useAudioStore";

export type SfxType = "cardPlay" | "attack" | "uiClick" | "victory" | "defeat";

const SFX_MAP: Record<SfxType, string> = {
  cardPlay: "/audio/cardPlay.ogg",
  attack: "/audio/attack.ogg",
  uiClick: "/audio/uiClick.ogg",
  victory: "/audio/victory.ogg",
  defeat: "/audio/defeat.ogg",
};

const CACHE = new Map<string, Howl>();

function getHowl(src: string, volume: number): Howl {
  let h = CACHE.get(src);
  if (!h) {
    h = new Howl({ src: [src], volume, html5: false });
    CACHE.set(src, h);
  } else {
    h.volume(volume);
  }
  return h;
}

export function useSfx() {
  const sfxEnabled = useAudioStore((s) => s.sfxEnabled);
  const sfxVolume = useAudioStore((s) => s.sfxVolume);

  const play = useCallback(
    (type: SfxType) => {
      if (!sfxEnabled) return;
      const src = SFX_MAP[type];
      const h = getHowl(src, sfxVolume);
      h.play();
    },
    [sfxEnabled, sfxVolume],
  );

  return { playSfx: play };
}
