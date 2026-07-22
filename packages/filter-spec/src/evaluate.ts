import { parseFilterCriteria } from "./canonical";
import type { FilterSpec } from "./model";

/**
 * The slice of a mirror `Credential` the evaluator needs. `type` is the
 * credential-type string as recorded on the HCS topic (`xp_credential` /
 * `reputation_credential`); `issuer` is the issuing Hedera account id.
 */
export interface EvaluableCredential {
  type: string;
  issuer: string;
}

/**
 * Decides whether a spec's issuer identifier (org resource name, Hedera
 * account id, or issuer public key) refers to the same identity as a
 * credential's `issuer` (always a Hedera account id on the mirror). The
 * consumer supplies the mapping it has — e.g. the profile app resolves org
 * resource names to Hedera addresses via the orgs it can see. Defaults to
 * strict string equality.
 */
export type IssuerMatcher = (
  specIssuer: string,
  credentialIssuer: string,
) => boolean;

const strictIssuerMatch: IssuerMatcher = (a, b) => a === b;

/** Does this credential set satisfy a single structured filter? */
export function evaluateFilterSpec(
  spec: FilterSpec,
  credentials: readonly EvaluableCredential[],
  issuerMatches: IssuerMatcher = strictIssuerMatch,
): boolean {
  const held = credentials.filter(
    (c) => c.type === spec.credentialType && issuerMatches(spec.issuer, c.issuer),
  ).length;
  return held >= spec.minCount;
}

/** The wire shape of a position filter, as `Filter.AsObject` produces it. */
export interface WireFilter {
  naturalLanguageCriteria: string;
  active: boolean;
}

/** Per-filter evaluation outcome. */
export type FilterEvaluation =
  | {
      /** Canonical string — parsed and evaluated. */
      kind: "evaluated";
      criteria: string;
      active: boolean;
      spec: FilterSpec;
      satisfied: boolean;
    }
  | {
      /** Unparseable string — opaque raw text, cannot be evaluated. */
      kind: "opaque";
      criteria: string;
      active: boolean;
    };

export interface RequirementsEvaluation {
  filters: FilterEvaluation[];
  /**
   * AND over the *active* filters (inactive ones are reported but do not
   * count — proto: only active filters are applied). `null` when any active
   * filter is opaque: the answer is unknowable client-side, and pretending
   * either way would be wrong.
   */
  satisfied: boolean | null;
}

/**
 * Evaluates a position's full filter list against a profile's credentials —
 * the profile app's qualify check and match explanation both hang off this.
 */
export function evaluateRequirements(
  filters: readonly WireFilter[],
  credentials: readonly EvaluableCredential[],
  issuerMatches: IssuerMatcher = strictIssuerMatch,
): RequirementsEvaluation {
  const results: FilterEvaluation[] = filters.map((filter) => {
    const spec = parseFilterCriteria(filter.naturalLanguageCriteria);
    if (!spec) {
      return {
        kind: "opaque",
        criteria: filter.naturalLanguageCriteria,
        active: filter.active,
      };
    }
    return {
      kind: "evaluated",
      criteria: filter.naturalLanguageCriteria,
      active: filter.active,
      spec,
      satisfied: evaluateFilterSpec(spec, credentials, issuerMatches),
    };
  });

  const active = results.filter((r) => r.active);
  const satisfied = active.some((r) => r.kind === "opaque")
    ? null
    : active.every((r) => r.kind === "evaluated" && r.satisfied);

  return { filters: results, satisfied };
}
