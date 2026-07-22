import { NextRequest, NextResponse } from "next/server";

import { STATE_COOKIE } from "@/lib/config";
import { requestTokens, setSessionCookies } from "@/lib/session";

/**
 * OAuth callback: ?code=...&state=... arrives in the query string. The code is
 * single-use and valid for 10 minutes; exchange it (client-id-less) for
 * access/refresh tokens and store them in httpOnly cookies.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code) {
    return NextResponse.redirect(new URL("/?auth_error=missing_code", req.nextUrl.origin));
  }
  if (!expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth_error=state_mismatch", req.nextUrl.origin));
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
