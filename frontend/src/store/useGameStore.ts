import { create } from "zustand";

/**
 * Game state store - auth token and game-related state
 */
interface GameState {
  token: string | null;
  setToken: (t: string | null) => void;
}

export const useGameStore = create<GameState>((set) => ({
  token:
    typeof window !== "undefined" ? localStorage.getItem("ck_token") : null,
  setToken: (t) => {
    if (t) localStorage.setItem("ck_token", t);
    else localStorage.removeItem("ck_token");
    set({ token: t });
  },
}));
