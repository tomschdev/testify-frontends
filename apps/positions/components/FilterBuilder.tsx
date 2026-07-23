"use client";

import {
  CREDENTIAL_TYPES,
  CREDENTIAL_TYPE_LABELS,
  FILTER_KINDS,
  FILTER_KIND_LABELS,
  filterSpecFromWire,
  filterSpecToProto,
  isCredentialType,
  isFilterKind,
  isValidFilterSpec,
  legacyFilterToProto,
  renderFilterSpec,
  type FilterKind,
  type FilterSpec,
  type WireFilter,
} from "@attestant/filter-spec";
import { tokens } from "@attestant/ui";
import { Filter } from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_pb";
import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";

import { Toggle } from "@/components/primitives";

/**
 * A filter being authored. Structure lives in the proto predicate, so a draft
 * carries a `FilterSpec` directly — the label is rendered from it on write and
 * never parsed. Legacy filters (stored before the predicate migration) have no
 * readable structure: they keep their exact label, can be toggled or removed,
 * but not edited.
 */
export type DraftFilter =
  | { kind: "spec"; spec: FilterSpec; active: boolean }
  | { kind: "legacy"; criteria: string; active: boolean };

export function draftFromWire(filter: WireFilter): DraftFilter {
  const spec = filterSpecFromWire(filter);
  return spec
    ? { kind: "spec", spec, active: filter.active }
    : { kind: "legacy", criteria: filter.naturalLanguageCriteria, active: filter.active };
}

/** The label a draft will be written with — derived, shown as a live preview. */
export function draftLabel(draft: DraftFilter): string {
  return draft.kind === "spec" ? renderFilterSpec(draft.spec) : draft.criteria;
}

/** A draft as its proto `Filter`, label rendered from the predicate. */
export function draftToProto(draft: DraftFilter): Filter {
  return draft.kind === "spec"
    ? filterSpecToProto(draft.spec, draft.active)
    : legacyFilterToProto(draft.criteria, draft.active);
}

function newSpec(kind: FilterKind, issuer: string): FilterSpec {
  return kind === "credentialCount"
    ? { kind: "credentialCount", credentialType: "xp_credential", issuer, minCount: 1 }
    : { kind: "xpBalance", issuer, minAmount: 1 };
}

export function newDraftFilter(defaultIssuer: string): DraftFilter {
  return { kind: "spec", spec: newSpec("credentialCount", defaultIssuer), active: true };
}

/**
 * Issuer fields carry a Hedera account id — the canonical on-chain identity,
 * and exactly what the mirror records as a credential's issuer. A filter
 * naming anything else would silently never match, so the builder blocks it.
 */
const ACCOUNT_ID_RE = /^\d+\.\d+\.\d+$/;

export function isAccountId(value: string): boolean {
  return ACCOUNT_ID_RE.test(value.trim());
}

export function draftIsValid(draft: DraftFilter): boolean {
  if (draft.kind === "legacy") {
    return draft.criteria.trim() !== "";
  }
  return isValidFilterSpec(draft.spec) && isAccountId(draft.spec.issuer);
}

/**
 * Filters are unique by content within a position — duplicates would collapse
 * server-side, so block them in the builder. The label is a faithful stand-in
 * for the predicate: every field of both predicate types appears in it.
 */
export function draftsHaveDuplicates(drafts: readonly DraftFilter[]): boolean {
  const labels = drafts.map(draftLabel);
  return new Set(labels).size !== labels.length;
}

interface FilterBuilderProps {
  drafts: readonly DraftFilter[];
  onChange: (drafts: DraftFilter[]) => void;
  /** Orgs offered in the issuer picker, resolved to their account ids. */
  organisations: readonly Organisation.AsObject[];
  /** Pre-filled issuer account id for newly added filters — the posting org. */
  defaultIssuer: string;
  disabled?: boolean;
}

/**
 * The general filter-builder (feature-list §2.7): a predicate-type selector
 * with one form per type, an issuer picker resolving organisations to account
 * ids, and an independent active toggle. Rows are AND-combined — `Requirements`
 * has no OR grouping, so neither does this UI.
 */
