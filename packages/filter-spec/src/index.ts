export {
  assertNever,
  CREDENTIAL_TYPES,
  CREDENTIAL_TYPE_LABELS,
  FILTER_KINDS,
  FILTER_KIND_LABELS,
  isCredentialType,
  isFilterKind,
  isValidFilterSpec,
  isValidThreshold,
  specThreshold,
  type CredentialCountSpec,
  type CredentialType,
  type FilterKind,
  type FilterSpec,
  type XpBalanceSpec,
} from "./model";
// Renderer only — `natural_language_criteria` is derived state, and there is
// deliberately no parser on the public surface.
export { renderFilterSpec } from "./canonical";
export {
  filterSpecFromWire,
  filterSpecToProto,
  isLegacyWireFilter,
  legacyFilterToProto,
  requirementsFromFilters,
  type WireFilter,
} from "./proto";
export {
  countMatchingCredentials,
  evaluateFilterSpec,
  evaluateRequirements,
  xpBalanceFor,
  type EvaluableCredential,
  type EvaluableTokenHolding,
  type EvaluationSubject,
  type FilterEvaluation,
  type RequirementsEvaluation,
  type XpTokenResolver,
} from "./evaluate";
