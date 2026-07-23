import { assertNever, type FilterSpec } from "./model";
import { filterSpecFromWire, type WireFilter } from "./proto";

/**
 * The slice of a mirror `Credential` the evaluator needs. `type` is the
 * credential-type string as recorded on the HCS topic (`xp_credential` /
 * `reputation_credential`); `issuer` is the issuing Hedera account id — the
 * same identity a spec's `issuer` carries, so they compare with plain
 * equality.
 */
export interface EvaluableCredential {
  type: string;
  issuer: string;
}

/** The slice of a mirror `TokenHolding` the evaluator needs. */
export interface EvaluableTokenHolding {
  tokenId: string;
  balance: number;
}

/**
 * Maps an issuer's Hedera account id to the id of the XP token it issues, or
 * `null` when that is not known. XP tokens are created one per organisation
 * with memo `xp:<issuer account>`, but the mirror's `Token` exposes neither
 * memo nor treasury and there is no lookup-by-issuer RPC, so the consumer
 * supplies whatever mapping it has. Returning `null` makes the balance
 * *unknown* rather than zero — reporting a real balance as 0 would tell the
 * candidate they fail a requirement they may well meet.
 */
export type XpTokenResolver = (issuer: string) => string | null;

const noXpTokens: XpTokenResolver = () => null;

/** Everything a subject brings to an evaluation. */
export interface EvaluationSubject {
  credentials?: readonly EvaluableCredential[];
  holdings?: readonly EvaluableTokenHolding[];
  resolveXpToken?: XpTokenResolver;
}

/** How many credentials of this spec's type and issuer the subject holds. */
export function countMatchingCredentials(
  spec: FilterSpec & { kind: "credentialCount" },
  credentials: readonly EvaluableCredential[],
): number {
  return credentials.filter(
    (c) => c.type === spec.credentialType && c.issuer === spec.issuer,
  ).length;
}

/**
 * The subject's balance of the issuer's XP token, or `null` when the token
 * could not be resolved. A resolved token the subject does not hold is a
 * balance of 0, which is known — only an unresolvable issuer is unknown.
 */
export function xpBalanceFor(
  spec: FilterSpec & { kind: "xpBalance" },
  holdings: readonly EvaluableTokenHolding[],
  resolveXpToken: XpTokenResolver,
): number | null {
  const tokenId = resolveXpToken(spec.issuer);
  if (tokenId === null || tokenId === "") {
    return null;
  }
  return holdings
    .filter((h) => h.tokenId === tokenId)
    .reduce((total, h) => total + h.balance, 0);
}

/** Per-filter evaluation outcome, carrying the numbers an explanation needs. */
export type FilterEvaluation =
  | {
      kind: "credentialCount";
      criteria: string;
      active: boolean;
      spec: FilterSpec & { kind: "credentialCount" };
      /** Credentials of this type and issuer the subject holds. */
      held: number;
      required: number;
      satisfied: boolean;
    }
  | {
      kind: "xpBalance";
      criteria: string;
      active: boolean;
      spec: FilterSpec & { kind: "xpBalance" };
      /** `null` when the issuer's XP token could not be resolved. */
      balance: number | null;
      required: number;
      satisfied: boolean | null;
    }
  | {
      /**
       * A filter stored before the predicate migration
       * (`PREDICATE_TYPE_UNSPECIFIED`): no structure to evaluate, label shown
       * as raw text. The backend fails `SearchProfiles` with
       * FAILED_PRECONDITION if one of these is active.
       */
      kind: "legacy";
      criteria: string;
      active: boolean;
      satisfied: null;
    };

export interface RequirementsEvaluation {
  filters: FilterEvaluation[];
  /**
   * AND over the *active* filters (inactive ones are reported but do not
   * count — proto: only active filters are applied). `null` when any active
   * filter could not be decided: a legacy filter, or an XP-balance filter
   * whose token did not resolve. Pretending either way would be wrong.
   */
  satisfied: boolean | null;
}

/** Evaluates one structured filter against a subject. */
export function evaluateFilterSpec(
  spec: FilterSpec,
  subject: EvaluationSubject,
): boolean | null {
  switch (spec.kind) {
    case "credentialCount":
      return countMatchingCredentials(spec, subject.credentials ?? []) >= spec.minCount;
    case "xpBalance": {
      const balance = xpBalanceFor(
        spec,
        subject.holdings ?? [],
        subject.resolveXpToken ?? noXpTokens,
      );
      return balance === null ? null : balance >= spec.minAmount;
    }
    default:
      return assertNever(spec);
  }
}

function evaluateOne(
  filter: WireFilter,
  subject: EvaluationSubject,
): FilterEvaluation {
  const spec = filterSpecFromWire(filter);
  const criteria = filter.naturalLanguageCriteria;
  if (spec === null) {
    return { kind: "legacy", criteria, active: filter.active, satisfied: null };
  }

  switch (spec.kind) {
    case "credentialCount": {
      const held = countMatchingCredentials(spec, subject.credentials ?? []);
      return {
        kind: "credentialCount",
        criteria,
        active: filter.active,
        spec,
        held,
        required: spec.minCount,
        satisfied: held >= spec.minCount,
      };
    }
    case "xpBalance": {
      const balance = xpBalanceFor(
        spec,
        subject.holdings ?? [],
        subject.resolveXpToken ?? noXpTokens,
      );
      return {
        kind: "xpBalance",
        criteria,
        active: filter.active,
        spec,
        balance,
        required: spec.minAmount,
        satisfied: balance === null ? null : balance >= spec.minAmount,
      };
    }
    default:
      return assertNever(spec);
  }
}

/**
 * Evaluates a position's full filter list against a subject — the profile
 * app's match explanation hangs off this. (The qualify badge itself comes from
 * the backend's `SearchProfiles`; this is the client-side explanation of it.)
 */
export function evaluateRequirements(
  filters: readonly WireFilter[],
  subject: EvaluationSubject,
): RequirementsEvaluation {
  const results = filters.map((filter) => evaluateOne(filter, subject));

  const active = results.filter((r) => r.active);
  const satisfied = active.some((r) => r.satisfied === null)
    ? null
    : active.every((r) => r.satisfied === true);

  return { filters: results, satisfied };
}
