import {
  CredentialCountPredicate,
  CredentialType as ProtoCredentialType,
  Filter,
  PredicateType,
  Requirements,
  XpBalancePredicate,
} from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_pb";

import { renderFilterSpec } from "./canonical";
import { assertNever, type CredentialType, type FilterSpec } from "./model";

/**
 * The one mapping between `FilterSpec` and the proto `Filter` (enum +
 * submessage), shared by both apps so neither can drift from the wire shape.
 *
 * Lives apart from `model.ts` only to keep the import graph acyclic: writing a
 * filter also renders its label, so this module needs `canonical.ts`, which
 * needs `model.ts`.
 */

/** The wire shape of a position filter, exactly as `Filter.AsObject`. */
export type WireFilter = Filter.AsObject;

const CREDENTIAL_TYPE_TO_PROTO: Record<CredentialType, ProtoCredentialType> = {
  xp_credential: ProtoCredentialType.CREDENTIAL_TYPE_XP,
  reputation_credential: ProtoCredentialType.CREDENTIAL_TYPE_REPUTATION,
};

function credentialTypeFromProto(
  value: ProtoCredentialType,
): CredentialType | null {
  switch (value) {
    case ProtoCredentialType.CREDENTIAL_TYPE_XP:
      return "xp_credential";
    case ProtoCredentialType.CREDENTIAL_TYPE_REPUTATION:
      return "reputation_credential";
    default:
      // CREDENTIAL_TYPE_UNSPECIFIED, or an enum value newer than this build.
      return null;
  }
}

/**
 * Wire filter → structured spec, or `null` when there is no structure to read:
 * a legacy filter stored before the migration (`PREDICATE_TYPE_UNSPECIFIED`),
 * or a predicate type this build does not know. Legacy filters display their
 * label as read-only raw text and cannot be edited structurally.
 */
export function filterSpecFromWire(filter: WireFilter): FilterSpec | null {
  switch (filter.predicateType) {
    case PredicateType.PREDICATE_TYPE_CREDENTIAL_COUNT: {
      const predicate = filter.credentialCount;
      if (!predicate) {
        return null;
      }
      const credentialType = credentialTypeFromProto(predicate.credentialType);
      if (credentialType === null) {
        return null;
      }
      return {
        kind: "credentialCount",
        credentialType,
        issuer: predicate.issuer,
        minCount: predicate.minCount,
      };
    }
    case PredicateType.PREDICATE_TYPE_XP_BALANCE: {
      const predicate = filter.xpBalance;
      if (!predicate) {
        return null;
      }
      return {
        kind: "xpBalance",
        issuer: predicate.issuer,
        minAmount: predicate.minAmount,
      };
    }
    default:
      return null;
  }
}

/**
 * Structured spec → proto `Filter`. The label is rendered here, so every write
 * path gets a label consistent with its predicate by construction.
 */
export function filterSpecToProto(spec: FilterSpec, active: boolean): Filter {
  const filter = new Filter();
  filter.setActive(active);
  filter.setNaturalLanguageCriteria(renderFilterSpec(spec));

  switch (spec.kind) {
    case "credentialCount": {
      const predicate = new CredentialCountPredicate();
      predicate.setCredentialType(CREDENTIAL_TYPE_TO_PROTO[spec.credentialType]);
      predicate.setIssuer(spec.issuer);
      predicate.setMinCount(spec.minCount);
      filter.setPredicateType(PredicateType.PREDICATE_TYPE_CREDENTIAL_COUNT);
      filter.setCredentialCount(predicate);
      break;
    }
    case "xpBalance": {
      const predicate = new XpBalancePredicate();
      predicate.setIssuer(spec.issuer);
      predicate.setMinAmount(spec.minAmount);
      filter.setPredicateType(PredicateType.PREDICATE_TYPE_XP_BALANCE);
      filter.setXpBalance(predicate);
      break;
    }
    default:
      return assertNever(spec);
  }
  return filter;
}

/**
 * Re-emits a legacy filter unchanged. Its structure is unreadable, so the
 * label is passed through verbatim and the predicate left UNSPECIFIED — the
 * only thing the console may still change is `active`.
 */
export function legacyFilterToProto(criteria: string, active: boolean): Filter {
  const filter = new Filter();
  filter.setNaturalLanguageCriteria(criteria);
  filter.setActive(active);
  filter.setPredicateType(PredicateType.PREDICATE_TYPE_UNSPECIFIED);
  return filter;
}

/**
 * The full filter list as one `Requirements`. Filters have no ids, so this is
 * the unit of update for any add/remove/edit/toggle.
 */
export function requirementsFromFilters(filters: readonly Filter[]): Requirements {
  const requirements = new Requirements();
  requirements.setFiltersList([...filters]);
  return requirements;
}

/** Is this wire filter a legacy one — stored before the predicate migration? */
export function isLegacyWireFilter(filter: WireFilter): boolean {
  return filterSpecFromWire(filter) === null;
}
