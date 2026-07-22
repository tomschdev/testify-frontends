import { NextRequest, NextResponse } from "next/server";

import { clearSessionCookies } from "@/lib/session";

export function GET(req: NextRequest): NextResponse {
  const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
  clearSessionCookies(res.cookies);
  return res;
}
