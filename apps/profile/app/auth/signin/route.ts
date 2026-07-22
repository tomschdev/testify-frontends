import { NextRequest, NextResponse } from "next/server";

import { AUTH_HOST, STATE_COOKIE } from "@/lib/config";

/**
 * Starts the sign-in/sign-up redirect. Sign-in and sign-up are unified on the
 * identity service: /authorize shows the email-first page, /signup the
 * provider picker; both accept the same redirect_uri/state params and mint an
 * auth code back to our callback. Client-id-less flow (no client_id/secret).
 */
export function GET(req: NextRequest): NextResponse {
  const state = crypto.randomUUID();
  const callback = `${req.nextUrl.origin}/auth/callback`;

  const target = new URL(`${AUTH_HOST}/signup`);
  target.searchParams.set("redirect_uri", callback);
  target.searchParams.set("state", state);

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
