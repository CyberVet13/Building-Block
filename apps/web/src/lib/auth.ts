"use client";

/**
 * Auth helpers — wraps Amplify Cognito in production,
 * falls back to a dev stub when COGNITO env vars are absent.
 *
 * Usage:
 *   const token = await getToken();          // access token for API calls
 *   const user  = await getCurrentUser();    // { sub, email } | null
 *   await signIn(email, password);
 *   await signOut();
 */

import { Amplify } from "aws-amplify";
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  getCurrentUser as amplifyGetCurrentUser,
  fetchAuthSession,
  type AuthUser,
} from "aws-amplify/auth";

// ── Amplify configuration ─────────────────────────────────────────────────────

const USER_POOL_ID  = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const CLIENT_ID     = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID    ?? "";
const IS_DEV_MODE   = !USER_POOL_ID || !CLIENT_ID;

if (!IS_DEV_MODE) {
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

// ── Dev stub (local without Cognito) ─────────────────────────────────────────

const DEV_PAYLOAD = {
  sub: "dev-user-00000000",
  email: "dev@example.com",
  token_use: "access",
  exp: Math.floor(Date.now() / 1000) + 86400,
};
const _b64 = (o: object) => btoa(JSON.stringify(o)).replace(/=+$/, "");
const DEV_TOKEN = `eyJhbGciOiJub25lIn0.${_b64(DEV_PAYLOAD)}.dev`;

// ── Public API ────────────────────────────────────────────────────────────────

export async function getToken(): Promise<string | null> {
  if (IS_DEV_MODE) return DEV_TOKEN;
  try {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() ?? null;
  } catch {
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
    const user: AuthUser = await amplifyGetCurrentUser();
    const session = await fetchAuthSession();
    const payload = session.tokens?.idToken?.payload;
    return {
      sub: user.userId,
      email: (payload?.email as string) ?? user.signInDetails?.loginId ?? "",
    };
  } catch {
    return null;
  }
}

export async function signIn(email: string, password: string): Promise<void> {
  if (IS_DEV_MODE) {
    console.warn("[auth] Dev mode: signIn is a no-op");
    return;
  }
  await amplifySignIn({ username: email, password });
}

export async function signOut(): Promise<void> {
  if (IS_DEV_MODE) return;
  await amplifySignOut();
}

/**
 * Synchronous version for non-async contexts (e.g. initial fetch calls).
 * Returns the dev token in dev mode; otherwise returns null (caller should
 * use the async getToken() and wait).
 */
export function getTokenSync(): string | null {
  if (IS_DEV_MODE) return DEV_TOKEN;
  return null;
}
