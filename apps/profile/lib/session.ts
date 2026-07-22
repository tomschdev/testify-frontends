import { cookies } from "next/headers";

import {
  ACCESS_TOKEN_COOKIE,
  AUTH_HOST,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_TOKEN_COOKIE,
} from "./config";

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
}

interface CookieSetter {
  set(name: string, value: string, options: Record<string, unknown>): void;
  delete(name: string): void;
}

const secure = process.env.NODE_ENV === "production";

export function setSessionCookies(jar: CookieSetter, tokens: TokenResponse): void {
  jar.set(ACCESS_TOKEN_COOKIE, tokens.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
  jar.set(REFRESH_TOKEN_COOKIE, tokens.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookies(jar: CookieSetter): void {
  jar.delete(ACCESS_TOKEN_COOKIE);
  jar.delete(REFRESH_TOKEN_COOKIE);
}

/** Seconds-since-epoch `exp` claim of a JWT, or 0 when unparsable. */
export function jwtExpiry(token: string): number {
  try {
    const payload = token.split(".")[1];
    const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof claims === "object" && claims !== null && "exp" in claims) {
      const exp = (claims as { exp: unknown }).exp;
      return typeof exp === "number" ? exp : 0;
    }
    return 0;
  } catch {
    return 0;
  }
}

/** Client-id-less token exchange/refresh against the identity service. */
export async function requestTokens(
  body: Record<string, string>,
): Promise<TokenResponse | null> {
  const res = await fetch(`${AUTH_HOST}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[auth] ${AUTH_HOST}/token failed: ${res.status} ${await res.text()}`);
    return null;
  }
  return (await res.json()) as TokenResponse;
}

/**
 * Returns a currently-valid access token, refreshing via the refresh-token
 * cookie when the access token is missing or within 30s of expiry. Refreshed
 * cookies are written back when a writable jar is provided (route handlers).
 */
export async function getValidAccessToken(jar?: CookieSetter): Promise<string | null> {
  const store = await cookies();
  const access = store.get(ACCESS_TOKEN_COOKIE)?.value;
  if (access && jwtExpiry(access) - 30 > Date.now() / 1000) {
    return access;
  }

  const refresh = store.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refresh) return null;

  const tokens = await requestTokens({
    grant_type: "refresh_token",
    refresh_token: refresh,
  });
  if (!tokens) return null;

  if (jar) setSessionCookies(jar, tokens);
  return tokens.access_token;
}
