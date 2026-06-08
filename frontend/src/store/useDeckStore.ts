import { create } from "zustand";
import type { Card } from "@/types";

/**
 * Deck builder state store - for deck construction workflow
 */
interface DeckState {
  selectedCards: Card[];
  addCard: (card: Card) => void;
  removeCard: (cardId: string) => void;
  clearSelected: () => void;
  isCardSelected: (cardId: string) => boolean;
}

export const useDeckStore = create<DeckState>((set, get) => ({
  selectedCards: [],
  addCard: (card) =>
    set((s) => ({
      selectedCards: s.selectedCards.some((c) => c.id === card.id)
        ? s.selectedCards
        : [...s.selectedCards, card],
    })),
  removeCard: (cardId) =>
    set((s) => ({
      selectedCards: s.selectedCards.filter((c) => c.id !== cardId),
    })),
  clearSelected: () => set({ selectedCards: [] }),
  isCardSelected: (cardId) => get().selectedCards.some((c) => c.id === cardId),
}));
