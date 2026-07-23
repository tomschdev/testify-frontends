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
 * XP issuance (§1.8) — move an amount of the org's XP token to a candidate.
 *
 * prepare → sign → submit, as everywhere on issue-v1. XP lands soulbound: the
 * recipient's token relationship is frozen after delivery.
 *
 * Two failures are the caller's and are surfaced with their own status rather
 * than a generic upstream error (xp-token brief):
 *   401 — the signature did not verify against the issuer's account key.
 *   403 — `tokenId` names a token that is not this issuer's (a stale or
 *         wrong stored id), which the client messages as a mismatch.
 */

interface IssueXpBody {
  /** Organisation resource name, `organisations/{id}` — the issuing identity. */
  organisation: string;
  /** The org's XP token id, `0.0.<n>`, from creation (§1.7). */
  tokenId: string;
  /** Recipient Hedera account id, `0.0.<n>`. */
  recipient: string;
  /** Positive integer — the token has zero decimals. */
  amount: number;
}

function parseBody(raw: unknown): IssueXpBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { organisation, tokenId, recipient, amount } = raw as Record<string, unknown>;
  if (
    typeof organisation !== "string" ||
    !/^organisations\/[a-z0-9-]+$/.test(organisation) ||
    typeof tokenId !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(tokenId) ||
    typeof recipient !== "string" ||
    !/^\d+\.\d+\.\d+$/.test(recipient) ||
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return null;
  }
  return { organisation, tokenId, recipient, amount };
}

function errorJson(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: IssueXpBody | null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) {
    return errorJson(
      400,
      "invalid request: expected {organisation, tokenId, recipient, amount} with a positive integer amount",
    );
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

    const receipt = await prepareSignSubmit<{
      tokenId: string;
      recipient: string;
      amount: number;
    }>(
      "xp",
      {
        issuer: identity.issuer,
        tokenId: body.tokenId,
        recipient: body.recipient,
        amount: body.amount,
      },
      identity.privateKeyHex,
      headers,
    );
    if (isFailure(receipt)) return errorJson(receipt.status, receipt.message);

    return NextResponse.json({ ...receipt, issuer: identity.issuer });
  } catch (err) {
    if (err instanceof GrpcStatusError) {
      const status = err.code === 16 ? 401 : err.code === 7 ? 403 : 502;
      return errorJson(status, `fetch organisation: ${err.message}`);
    }
    console.error("[/api/xp] failed:", err);
    return errorJson(500, "XP issuance failed");
  }
}
