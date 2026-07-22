import { NextRequest, NextResponse } from "next/server";

import { AUTH_CLIENT_ID, AUTH_HOST, STATE_COOKIE } from "./config";
import { clearSessionCookies, requestTokens, setSessionCookies } from "./session";

/**
 * The three OAuth route handlers, shared by every app. Next.js still requires a
 * `route.ts` under each app's `app/auth/*` directory; those files are thin
 * wrappers that call these.
 */

/**
 * Starts the sign-in/sign-up redirect. Sign-in and sign-up are unified on the
 * identity service: /authorize shows the email-first page, /signup the
 * provider picker; both accept the same redirect_uri/client_id/state params
 * and mint an auth code back to our callback.
 *
 * `state` is only sent when a client_id is configured. The identity service
 * packs its own upstream-provider state as the comma-joined triple
 * `redirect_uri,client_id,state`, and its /callback/{provider} handler reads
 * field 1 as the client_id unconditionally. With no client_id the field is
 * omitted rather than left empty, so our state lands in slot 1 and is looked
 * up as an app — the "no app with this client_id" 404.
 */
export function signinHandler(req: NextRequest): NextResponse {
  const state = crypto.randomUUID();
  const callback = `${req.nextUrl.origin}/auth/callback`;

  const target = new URL(`${AUTH_HOST}/signup`);
  target.searchParams.set("redirect_uri", callback);
  if (AUTH_CLIENT_ID) {
    target.searchParams.set("client_id", AUTH_CLIENT_ID);
    target.searchParams.set("state", state);
  }

  const res = NextResponse.redirect(target);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/auth",
    maxAge: 600,
  });
  return res;
}

/**
 * OAuth callback: ?code=...&state=... arrives in the query string. The code is
 * single-use and valid for 10 minutes; exchange it for access/refresh tokens
 * and store them in httpOnly cookies.
 */
export async function callbackHandler(req: NextRequest): Promise<NextResponse> {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", req.nextUrl.origin));
  }
  // The identity service can only round-trip `state` when a client_id is
  // registered, so the CSRF check is only enforceable on that path.
  if (AUTH_CLIENT_ID) {
    if (!expectedState || state !== expectedState) {
      return NextResponse.redirect(new URL("/?auth_error=state_mismatch", req.nextUrl.origin));
    }
  } else {
    console.warn("[auth] AUTH_CLIENT_ID unset — skipping state check (client-id-less flow)");
  }

  const tokens = await requestTokens({
    grant_type: "authorization_code",
    code,
    redirect_uri: `${req.nextUrl.origin}/auth/callback`,
  });
  if (!tokens) {
    return NextResponse.redirect(new URL("/?auth_error=token_exchange_failed", req.nextUrl.origin));
  }

  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  res.cookies.delete(STATE_COOKIE);
  setSessionCookies(res.cookies, tokens);
  return res;
}

export function signoutHandler(req: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  clearSessionCookies(res.cookies);
  return res;
}
