import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@attestant/auth";

/**
 * Cookie-presence check for server components deciding what to render.
 * Presence is not validity — the proxy is the arbiter and clears unusable
 * cookies on the first RPC — but it is the right signal for "show the
 * signed-in UI or the sign-in prompt".
 */
export async function hasSessionCookies(): Promise<boolean> {
  const store = await cookies();
  return store.has(ACCESS_TOKEN_COOKIE) || store.has(REFRESH_TOKEN_COOKIE);
}
