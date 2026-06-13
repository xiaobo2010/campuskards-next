import { create } from "zustand";
import type { GameStatePayload, OpponentInfo } from "@/types";
import type { WsConnectionStatus } from "@/lib/game-ws";

interface MatchState {
  currentGameId: string | null;
  opponent: OpponentInfo | null;

  gameState: GameStatePayload | null;
  connectionStatus: WsConnectionStatus;
  lastError: string | null;

  selectedAttackerUid: string | null;

  setCurrentGame: (gameId: string | null, opponent?: OpponentInfo | null) => void;
  setGameState: (state: GameStatePayload | null) => void;
  setConnectionStatus: (status: WsConnectionStatus) => void;
  setLastError: (msg: string | null) => void;
  setSelectedAttackerUid: (uid: string | null) => void;
  resetMatch: () => void;
}

const initialState = {
  currentGameId: null,
  opponent: null,
  gameState: null,
  connectionStatus: "idle" as WsConnectionStatus,
  lastError: null,
  selectedAttackerUid: null,
};

export const useMatchStore = create<MatchState>((set) => ({
  ...initialState,

  setCurrentGame: (gameId, opponent = null) =>
    set((state) => {
      const nextOpponent = opponent ?? null;
      if (state.currentGameId === gameId && state.opponent === nextOpponent) {
        return state;
      }
      return {
        currentGameId: gameId,
        opponent: nextOpponent,
        gameState: null,
        connectionStatus: "idle" as WsConnectionStatus,
        lastError: null,
        selectedAttackerUid: null,
      };
    }),

  setGameState: (state) =>
    set({
      gameState: state,
      lastError: null,
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setLastError: (msg) => set({ lastError: msg }),

  setSelectedAttackerUid: (uid) => set({ selectedAttackerUid: uid }),

  resetMatch: () => set({ ...initialState }),
}));
