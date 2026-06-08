import { create } from 'zustand'
import { cardsApi } from '@/lib/api'
import type { Card, UserCardOwnership } from '@/types'

interface CollectionState {
  cards: Card[]
  ownedCardIds: Set<string>
  ownedCards: UserCardOwnership[]
  loading: boolean
  error: string | null
  factionFilter: string

  // Actions
  setFactionFilter: (faction: string) => void
  fetchCards: () => Promise<void>
  fetchOwnedCards: () => Promise<void>
  fetchAll: () => Promise<void>
  getFilteredCards: () => Card[]
}

export const useCollectionStore = create<CollectionState>((set, get) => ({
  cards: [],
  ownedCardIds: new Set(),
  ownedCards: [],
  loading: false,
  error: null,
  factionFilter: 'ALL',

  setFactionFilter: (faction) => set({ factionFilter: faction }),

  fetchCards: async () => {
    try {
      const res = await cardsApi.list()
      const items = Array.isArray(res) ? res : 'items' in res ? res.items : []
      set({ cards: items })
    } catch (e) {
      set({ error: '加载卡牌列表失败' })
      set({ cards: [] })
    }
  },

  fetchOwnedCards: async () => {
    set({ loading: true, error: null })
    try {
      const items = await cardsApi.owned()
      const ids = new Set<string>(items.map((item: UserCardOwnership) => item.card_id))
      set({ ownedCards: items, ownedCardIds: ids })
    } catch (e) {
      set({ error: '加载收藏数据失败' })
      set({ ownedCardIds: new Set(), ownedCards: [] })
    } finally {
      set({ loading: false })
    }
  },

  fetchAll: async () => {
    set({ loading: true, error: null })
    try {
      await Promise.all([get().fetchCards(), get().fetchOwnedCards()])
    } finally {
      set({ loading: false })
    }
  },

  getFilteredCards: () => {
    const { cards, factionFilter } = get()
    if (factionFilter === 'ALL') return cards
    return cards.filter((c) => c.faction_code === factionFilter)
  },
}))
