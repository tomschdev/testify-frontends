import { NextRequest, NextResponse } from "next/server";

import { getValidAccessToken } from "@attestant/auth";
import { GrpcStatusError } from "@attestant/auth/grpc";

import {
  fetchIssuerIdentity,
  isFailure,
  issueHeaders,
  prepareSignSubmit,
} from "@/lib/issueSigning";

export const dynamic = "force-dynamic";

/**
 * XP token creation (§1.7) — once per organisation.
 *
 * Same two-leg pattern as credential issuance: prepare → sign the exact
 * returned payload bytes with the org's key → submit. `/v1/xp-tokens:submit`
 * answers with the new `tokenId`.
 *
 * There is no backend lookup for that id (deliberately deferred), so the
 * console persists it client-side and always shows it. The backend is
 * stateless and does not enforce once-per-org: a second create mints a
 * second, equally valid token and orphans the first, so the gate is the
 * console's (see `XpToken.tsx`). Recovery if the id is lost: the token is
 * on-chain with memo `xp:<issuer account>`.
 */

interface CreateXpTokenBody {
  /** Organisation resource name, `organisations/{id}` — the issuing identity. */
  organisation: string;
  tokenName: string;
  tokenSymbol: string;
}

function parseBody(raw: unknown): CreateXpTokenBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { organisation, tokenName, tokenSymbol } = raw as Record<string, unknown>;
  if (
    typeof organisation !== "string" ||
    !/^organisations\/[a-z0-9-]+$/.test(organisation) ||
    typeof tokenName !== "string" ||
    tokenName.trim() === "" ||
    typeof tokenSymbol !== "string" ||
    tokenSymbol.trim() === ""
  ) {
    return null;
  }
  return {
    organisation,
    tokenName: tokenName.trim(),
    tokenSymbol: tokenSymbol.trim(),
  };
}

function errorJson(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CreateXpTokenBody | null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) {
    return errorJson(400, "invalid request: expected {organisation, tokenName, tokenSymbol}");
  }

  const userToken = await getValidAccessToken();
  if (!userToken) {
    return errorJson(401, "no session - sign in at /auth/signin");
  }

  try {
    const identity = await fetchIssuerIdentity(body.organisation, userToken);
    if (isFailure(identity)) return errorJson(identity.status, identity.message);

    const headers = await issueHeaders(userToken);
    if (isFailure(headers)) return errorJson(headers.status, headers.message);

    const receipt = await prepareSignSubmit<{ tokenId: string }>(
      "xp-tokens",
      {
        issuer: identity.issuer,
        tokenName: body.tokenName,
        tokenSymbol: body.tokenSymbol,
      },
      identity.privateKeyHex,
      headers,
    );
    if (isFailure(receipt)) return errorJson(receipt.status, receipt.message);

    // `issuer` rides along: it is both the memo key for on-chain recovery
    // (`xp:<issuer account>`) and what the client shows next to the token.
    return NextResponse.json({ ...receipt, issuer: identity.issuer });
  } catch (err) {
    if (err instanceof GrpcStatusError) {
      const status = err.code === 16 ? 401 : err.code === 7 ? 403 : 502;
      return errorJson(status, `fetch organisation: ${err.message}`);
    }
    console.error("[/api/xp-tokens] failed:", err);
    return errorJson(500, "XP token creation failed");
  }
}
