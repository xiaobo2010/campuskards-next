"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  authApi,
  isDemoCreds,
  makeDemoTokens,
  DEMO_USER,
  isDemoToken,
  DEMO_MODE_ENABLED,
} from "./api";
import type { User } from "@/types";

interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (loginVal: string, password: string, remember?: boolean) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  userInk: number | null;
  setUserInk: (ink: number | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function persistSession(
  tokens: AuthTokens,
  remember: boolean,
): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
    await fetch(`${baseUrl}/api/auth/set-cookie`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokens.access_token}`,
      },
      credentials: "include",
      body: JSON.stringify({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        remember,
      }),
    });
  } catch {
    // Cookie persistence failed - session will rely on Bearer token only
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userInk, setUserInk] = useState<number | null>(null);
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toastRef = useRef<any>(null);

  // Dynamically import toast to avoid SSR issues
  useEffect(() => {
    import("sonner").then((m) => {
      toastRef.current = m.toast;
    });
  }, []);

  const setTokens = useCallback(
    (access: string, refresh: string) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", access);
        localStorage.setItem("refresh_token", refresh);
      }
    },
    [],
  );

  const clearTokens = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("campuskards_remember");
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const at = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
        // Stale demo token when demo mode disabled — clear and treat as logged out
        if (at && at.startsWith("demo_") && !DEMO_MODE_ENABLED) {
          clearTokens();
          return;
        }
        if (at && isDemoToken(at)) {
          if (!cancelled) {
            setUser({ ...DEMO_USER });
            setUserInk(DEMO_USER.ink ?? null);
            setLoading(false);
          }
          return;
        }

        // Try cookie-based auth first
        try {
          const u = await authApi.me();
          if (!cancelled) {
            setUser(u);
            setUserInk(u.ink ?? null);
            setLoading(false);
          }
          return; // Cookie auth succeeded
        } catch {
          // Cookie auth failed, try localStorage token
        }

        try {
          const token = localStorage.getItem('access_token');
          if (!token) { clearTokens(); return; }
          const u = await authApi.me();
          if (!cancelled) {
            setUser(u);
            setUserInk(u.ink ?? null);
          }
        } catch {
          clearTokens();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    checkSession();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(
    async (loginVal: string, password: string, remember = false) => {
      // Demo mode only: testcase/testcase bypasses backend
      if (isDemoCreds(loginVal, password)) {
        const tokens = makeDemoTokens();
        setTokens(tokens.access_token, tokens.refresh_token);
        if (remember) localStorage.setItem("campuskards_remember", "true");
        setUser({ ...DEMO_USER });
        setUserInk(DEMO_USER.ink ?? null);
        return;
      }

      const tokens = await authApi.login(loginVal, password, remember);
      setTokens(tokens.access_token, tokens.refresh_token);
      if (remember) localStorage.setItem("campuskards_remember", "true");
      await persistSession(tokens, remember);

      try {
        const u = await authApi.me();
        setUser(u);
        setUserInk(u.ink ?? null);
      } catch {
        toastRef.current?.error("登录状态未同步", {
          description: "请刷新页面重试",
        });
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const register = useCallback(
    async (username: string, email: string, password: string) => {
      const tokens = await authApi.register(username, email, password);
      setTokens(tokens.access_token, tokens.refresh_token);
      localStorage.setItem("campuskards_remember", "true");

      await persistSession(tokens, true);

      try {
        const u = await authApi.me();
        setUser(u);
        setUserInk(u.ink ?? null);
      } catch {
        toastRef.current?.error("注册状态未同步", {
          description: "请刷新页面重试",
        });
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const logout = useCallback(async () => {
    const at = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!at || !isDemoToken(at)) {
      try {
        await authApi.logout();
      } catch {
        // ignore — still clear local session
      }
    }
    clearTokens();
    setUser(null);
    setUserInk(null);
    window.location.href = "/auth/login?logout=1";
  }, [clearTokens]);

  const refreshUser = useCallback(async () => {
    try {
      const u = await authApi.me();
      setUser(u);
      setUserInk(u.ink ?? null);
    } catch {
      // ignore
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        userInk,
        setUserInk,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
