"use client";

/**
 * Minimal auth helpers for local dev.
 * In production these wrap Amazon Cognito via aws-amplify or amazon-cognito-identity-js.
 * For now, getToken() returns a dev stub token the API accepts when COGNITO_USER_POOL_ID is unset.
 */

const DEV_TOKEN_PAYLOAD = {
  sub: "dev-user-00000000",
  email: "dev@example.com",
  token_use: "access",
  exp: Math.floor(Date.now() / 1000) + 86400,
};

function encodePart(obj: object) {
  return btoa(JSON.stringify(obj)).replace(/=/g, "");
}

const DEV_TOKEN = `eyJhbGciOiJub25lIn0.${encodePart(DEV_TOKEN_PAYLOAD)}.dev`;

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  // Production: return Cognito accessToken from session storage / Amplify
  return DEV_TOKEN;
}
