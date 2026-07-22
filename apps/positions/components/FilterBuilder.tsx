"use client";

import {
  CREDENTIAL_TYPES,
  CREDENTIAL_TYPE_LABELS,
  isCredentialType,
  parseFilterCriteria,
  renderFilterSpec,
  type FilterSpec,
  type WireFilter,
} from "@attestant/filter-spec";
import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";

import { Toggle } from "@/components/primitives";

/**
 * A filter being authored. Structured filters round-trip through the
 * canonical FilterSpec string; strings the parser rejects (hand-written or
 * legacy criteria on an existing position) are opaque — they keep their
 * exact text, can be toggled or removed, but not edited structurally.
 */
export type DraftFilter =
  | { kind: "spec"; spec: FilterSpec; active: boolean }
  | { kind: "opaque"; criteria: string; active: boolean };

export function draftFromWire(filter: WireFilter): DraftFilter {
  const spec = parseFilterCriteria(filter.naturalLanguageCriteria);
  return spec
    ? { kind: "spec", spec, active: filter.active }
    : { kind: "opaque", criteria: filter.naturalLanguageCriteria, active: filter.active };
}

/** The natural_language_criteria string a draft will be written as. */
export function draftCriteria(draft: DraftFilter): string {
  return draft.kind === "spec" ? renderFilterSpec(draft.spec) : draft.criteria;
}

export function newDraftFilter(defaultIssuer: string): DraftFilter {
  return {
    kind: "spec",
    spec: { credentialType: "xp_credential", issuer: defaultIssuer, minCount: 1 },
    active: true,
  };
}

export function draftIsValid(draft: DraftFilter): boolean {
  if (draft.kind === "opaque") {
    return draft.criteria.trim() !== "";
  }
  return (
    draft.spec.issuer.trim() !== "" &&
    Number.isInteger(draft.spec.minCount) &&
    draft.spec.minCount >= 1
  );
}

/**
 * Filters are unique by content within a position (the string is the
 * filter's identity) — duplicates would collapse server-side, so block them
 * in the builder.
 */
export function draftsHaveDuplicates(drafts: readonly DraftFilter[]): boolean {
  const criteria = drafts.map(draftCriteria);
  return new Set(criteria).size !== criteria.length;
}

interface FilterBuilderProps {
  drafts: readonly DraftFilter[];
  onChange: (drafts: DraftFilter[]) => void;
  /** Known issuer identities offered in the issuer field's datalist. */
  organisations: readonly Organisation.AsObject[];
  /** Pre-filled issuer for newly added filters — the posting org. */
  defaultIssuer: string;
  disabled?: boolean;
}

/**
 * The general filter-builder (feature-list §2.7): per-filter credential
 * type, issuer and threshold, with an independent active toggle. Rows are
 * AND-combined — `Requirements` has no OR grouping, so neither does this UI.
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
      <datalist id="filter-builder-issuers">
        {organisations.map((org) => (
          <option key={org.name} value={org.name}>
            {org.displayName}
          </option>
        ))}
      </datalist>
      {drafts.map((draft, index) => (
        <FilterRow
          // Index-keyed on purpose: a draft has no stable identity while its
          // content is being edited.
          key={index}
          draft={draft}
          disabled={disabled}
          onChange={(d) => replaceAt(index, d)}
          onRemove={() => removeAt(index)}
        />
      ))}
      {draftsHaveDuplicates(drafts) && (
        <p style={{ color: "#fca5a5", fontSize: "12px", margin: 0 }}>
          Two filters render to the same criterion — filters are unique by
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
  disabled,
  onChange,
  onRemove,
}: {
  draft: DraftFilter;
  disabled: boolean;
  onChange: (draft: DraftFilter) => void;
  onRemove: () => void;
}): React.ReactNode {
  return (
    <div
      style={{
        border: "1px solid #232a3a",
        borderRadius: "8px",
        padding: "10px 12px",
        display: "grid",
        gap: "8px",
      }}
    >
      {draft.kind === "spec" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
          <select
            value={draft.spec.credentialType}
            disabled={disabled}
            onChange={(e) => {
              const value = e.target.value;
              if (isCredentialType(value)) {
                onChange({ ...draft, spec: { ...draft.spec, credentialType: value } });
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
          <label style={{ fontSize: "12px", opacity: 0.7, display: "flex", alignItems: "center", gap: "6px" }}>
            at least
            <input
              type="number"
              min={1}
              step={1}
              value={draft.spec.minCount}
              disabled={disabled}
              onChange={(e) =>
                onChange({
                  ...draft,
                  spec: { ...draft.spec, minCount: Number(e.target.value) },
                })
              }
              style={{ ...builderInputStyle, width: "58px" }}
            />
          </label>
          <label style={{ fontSize: "12px", opacity: 0.7, display: "flex", alignItems: "center", gap: "6px", flex: "1 1 220px" }}>
            issued by
            <input
              value={draft.spec.issuer}
              disabled={disabled}
              list="filter-builder-issuers"
              placeholder="organisations/… or issuer key"
              onChange={(e) =>
                onChange({ ...draft, spec: { ...draft.spec, issuer: e.target.value } })
              }
              style={{ ...builderInputStyle, flex: 1, fontFamily: "monospace", fontSize: "12px" }}
            />
          </label>
        </div>
      ) : (
        <div style={{ fontSize: "13px", opacity: 0.8 }}>
          {draft.criteria}
          <span style={{ display: "block", fontSize: "11px", opacity: 0.6 }}>
            Not in the canonical filter grammar — kept verbatim; toggle or
            remove only.
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
            color: "#fca5a5",
            fontSize: "12px",
            cursor: disabled ? "default" : "pointer",
            opacity: disabled ? 0.5 : 0.8,
          }}
        >
          Remove
        </button>
      </div>

      {draft.kind === "spec" && (
        <div style={{ fontSize: "12px", fontFamily: "monospace", opacity: 0.55 }}>
          {draftIsValid(draft) ? draftCriteria(draft) : "Issuer and a threshold of 1+ required."}
        </div>
      )}
    </div>
  );
}

const builderInputStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid #232a3a",
  borderRadius: "8px",
  padding: "6px 9px",
  color: "inherit",
  font: "inherit",
  fontSize: "13px",
} as const;
