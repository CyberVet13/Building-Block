"use client";

/**
 * Auth helpers — wraps Amplify Cognito in production,
 * falls back to a dev stub when COGNITO env vars are absent.
 *
 * Design: getToken() is synchronous everywhere for easy use in event handlers
 * and useEffect callbacks. The token is cached in sessionStorage after sign-in
 * and refreshed when it expires.
 */

import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  fetchAuthSession,
} from "aws-amplify/auth";

// ── Config ────────────────────────────────────────────────────────────────────

const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const CLIENT_ID    = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";
export const IS_DEV_MODE = !USER_POOL_ID || !CLIENT_ID;

if (!IS_DEV_MODE && typeof window !== "undefined") {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: USER_POOL_ID,
        userPoolClientId: CLIENT_ID,
        signUpVerificationMethod: "code",
      },
    },
  });
}

// ── Dev stub ──────────────────────────────────────────────────────────────────

const DEV_PAYLOAD = {
  sub: "dev-user-00000000",
  email: "dev@example.com",
  token_use: "access",
  exp: Math.floor(Date.now() / 1000) + 86400,
};
const _b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const DEV_TOKEN = `eyJhbGciOiJub25lIn0.${_b64(DEV_PAYLOAD)}.dev`;

const TOKEN_KEY = "bb_access_token";
const TOKEN_EXP_KEY = "bb_token_exp";

function _cacheToken(token: string, expEpoch: number) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TOKEN_KEY, token);
  window.sessionStorage.setItem(TOKEN_EXP_KEY, String(expEpoch));
  // Lightweight auth cookie for Next.js middleware route guard
  document.cookie = "bb_authed=1; path=/; SameSite=Lax";
}

function _clearToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TOKEN_KEY);
  window.sessionStorage.removeItem(TOKEN_EXP_KEY);
  // Clear auth cookie
  document.cookie = "bb_authed=; path=/; max-age=0";
  document.cookie = "bb_role=; path=/; max-age=0";
}

export function setRoleCookie(role: string) {
  if (typeof window === "undefined") return;
  document.cookie = `bb_role=${role}; path=/; SameSite=Lax`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synchronous token getter — safe to call anywhere.
 * Returns dev token in dev mode; cached Cognito token in production.
 * Returns null if user is not signed in.
 */
export function getToken(): string | null {
  if (IS_DEV_MODE) return DEV_TOKEN;
  if (typeof window === "undefined") return null;

  const token = window.sessionStorage.getItem(TOKEN_KEY);
  const exp   = Number(window.sessionStorage.getItem(TOKEN_EXP_KEY) ?? "0");

  // Return cached token if not expired (with 60s buffer)
  if (token && exp > Date.now() / 1000 + 60) return token;

  // Token missing or expired — trigger background refresh (fire and forget)
  _refreshToken();
  return token ?? null;
}

/** Async version — awaits a fresh token; use in sign-in flows. */
export async function getTokenAsync(): Promise<string | null> {
  if (IS_DEV_MODE) return DEV_TOKEN;
  return _refreshToken();
}

async function _refreshToken(): Promise<string | null> {
  try {
    const session = await fetchAuthSession({ forceRefresh: false });
    const token = session.tokens?.accessToken?.toString() ?? null;
    const exp   = session.tokens?.accessToken?.payload?.exp as number ?? 0;
    if (token) _cacheToken(token, exp);
    return token;
  } catch {
    _clearToken();
    return null;
  }
}

export interface AppUser {
  sub: string;
  email: string;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (IS_DEV_MODE) return { sub: DEV_PAYLOAD.sub, email: DEV_PAYLOAD.email };
  try {
    const session = await fetchAuthSession();
    const payload = session.tokens?.idToken?.payload;
    if (!payload?.sub) return null;
    return {
      sub: payload.sub as string,
      email: (payload.email as string) ?? "",
    };
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  if (IS_DEV_MODE) return;
  await amplifySignIn({ username: email, password });
  // Cache token immediately after sign-in
  await _refreshToken();
}

export async function signOut(): Promise<void> {
  if (IS_DEV_MODE) return;
  _clearToken();
  await amplifySignOut();
}
