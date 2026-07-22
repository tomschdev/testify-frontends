import { NextRequest, NextResponse } from "next/server";

import { AUTH_CLIENT_ID, AUTH_HOST, STATE_COOKIE } from "@/lib/config";

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
export function GET(req: NextRequest): NextResponse {
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
