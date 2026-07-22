import { NextRequest, NextResponse } from "next/server";

import { signoutHandler } from "@attestant/auth";

/** Thin wrapper — the flow itself lives in @attestant/auth (shared by all apps). */
export function GET(req: NextRequest): NextResponse {
  return signoutHandler(req);
}
