import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { FieldMask } from "google-protobuf/google/protobuf/field_mask_pb";

import { GetOrganisationRequest, Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import { ISSUE_SERVICE, USERS_SERVICE } from "@attestant/auth";
import { callUnary, serviceIdToken } from "@attestant/auth/grpc";

/**
 * The pieces every issue-v1 flow shares (impl spec §6.2): credential issuance
 * (§1.5–1.6), XP token creation (§1.7) and XP issuance (§1.8) are all the same
 * two-leg pattern —
 *
 *   prepare → sign the EXACT returned payload bytes → submit
 *
 * — differing only in the endpoint pair and the prepare body. The signature is
 * the only authorization on submit, so the payload string is passed through
 * untouched; re-marshalling it anywhere between the legs turns into an auth
 * rejection, not a validation error.
 *
 * Signing stays server-side so the organisation's private key never reaches
 * the browser.
 */

/** The org's on-chain identity plus the key that authorizes acting as it. */
export interface IssuerIdentity {
  /** Hedera account id, `0.0.<n>` — the `issuer` field on every prepare body. */
  issuer: string;
  /** secp256k1 private key, hex, no `0x` prefix. */
  privateKeyHex: string;
}

/** A failure to map onto an HTTP response, with the status already chosen. */
export interface IssueFailure {
  status: number;
  message: string;
}

export function isFailure<T>(value: T | IssueFailure): value is IssueFailure {
  return typeof value === "object" && value !== null && "status" in value && "message" in value;
}

/**
 * The organisation's Hedera account and signing key, fetched at signing time
 * (persist-private-keys custody model — no client-side key storage). The
 * user's JWT is forwarded, so org IAM decides whether this caller may read the
 * organisation at all.
 */
export async function fetchIssuerIdentity(
  organisation: string,
  userToken: string,
): Promise<IssuerIdentity | IssueFailure> {
  const usersIdToken = await serviceIdToken(USERS_SERVICE);
  if ("error" in usersIdToken) return { status: 500, message: usersIdToken.error };

  const getOrg = new GetOrganisationRequest();
  getOrg.setName(organisation);
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
    return {
      status: 409,
      message:
        "organisation has no on-chain identity or signing key — it may predate key persistence",
    };
  }
  return { issuer, privateKeyHex };
}

/** The two-token rule: SA Google ID token plus the signed-in user's JWT. */
export async function issueHeaders(
  userToken: string,
): Promise<Record<string, string> | IssueFailure> {
  const issueIdToken = await serviceIdToken(ISSUE_SERVICE);
  if ("error" in issueIdToken) return { status: 500, message: issueIdToken.error };
  return {
    "Content-Type": "application/json",
    authorization: `Bearer ${issueIdToken.token}`,
    "x-alis-forwarded-authorization": userToken,
  };
}

/**
 * keccak256 digest + ECDSA secp256k1 with prehash disabled reproduces
 * hiero-sdk-go's `PrivateKey.Sign` (ecdsa.SignCompact over keccak(m)), a
 * 64-byte r‖s compact signature. Base64 for the submit body.
 */
export function signPayload(payload: string, privateKeyHex: string): string {
  const digest = keccak_256(Buffer.from(payload, "base64"));
  const signature = secp256k1.sign(digest, Buffer.from(privateKeyHex, "hex"), {
    prehash: false,
  });
  return Buffer.from(signature).toString("base64");
}

/** issue-v1 error bodies are `{"error": "..."}` — surface them verbatim. */
export async function issueServiceError(res: Response, leg: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    if (typeof body.error === "string") return `${leg}: ${body.error}`;
  } catch {
    // Non-JSON error body — fall through to the status line.
  }
  return `${leg} failed with HTTP ${res.status}`;
}

/**
 * Run one prepare → sign → submit round against an issue-v1 endpoint pair.
 * `path` is the resource segment: `credentials`, `xp-tokens`, `xp`.
 *
 * 401 and 403 from either leg are the caller's problem and are passed through
 * with their own status rather than collapsed into a 502 (xp-token brief):
 * 401 means the signature did not verify against the issuer's account key,
 * 403 that the token named does not belong to this issuer.
 */
export async function prepareSignSubmit<T>(
  path: string,
  prepareBody: Record<string, unknown>,
  privateKeyHex: string,
  headers: Record<string, string>,
): Promise<T | IssueFailure> {
  const prepareRes = await fetch(`${ISSUE_SERVICE}/v1/${path}:prepare`, {
    method: "POST",
    headers,
    body: JSON.stringify(prepareBody),
    cache: "no-store",
  });
  if (!prepareRes.ok) {
    return {
      status: passThroughStatus(prepareRes.status),
      message: await issueServiceError(prepareRes, "prepare"),
    };
  }
  const { payload } = (await prepareRes.json()) as { payload?: string };
  if (typeof payload !== "string" || payload === "") {
    return { status: 502, message: "prepare returned no payload" };
  }

  const submitRes = await fetch(`${ISSUE_SERVICE}/v1/${path}:submit`, {
    method: "POST",
    headers,
    // `payload` is the untouched prepare response string — the signature
    // covers those exact bytes.
    body: JSON.stringify({ payload, signature: signPayload(payload, privateKeyHex) }),
    cache: "no-store",
  });
  if (!submitRes.ok) {
    return {
      status: passThroughStatus(submitRes.status),
      message: await issueServiceError(submitRes, "submit"),
    };
  }
  return (await submitRes.json()) as T;
}

function passThroughStatus(status: number): number {
  return status === 401 || status === 403 ? status : 502;
}
