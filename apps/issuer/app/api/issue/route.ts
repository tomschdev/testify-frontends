import { NextRequest, NextResponse } from "next/server";

import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { FieldMask } from "google-protobuf/google/protobuf/field_mask_pb";

import { GetOrganisationRequest, Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import { ISSUE_SERVICE, USERS_SERVICE, getValidAccessToken } from "@attestant/auth";
import { GrpcStatusError, callUnary, serviceIdToken } from "@attestant/auth/grpc";

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
 * issue-v1 is plain HTTP/JSON (not gRPC) by design — canonicalisation is
 * owned entirely by that server, so it is called with fetch carrying the same
 * two tokens as every backend call: `authorization` = SA Google ID token,
 * `x-alis-forwarded-authorization` = the user's JWT.
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

/** issue-v1 error bodies are {"error": "..."} — surface them verbatim. */
async function issueServiceError(res: Response, leg: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === "string") return `${leg}: ${body.error}`;
  } catch {
    // Non-JSON error body — fall through to the status line.
  }
  return `${leg} failed with HTTP ${res.status}`;
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
    const usersIdToken = await serviceIdToken(USERS_SERVICE);
    if ("error" in usersIdToken) return errorJson(500, usersIdToken.error);

    const getOrg = new GetOrganisationRequest();
    getOrg.setName(body.organisation);
    const mask = new FieldMask();
    mask.setPathsList(["hedera_account_address", "private_key"]);
    getOrg.setReadMask(mask);

    const orgBytes = await callUnary(
      USERS_SERVICE,
      "/interface.ti.users.v1.OrganisationsService/GetOrganisation",
      getOrg.serializeBinary(),
      {
        authorization: `Bearer ${usersIdToken.token}`,
        "x-alis-forwarded-authorization": userToken,
      },
    );
    const org = Organisation.deserializeBinary(orgBytes);
    const issuer = org.getHederaAccountAddress();
    const privateKeyHex = org.getPrivateKey().replace(/^0x/, "");
    if (issuer === "" || privateKeyHex === "") {
      return errorJson(
        409,
        "organisation has no on-chain identity or signing key — it may predate key persistence",
      );
    }

    const issueIdToken = await serviceIdToken(ISSUE_SERVICE);
    if ("error" in issueIdToken) return errorJson(500, issueIdToken.error);
    const issueHeaders = {
      "Content-Type": "application/json",
      authorization: `Bearer ${issueIdToken.token}`,
      "x-alis-forwarded-authorization": userToken,
    };

    // Leg 1: prepare — the server marshals the canonical payload once.
    const prepareRes = await fetch(`${ISSUE_SERVICE}/v1/credentials:prepare`, {
      method: "POST",
      headers: issueHeaders,
      body: JSON.stringify({
        type: body.type,
        issuer,
        subject: body.subject,
        subjectPublicKey: body.subjectPublicKey,
        title: body.title,
      }),
      cache: "no-store",
    });
    if (!prepareRes.ok) {
      return errorJson(502, await issueServiceError(prepareRes, "prepare"));
    }
    const { payload } = (await prepareRes.json()) as { payload: string };
    if (typeof payload !== "string" || payload === "") {
      return errorJson(502, "prepare returned no payload");
    }

    // Leg 2: sign the exact base64-decoded bytes. keccak256 + secp256k1 with
    // prehash disabled reproduces hiero-sdk-go's ecdsa.SignCompact(keccak(m))
    // 64-byte r‖s output; the payload string itself is passed through to
    // submit untouched.
    const payloadBytes = Buffer.from(payload, "base64");
    const digest = keccak_256(payloadBytes);
    const signature = secp256k1.sign(digest, Buffer.from(privateKeyHex, "hex"), {
      prehash: false,
    });

    // Leg 3: submit — the verified signature is the only authorization.
    const submitRes = await fetch(`${ISSUE_SERVICE}/v1/credentials:submit`, {
      method: "POST",
      headers: issueHeaders,
      body: JSON.stringify({
        payload,
        signature: Buffer.from(signature).toString("base64"),
      }),
      cache: "no-store",
    });
    if (!submitRes.ok) {
      return errorJson(502, await issueServiceError(submitRes, "submit"));
    }
    const receipt = (await submitRes.json()) as {
      topicId: string;
      sequenceNumber: number;
      contentHash: string;
      tokenId: string;
      serial: number;
    };

    // `issuer` rides along so the client can match the credential when it
    // appears on the mirror node (pending → confirmed polling).
    return NextResponse.json({ ...receipt, issuer });
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
