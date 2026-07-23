import {
  assertNever,
  CREDENTIAL_TYPE_LABELS,
  type FilterSpec,
} from "./model";

/**
 * The label renderer. `natural_language_criteria` is *derived state*: it is
 * rendered from the predicate on every write and never read back as a source
 * of structure. There is deliberately no parser here — nothing in the apps may
 * parse a label. (Grammar v1 survives backend-side only, as a one-time
 * migration of already-stored strings.)
 *
 * Canonical phrasing, one line per filter:
 *
 *   Holds an XP Credential issued by {issuer}
 *   Holds a Reputation Credential issued by {issuer}
 *   Holds at least {n} XP Credentials issued by {issuer}
 *   Holds at least {n} Reputation Credentials issued by {issuer}
 *   Has at least {n} XP from {issuer}
 *
 * The credential-count forms are grammar v1's verbatim, so filters migrated
 * from stored strings read exactly as they did before.
 */
export function renderFilterSpec(spec: FilterSpec): string {
  switch (spec.kind) {
    case "credentialCount": {
      const label = CREDENTIAL_TYPE_LABELS[spec.credentialType];
      if (spec.minCount > 1) {
        return `Holds at least ${spec.minCount} ${label}s issued by ${spec.issuer}`;
      }
      const article = spec.credentialType === "xp_credential" ? "an" : "a";
      return `Holds ${article} ${label} issued by ${spec.issuer}`;
    }
    case "xpBalance":
      return `Has at least ${spec.minAmount} XP from ${spec.issuer}`;
    default:
      return assertNever(spec);
  }
}
