import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BGMTrack = "lobby" | "battle" | null;

interface AudioState {
  bgmEnabled: boolean;
  bgmVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
  currentTrack: BGMTrack;
  setBgmEnabled: (v: boolean) => void;
  setBgmVolume: (v: number) => void;
  setSfxEnabled: (v: boolean) => void;
  setSfxVolume: (v: number) => void;
  setCurrentTrack: (t: BGMTrack) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      bgmEnabled: true,
      bgmVolume: 0.5,
      sfxEnabled: true,
      sfxVolume: 0.7,
      currentTrack: null,
      setBgmEnabled: (v) => set({ bgmEnabled: v }),
      setBgmVolume: (v) => set({ bgmVolume: v }),
      setSfxEnabled: (v) => set({ sfxEnabled: v }),
      setSfxVolume: (v) => set({ sfxVolume: v }),
      setCurrentTrack: (t) => set({ currentTrack: t }),
    }),
    { name: "campuskards_audio" },
  ),
);
