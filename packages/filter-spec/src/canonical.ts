import {
  CREDENTIAL_TYPE_LABELS,
  type CredentialType,
  type FilterSpec,
} from "./model";

/**
 * Canonical grammar (one line per filter, exactly one of):
 *
 *   Holds an XP Credential issued by {issuer}
 *   Holds a Reputation Credential issued by {issuer}
 *   Holds at least {n} XP Credentials issued by {issuer}
 *   Holds at least {n} Reputation Credentials issued by {issuer}
 *
 * `renderFilterSpec` and `parseFilterCriteria` are exact inverses over this
 * grammar: parse(render(spec)) deep-equals the (normalised) spec, and
 * render(parse(s)) === s for every canonical string. Anything the parser
 * rejects is opaque raw text — display it verbatim, never evaluate it.
 *
 * The presence form for XP intentionally matches the strings the console
 * wrote under the superseded fixed-predicate version ("Holds an XP
 * Credential issued by organisations/…"), so existing positions parse.
 */

const PRESENCE_RE =
  /^Holds an? (XP|Reputation) Credential issued by (.+)$/;
const COUNT_RE =
  /^Holds at least ([1-9]\d*) (XP|Reputation) Credentials issued by (.+)$/;

function credentialTypeFromLabel(label: "XP" | "Reputation"): CredentialType {
  return label === "XP" ? "xp_credential" : "reputation_credential";
}

/** FilterSpec → its canonical natural_language_criteria string. */
export function renderFilterSpec(spec: FilterSpec): string {
  const label = CREDENTIAL_TYPE_LABELS[spec.credentialType];
  if (spec.minCount > 1) {
    return `Holds at least ${spec.minCount} ${label}s issued by ${spec.issuer}`;
  }
  const article = spec.credentialType === "xp_credential" ? "an" : "a";
  return `Holds ${article} ${label} issued by ${spec.issuer}`;
}

/**
 * natural_language_criteria string → FilterSpec, or null when the string is
 * not in the canonical grammar (an opaque, hand-written or legacy criterion).
 */
export function parseFilterCriteria(criteria: string): FilterSpec | null {
  const presence = PRESENCE_RE.exec(criteria);
  if (presence) {
    const issuer = presence[2];
    if (issuer.trim() === "") {
      return null;
    }
    return {
      credentialType: credentialTypeFromLabel(presence[1] as "XP" | "Reputation"),
      issuer,
      minCount: 1,
    };
  }
  const count = COUNT_RE.exec(criteria);
  if (count) {
    const issuer = count[3];
    if (issuer.trim() === "") {
      return null;
    }
    return {
      credentialType: credentialTypeFromLabel(count[2] as "XP" | "Reputation"),
      issuer,
      minCount: Number(count[1]),
    };
  }
  return null;
}