export function FilterBuilder({
  drafts,
  onChange,
  organisations,
  defaultIssuer,
  disabled = false,
}: FilterBuilderProps): React.ReactNode {
  function replaceAt(index: number, draft: DraftFilter): void {
    onChange(drafts.map((d, i) => (i === index ? draft : d)));
  }
  function removeAt(index: number): void {
    onChange(drafts.filter((_, i) => i !== index));
  }

  return (
    <div style={{ display: "grid", gap: "8px" }}>
      {drafts.map((draft, index) => (
        <FilterRow
          // Index-keyed on purpose: a draft has no stable identity while its
          // content is being edited.
          key={index}
          draft={draft}
          organisations={organisations}
          disabled={disabled}
          onChange={(d) => replaceAt(index, d)}
          onRemove={() => removeAt(index)}
        />
      ))}
      {draftsHaveDuplicates(drafts) && (
        <p style={{ color: tokens.color.danger, fontSize: "12px", margin: 0 }}>
          Two filters describe the same requirement — filters are unique by
          content, so make them differ or remove one.
        </p>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange([...drafts, newDraftFilter(defaultIssuer)])}
        style={{ ...builderInputStyle, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
      >
        + Add filter
      </button>
    </div>
  );
}

function FilterRow({
  draft,
  organisations,
  disabled,
  onChange,
  onRemove,
}: {
  draft: DraftFilter;
  organisations: readonly Organisation.AsObject[];
  disabled: boolean;
  onChange: (draft: DraftFilter) => void;
  onRemove: () => void;
}): React.ReactNode {
  function setSpec(spec: FilterSpec): void {
    onChange({ kind: "spec", spec, active: draft.active });
  }

  return (
    <div
      style={{
        border: `${tokens.border.default} solid ${tokens.color.border}`,
        borderRadius: "8px",
        padding: "10px 12px",
        display: "grid",
        gap: "8px",
      }}
    >
      {draft.kind === "spec" ? (
        <div style={{ display: "grid", gap: "8px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", minWidth: 0 }}>
            <select
              value={draft.spec.kind}
              disabled={disabled}
              onChange={(e) => {
                const value = e.target.value;
                if (isFilterKind(value) && value !== draft.spec.kind) {
                  // Issuer is the one field both predicates share — carry it
                  // across so switching type does not undo the picker.
                  setSpec(newSpec(value, draft.spec.issuer));
                }
              }}
              style={builderInputStyle}
            >
              {FILTER_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {FILTER_KIND_LABELS[kind]}
                </option>
              ))}
            </select>

            {draft.spec.kind === "credentialCount" ? (
              <CredentialCountFields
                spec={draft.spec}
                disabled={disabled}
                onChange={setSpec}
              />
            ) : (
              <XpBalanceFields spec={draft.spec} disabled={disabled} onChange={setSpec} />
            )}
          </div>

          <IssuerField
            issuer={draft.spec.issuer}
            organisations={organisations}
            disabled={disabled}
            onChange={(issuer) => setSpec({ ...draft.spec, issuer })}
          />
        </div>
      ) : (
        <div style={{ fontSize: "13px", opacity: 0.8 }}>
          {draft.criteria}
          <span style={{ display: "block", fontSize: "11px", color: tokens.color.warning }}>
            Legacy filter — stored before filters carried structure. It cannot
            be enforced (the backend rejects a search while one is active) or
            edited; toggle it off, or remove and re-author it.
          </span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <Toggle
          checked={draft.active}
          disabled={disabled}
          label="Filter active"
          onChange={(active) => onChange({ ...draft, active })}
        />
        <span style={{ fontSize: "12px", opacity: 0.6 }}>
          {draft.active ? "Active" : "Inactive"}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onRemove}
          style={{
            marginLeft: "auto",
            background: "none",
            border: "none",
            color: tokens.color.danger,
            fontSize: "12px",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.5 : 0.8,
          }}
        >
          Remove
        </button>
      </div>

      {draft.kind === "spec" && (
        <div style={{ fontSize: "12px", opacity: 0.55 }}>
          {draftIsValid(draft) ? (
            <>
              {/* The label is derived state — this is exactly the string that
                  will be written, re-rendered as the form changes. */}
              <span style={{ opacity: 0.7 }}>Reads as: </span>
              {draftLabel(draft)}
            </>
          ) : (
            <span style={{ color: tokens.color.danger }}>
              Needs an issuer account id (0.0.123) and a threshold of 1 or more.
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CredentialCountFields({
  spec,
  disabled,
  onChange,
}: {
  spec: FilterSpec & { kind: "credentialCount" };
  disabled: boolean;
  onChange: (spec: FilterSpec) => void;
}): React.ReactNode {
  return (
    <>
      <select
        value={spec.credentialType}
        disabled={disabled}
        onChange={(e) => {
          const value = e.target.value;
          if (isCredentialType(value)) {
            onChange({ ...spec, credentialType: value });
          }
        }}
        style={builderInputStyle}
      >
        {CREDENTIAL_TYPES.map((type) => (
          <option key={type} value={type}>
            {CREDENTIAL_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <label style={fieldLabelStyle}>
        at least
        <input
          type="number"
          min={1}
          step={1}
          value={spec.minCount}
          disabled={disabled}
          onChange={(e) => onChange({ ...spec, minCount: Number(e.target.value) })}
          style={{ ...builderInputStyle, width: "68px" }}
        />
      </label>
    </>
  );
}

function XpBalanceFields({
  spec,
  disabled,
  onChange,
}: {
  spec: FilterSpec & { kind: "xpBalance" };
  disabled: boolean;
  onChange: (spec: FilterSpec) => void;
}): React.ReactNode {
  return (
    <label style={fieldLabelStyle}>
      at least
      <input
        type="number"
        min={1}
        step={1}
        value={spec.minAmount}
        disabled={disabled}
        onChange={(e) => onChange({ ...spec, minAmount: Number(e.target.value) })}
        style={{ ...builderInputStyle, width: "88px" }}
      />
      XP
    </label>
  );
}

const CUSTOM_ISSUER = "__custom__";

/**
 * Organisation → account id resolution, done here at authoring time: the
 * filter stores `Organisation.hedera_account_address`, never a resource name.
 * Orgs without an on-chain account cannot issue, so they are not selectable.
 * The raw fallback covers issuers outside the user's own organisations.
 */
function IssuerField({
  issuer,
  organisations,
  disabled,
  onChange,
}: {
  issuer: string;
  organisations: readonly Organisation.AsObject[];
  disabled: boolean;
  onChange: (issuer: string) => void;
}): React.ReactNode {
  const known = organisations.filter((o) => o.hederaAccountAddress !== "");
  const matching = known.find((o) => o.hederaAccountAddress === issuer);
  // An issuer that is not one of the user's orgs — including the empty
  // starting value — is edited as a raw account id.
  const custom = matching === undefined;
  const invalid = issuer.trim() !== "" && !isAccountId(issuer);

  return (
    <div style={{ display: "grid", gap: "4px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", minWidth: 0 }}>
        <span style={{ fontSize: "12px", opacity: 0.7 }}>issued by</span>
        <select
          value={custom ? CUSTOM_ISSUER : issuer}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === CUSTOM_ISSUER ? "" : e.target.value)}
          style={{ ...builderInputStyle, flex: "1 1 200px" }}
        >
          {known.map((org) => (
            <option key={org.name} value={org.hederaAccountAddress}>
              {org.displayName || org.name}
            </option>
          ))}
          <option value={CUSTOM_ISSUER}>Another issuer (account id)…</option>
        </select>
        {custom && (
          <input
            value={issuer}
            disabled={disabled}
            placeholder="0.0.123"
            onChange={(e) => onChange(e.target.value)}
            style={{
              ...builderInputStyle,
              flex: "1 1 140px",
              fontFamily: "monospace",
              fontSize: "12px",
              borderColor: invalid ? tokens.color.danger : tokens.color.border,
            }}
          />
        )}
      </div>
      {matching && (
        <span style={{ fontSize: "11px", opacity: 0.55, fontFamily: "monospace" }}>
          {matching.hederaAccountAddress}
        </span>
      )}
      {invalid && (
        <span style={{ fontSize: "11px", color: tokens.color.danger }}>
          Issuers are Hedera account ids, like 0.0.123.
        </span>
      )}
    </div>
  );
}

const fieldLabelStyle = {
  fontSize: "12px",
  opacity: 0.7,
  display: "flex",
  alignItems: "center",
  gap: "6px",
} as const;

const builderInputStyle = {
  // Fields carry account ids; without these they claim their intrinsic width
  // and push the row past the panel, which clips.
  maxWidth: "100%",
  minWidth: 0,
  background: tokens.color.surface,
  border: `${tokens.border.default} solid ${tokens.color.border}`,
  borderRadius: "8px",
  padding: "6px 9px",
  color: "inherit",
  font: "inherit",
  fontSize: "13px",
} as const;
