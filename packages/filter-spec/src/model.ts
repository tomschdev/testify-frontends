/**
 * The structured filter model shared between the positions console (which
 * *writes* filters) and the profile app (which *reads and evaluates* them).
 *
 * Structure lives in the proto: `Filter` carries a `predicate_type` enum
 * selecting one of two predicate submessages. `natural_language_criteria` is
 * demoted to a *display label*, derived from the predicate on every write and
 * never parsed back — see `canonical.ts`.
 *
 * `Requirements.filters` are AND-combined by the backend; there is no OR
 * grouping in the proto, so this model deliberately has none either. Filters
 * have no ids: they are unique by content, and any change resends the list.
 */

/**
 * The credential types recorded on the credential HCS topic. These strings are
 * the mirror's own spelling of `Credential.type`, so they are what the
 * evaluator compares against; `proto.ts` maps them to the proto enum.
 */
export type CredentialType = "xp_credential" | "reputation_credential";

export const CREDENTIAL_TYPES: readonly CredentialType[] = [
  "xp_credential",
  "reputation_credential",
];

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  xp_credential: "XP Credential",
  reputation_credential: "Reputation Credential",
};

/**
 * Counts credentials of one type from one issuer held on the credential HCS
 * topic. `minCount` of 1 is a plain presence check and renders as such.
 */
export interface CredentialCountSpec {
  kind: "credentialCount";
  credentialType: CredentialType;
  /**
   * The issuing identity's Hedera account id (`0.0.123`) — the canonical
   * on-chain identity, and exactly what the mirror records as
   * `Credential.issuer`. The console resolves organisation → account id at
   * authoring time, so no matcher indirection is needed at evaluation time.
   */
  issuer: string;
  minCount: number;
}

/**
 * Compares the subject's balance of an issuer's XP token against a threshold.
 * The issuer is an account id as above; turning that into the token id whose
 * balance to read is the consumer's job (see `XpTokenResolver`).
 */
export interface XpBalanceSpec {
  kind: "xpBalance";
  issuer: string;
  minAmount: number;
}

/** A single structured requirement criterion — one predicate, one issuer. */
export type FilterSpec = CredentialCountSpec | XpBalanceSpec;

/** The predicate kinds, in the order the builder offers them. */
export const FILTER_KINDS = ["credentialCount", "xpBalance"] as const;

export type FilterKind = FilterSpec["kind"];

export const FILTER_KIND_LABELS: Record<FilterKind, string> = {
  credentialCount: "Credential count",
  xpBalance: "XP balance",
};

export function isCredentialType(value: string): value is CredentialType {
  return (CREDENTIAL_TYPES as readonly string[]).includes(value);
}

export function isFilterKind(value: string): value is FilterKind {
  return (FILTER_KINDS as readonly string[]).includes(value);
}

/**
 * Thresholds are integers >= 1 — the backend rejects anything less, so the
 * builder blocks it rather than surfacing a write error.
 */
export function isValidThreshold(value: number): boolean {
  return Number.isInteger(value) && value >= 1;
}

/** Is this spec complete enough to write? */
export function isValidFilterSpec(spec: FilterSpec): boolean {
  if (spec.issuer.trim() === "") {
    return false;
  }
  switch (spec.kind) {
    case "credentialCount":
      return isValidThreshold(spec.minCount);
    case "xpBalance":
      return isValidThreshold(spec.minAmount);
    default:
      return assertNever(spec);
  }
}

/** The threshold field of whichever predicate this is. */
export function specThreshold(spec: FilterSpec): number {
  switch (spec.kind) {
    case "credentialCount":
      return spec.minCount;
    case "xpBalance":
      return spec.minAmount;
    default:
      return assertNever(spec);
  }
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled filter kind: ${JSON.stringify(value)}`);
}
