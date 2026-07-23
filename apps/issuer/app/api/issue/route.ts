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
 * Credential issuance: the one flow that is not a pass-through (impl spec
 * §6.2). Three legs, all server-side so the organisation's signing key never
 * reaches the browser:
 *
 *   1. POST {ISSUE_SERVICE}/v1/credentials:prepare → canonical payload bytes
 *   2. Fetch the org's key (GetOrganisation, read_mask: private_key) and sign
 *      those EXACT bytes — keccak256 digest, ECDSA secp256k1, 64-byte r‖s
 *      compact signature, matching hiero-sdk-go PrivateKey.Sign. The payload
 *      is never re-marshalled between prepare and submit: the signature is
 *      the only authorization on submit, and a byte-level difference fails as
 *      an auth rejection.
 *   3. POST /v1/credentials:submit → {topicId, sequenceNumber, contentHash,
 *      tokenId, serial}
 *
 * The legs themselves live in `@/lib/issueSigning`, shared verbatim with the
 * XP token routes (§1.7–1.8). issue-v1 is plain HTTP/JSON (not gRPC) by design
 * — canonicalisation is owned entirely by that server, so it is called with
 * fetch carrying the same two tokens as every backend call: `authorization` =
 * SA Google ID token, `x-alis-forwarded-authorization` = the user's JWT.
 */

const CREDENTIAL_TYPES = ["xp_credential", "reputation_credential"] as const;
type CredentialType = (typeof CREDENTIAL_TYPES)[number];

interface IssueRequestBody {
  type: CredentialType;
  /** Organisation resource name, `organisations/{id}` — the issuing identity. */
  organisation: string;
  /** Recipient Hedera account id, `0.0.x`. */
  subject: string;
  /** Recipient account public key, resolved via MirrorService.GetHederaAccount. */
  subjectPublicKey: string;
  title: string;
}

interface CredentialReceipt {
  topicId: string;
  sequenceNumber: number;
  contentHash: string;
  tokenId: string;
  serial: number;
}

function parseBody(raw: unknown): IssueRequestBody | null {
  if (typeof raw !== "object" || raw === null) return null;
  const body = raw as Record<string, unknown>;
  const { type, organisation, subject, subjectPublicKey, title } = body;
  if (
    typeof type !== "string" ||
    !(CREDENTIAL_TYPES as readonly string[]).includes(type) ||
    typeof organisation !== "string" ||
    !/^organisations\/[a-z0-9-]+$/.test(organisation) ||
    typeof subject !== "string" ||
    subject === "" ||
    typeof subjectPublicKey !== "string" ||
    subjectPublicKey === "" ||
    typeof title !== "string" ||
    title.trim() === ""
  ) {
    return null;
  }
  return {
    type: type as CredentialType,
    organisation,
    subject,
    subjectPublicKey,
    title: title.trim(),
  };
}

function errorJson(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: IssueRequestBody | null;
  try {
    body = parseBody(await req.json());
  } catch {
    body = null;
  }
  if (!body) {
    return errorJson(400, "invalid request: expected {type, organisation, subject, subjectPublicKey, title}");
  }

  const userToken = await getValidAccessToken();
  if (!userToken) {
    return errorJson(401, "no session - sign in at /auth/signin");
  }

  try {
    // The org's on-chain identity and signing key, fetched at issuance time
    // (persist-private-keys custody model — no client-side key storage). The
    // user's JWT is forwarded, so org IAM decides whether this caller may read
    // the organisation at all.
    const identity = await fetchIssuerIdentity(body.organisation, userToken);
    if (isFailure(identity)) return errorJson(identity.status, identity.message);

    const headers = await issueHeaders(userToken);
    if (isFailure(headers)) return errorJson(headers.status, headers.message);

    const receipt = await prepareSignSubmit<CredentialReceipt>(
      "credentials",
      {
        type: body.type,
        issuer: identity.issuer,
        subject: body.subject,
        subjectPublicKey: body.subjectPublicKey,
        title: body.title,
      },
      identity.privateKeyHex,
      headers,
    );
    if (isFailure(receipt)) return errorJson(receipt.status, receipt.message);

    // `issuer` rides along so the client can match the credential when it
    // appears on the mirror node (pending → confirmed polling).
    return NextResponse.json({ ...receipt, issuer: identity.issuer });
  } catch (err) {
    if (err instanceof GrpcStatusError) {
      // 16 UNAUTHENTICATED / 7 PERMISSION_DENIED → the caller's problem;
      // anything else is upstream trouble.
      const status = err.code === 16 ? 401 : err.code === 7 ? 403 : 502;
      return errorJson(status, `fetch organisation: ${err.message}`);
    }
    console.error("[/api/issue] failed:", err);
    return errorJson(500, "credential issuance failed");
  }
}
