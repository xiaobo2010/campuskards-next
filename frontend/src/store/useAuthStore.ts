import { create } from 'zustand'
import { authApi, setTokens, clearTokens } from '@/lib/api'
import type { User, TokenResponse } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  isAdmin: boolean
  userInk: number | null
  // Actions
  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  login: (tokens: TokenResponse, remember?: boolean) => Promise<void>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
  setUserInk: (ink: number | null) => void
  setUserAvatarUrl: (url: string | null) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: true,
  isAdmin: false,
  userInk: null,

  setUser: (user) => set({ user, isAdmin: user?.role === 'admin', userInk: user?.ink ?? null }),
  setToken: (token) => set({ token }),
  setLoading: (loading) => set({ loading }),

  login: async (tokens, remember = false) => {
    setTokens(tokens.access_token, tokens.refresh_token)
    await authApi.setCookie({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      remember: remember ?? false,
    })
    const user = await authApi.me()
    set({
      user,
      token: tokens.access_token,
      loading: false,
      isAdmin: user.role === 'admin',
      userInk: user.ink ?? null,
    })
  },

  logout: async () => {
    try {
      await authApi.logout()
    } catch {
      // ignore
    }
    clearTokens()
    if (typeof document !== 'undefined') {
      document.cookie = 'campuskards_token=; path=/; max-age=0'
      document.cookie = 'campuskards_refresh_token=; path=/; max-age=0'
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('ck_saved_login')
    }
    set({ user: null, token: null, loading: false, isAdmin: false, userInk: null })
  },

  checkSession: async () => {
    try {
      const token = localStorage.getItem('access_token')
      if (!token) {
        set({ user: null, loading: false })
        return
      }
      // Basic JWT sanity check
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(atob(parts[1]))
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            clearTokens()
            set({ user: null, loading: false })
            return
          }
        } catch { /* ignore */ }
      }
      const u = await authApi.me()
      set({ user: u, token, loading: false, isAdmin: u.role === 'admin', userInk: u.ink ?? null })
    } catch {
      clearTokens()
      set({ user: null, loading: false })
    }
  },

  setUserInk: (ink) => set({ userInk: ink }),

  setUserAvatarUrl: (url) =>
    set((state) => (state.user ? { user: { ...state.user, avatar_url: url } } : {})),
}))
