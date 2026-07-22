/**
 * The structured filter model shared between the positions console (which
 * *writes* filters) and the profile app (which *reads and evaluates* them).
 *
 * The backend `Filter` message carries two fields only:
 * `natural_language_criteria` (string — also the filter's content-addressed
 * identity) and `active` (bool). There is nowhere to store structured
 * parameters, so structure round-trips through the string via the canonical
 * renderer/parser in `canonical.ts`. Strings that don't match the canonical
 * grammar are opaque raw text: they render as-is and cannot be edited
 * structurally or evaluated.
 *
 * `Requirements.filters` are AND-combined by the backend; there is no OR
 * grouping in the proto, so this model deliberately has none either.
 */

/** The credential types recorded on the credential HCS topic. */
export type CredentialType = "xp_credential" | "reputation_credential";

export const CREDENTIAL_TYPES: readonly CredentialType[] = [
  "xp_credential",
  "reputation_credential",
];

export const CREDENTIAL_TYPE_LABELS: Record<CredentialType, string> = {
  xp_credential: "XP Credential",
  reputation_credential: "Reputation Credential",
};

/** A single structured requirement criterion. One issuer per filter. */
export interface FilterSpec {
  credentialType: CredentialType;
  /**
   * The issuing identity the credential must come from: an organisation
   * resource name (`organisations/{org}`), a Hedera account id (`0.0.123`),
   * or an issuer public key. Matched against `Credential.issuer` at
   * evaluation time via an injectable matcher, since the mirror records
   * issuers as Hedera account ids.
   */
  issuer: string;
  /**
   * Minimum number of credentials of this type from this issuer the profile
   * must hold. 1 (the default) is a plain presence check and renders as such.
   */
  minCount: number;
}

export function isCredentialType(value: string): value is CredentialType {
  return (CREDENTIAL_TYPES as readonly string[]).includes(value);
}
