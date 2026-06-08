import { create } from 'zustand'
import type { Deck, DeckListItem, DeckCardEntry } from '@/types'

interface MatchEvent {
  type: string
  data: unknown
  timestamp: number
}

interface MatchState {
  // Matchmaking
  isSearching: boolean
  matchmakingQueueTime: number

  // Current game
  currentGameId: string | null
  opponentName: string | null
  opponentElo: number | null
  myHp: number
  opponentHp: number
  myMana: number
  maxMana: number
  turn: number

  // Game events
  gameEvents: MatchEvent[]

  // Actions
  startSearching: () => void
  stopSearching: () => void
  setCurrentGame: (gameId: string | null, opponent?: { name: string; elo: number }) => void
  updateGameState: (state: Partial<Pick<MatchState, 'myHp' | 'opponentHp' | 'myMana' | 'maxMana' | 'turn'>>) => void
  addGameEvent: (event: MatchEvent) => void
  clearGameEvents: () => void
  resetMatch: () => void
}

export const useMatchStore = create<MatchState>((set, get) => ({
  isSearching: false,
  matchmakingQueueTime: 0,

  currentGameId: null,
  opponentName: null,
  opponentElo: null,
  myHp: 30,
  opponentHp: 30,
  myMana: 1,
  maxMana: 1,
  turn: 1,

  gameEvents: [],

  startSearching: () => set({ isSearching: true, matchmakingQueueTime: 0 }),
  stopSearching: () => set({ isSearching: false, matchmakingQueueTime: 0 }),

  setCurrentGame: (gameId, opponent) =>
    set({
      currentGameId: gameId,
      opponentName: opponent?.name ?? null,
      opponentElo: opponent?.elo ?? null,
      myHp: 30,
      opponentHp: 30,
      myMana: 1,
      maxMana: 1,
      turn: 1,
      gameEvents: [],
    }),

  updateGameState: (state) => set(state),

  addGameEvent: (event) =>
    set((s) => ({ gameEvents: [...s.gameEvents, event] })),

  clearGameEvents: () => set({ gameEvents: [] }),

  resetMatch: () =>
    set({
      isSearching: false,
      matchmakingQueueTime: 0,
      currentGameId: null,
      opponentName: null,
      opponentElo: null,
      myHp: 30,
      opponentHp: 30,
      myMana: 1,
      maxMana: 1,
      turn: 1,
      gameEvents: [],
    }),
}))
