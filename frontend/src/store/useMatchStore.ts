import { create } from "zustand";
import type { GameStatePayload, OpponentInfo } from "@/types";
import type { WsConnectionStatus } from "@/lib/game-ws";

interface MatchState {
  isSearching: boolean;
  matchmakingQueueTime: number;

  currentGameId: string | null;
  opponent: OpponentInfo | null;

  gameState: GameStatePayload | null;
  connectionStatus: WsConnectionStatus;
  lastError: string | null;

  deployLine: "front" | "support";
  selectedAttackerUid: string | null;

  startSearching: () => void;
  stopSearching: () => void;
  setCurrentGame: (gameId: string | null, opponent?: OpponentInfo | null) => void;
  setGameState: (state: GameStatePayload | null) => void;
  setConnectionStatus: (status: WsConnectionStatus) => void;
  setLastError: (msg: string | null) => void;
  setDeployLine: (line: "front" | "support") => void;
  setSelectedAttackerUid: (uid: string | null) => void;
  resetMatch: () => void;
}

const initialState = {
  isSearching: false,
  matchmakingQueueTime: 0,
  currentGameId: null,
  opponent: null,
  gameState: null,
  connectionStatus: "idle" as WsConnectionStatus,
  lastError: null,
  deployLine: "front" as const,
  selectedAttackerUid: null,
};

export const useMatchStore = create<MatchState>((set) => ({
  ...initialState,

  startSearching: () => set({ isSearching: true, matchmakingQueueTime: 0 }),
  stopSearching: () => set({ isSearching: false, matchmakingQueueTime: 0 }),

  setCurrentGame: (gameId, opponent = null) =>
    set({
      currentGameId: gameId,
      opponent,
      gameState: null,
      connectionStatus: "idle",
      lastError: null,
      selectedAttackerUid: null,
    }),

  setGameState: (state) => set({ gameState: state }),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setLastError: (msg) => set({ lastError: msg }),
  setDeployLine: (line) => set({ deployLine: line }),
  setSelectedAttackerUid: (uid) => set({ selectedAttackerUid: uid }),

  resetMatch: () => set({ ...initialState }),
}));
