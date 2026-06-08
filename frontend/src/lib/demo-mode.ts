import type { User } from "@/types";

/**
 * Demo / offline UI review mode.
 * Set NEXT_PUBLIC_DEMO_MODE=true to enable testcase login and mock API responses.
 * Default (unset or false): normal backend authentication only.
 */
export const DEMO_MODE_ENABLED =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEMO_USERNAME = "testcase";
export const DEMO_PASSWORD = "testcase";
export const DEMO_TOKEN_PREFIX = "demo_";

export const DEMO_USER: User = {
  id: "demo-user",
  username: DEMO_USERNAME,
  email: "testcase@campuskards.demo",
  elo: 1185,
  ink: 2500,
  role: "player",
};

export function isDemoCreds(login: string, password: string): boolean {
  return DEMO_MODE_ENABLED && login === DEMO_USERNAME && password === DEMO_PASSWORD;
}

export function makeDemoTokens(): { access_token: string; refresh_token: string } {
  const segments = [
    btoa(JSON.stringify({ alg: "HS256", typ: "JWT" })),
    btoa(
      JSON.stringify({
        sub: "demo-user",
        username: DEMO_USERNAME,
        exp: Math.floor(Date.now() / 1000) + 86400,
      }),
    ),
    "demo-signature",
  ];
  const t = `${DEMO_TOKEN_PREFIX}${segments.join(".")}`;
  return { access_token: t, refresh_token: t };
}

export function isDemoToken(token: string | null): boolean {
  return DEMO_MODE_ENABLED && !!token && token.startsWith(DEMO_TOKEN_PREFIX);
}

export function isDemoSessionActive(): boolean {
  if (typeof window === "undefined" || !DEMO_MODE_ENABLED) return false;
  const at = localStorage.getItem("access_token");
  return isDemoToken(at);
}
