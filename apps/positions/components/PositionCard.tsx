"use client";

import { useState } from "react";

import * as fieldMaskPb from "google-protobuf/google/protobuf/field_mask_pb";

import {
  isLegacyWireFilter,
  requirementsFromFilters,
  type WireFilter,
} from "@attestant/filter-spec";
import { HederaInfo, HederaRef, siteThemes, tokens } from "@attestant/ui";
import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import {
  Filter,
  Position,
  PositionState,
  Requirements,
  UpdatePositionRequest,
} from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_pb";

import { EligibleProfiles } from "@/components/EligibleProfiles";
import {
  draftFromWire,
  draftIsValid,
  draftsHaveDuplicates,
  draftLabel,
  draftToProto,
  FilterBuilder,
  type DraftFilter,
} from "@/components/FilterBuilder";
import { Badge, Toggle } from "@/components/primitives";
import { positionsClient } from "@/lib/clients";
import { errorMessage } from "@/lib/grpcError";
import { composeDescription, splitDescription } from "@/lib/location";

const STATE_LABELS: Record<PositionState, { label: string; color: string }> = {
  [PositionState.POSITION_STATE_UNSPECIFIED]: { label: "Unknown", color: tokens.color.textMuted },
  [PositionState.POSITION_STATE_OPEN]: { label: "Open", color: tokens.color.success },
  [PositionState.POSITION_STATE_REVOKED]: { label: "Revoked", color: tokens.color.danger },
  [PositionState.POSITION_STATE_FULFILLED]: { label: "Fulfilled", color: tokens.color.info },
};

interface TimestampObject {
  seconds: number;
  nanos: number;
}

function formatTime(ts: TimestampObject | undefined): string {
  if (!ts || ts.seconds === 0) {
    return "—";
  }
  return new Date(ts.seconds * 1000).toLocaleString();
}

function filtersToRequirements(filters: readonly Filter[]): Requirements {
  return requirementsFromFilters(filters);
}

/**
 * One UpdatePosition call. Filters have no ids — the full Requirements list
 * is the unit of update, sent whole on any filter change. `etag` rides along
 * for optimistic concurrency; the server checks it when present.
 */
async function updatePosition(
  position: Position.AsObject,
  changes: {
    title?: string;
    description?: string;
    filters?: readonly Filter[];
  },
): Promise<void> {
  const updated = new Position();
  updated.setName(position.name);
  updated.setEtag(position.etag);

  const paths: string[] = [];
  if (changes.title !== undefined) {
    updated.setTitle(changes.title);
    paths.push("title");
  }
  if (changes.description !== undefined) {
    updated.setDescription(changes.description);
    paths.push("description");
  }
  if (changes.filters !== undefined) {
    updated.setRequirements(filtersToRequirements(changes.filters));
    paths.push("requirements");
  }

  const mask = new fieldMaskPb.FieldMask();
  mask.setPathsList(paths);

  const req = new UpdatePositionRequest();
  req.setPosition(updated);
  req.setUpdateMask(mask);
  await positionsClient.updatePosition(req, {});
}

interface PositionCardProps {
  position: Position.AsObject;
  organisations: Organisation.AsObject[];
  /** Called after any successful write so the list refetches. */
  onChanged: () => void;
}

export function PositionCard({
  position,
  organisations,
  onChanged,
}: PositionCardProps): React.ReactNode {
  const [editing, setEditing] = useState(false);
  const [showProfiles, setShowProfiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const stateInfo = STATE_LABELS[position.state] ?? STATE_LABELS[0];
  // "organisations/{org}/positions/{position}" → the owning organisation, if
  // it is one of the signed-in user's.
  const org = organisations.find((o) => position.name.startsWith(`${o.name}/`));
  // Terminal positions (REVOKED, FULFILLED) reject updates server-side —
  // disable editing in the UI rather than surfacing the backend error. Orgs
  // outside the user's memberships would be denied by IAM, so no edit UI.
  const editable = org !== undefined && position.state === PositionState.POSITION_STATE_OPEN;
  const filters = position.requirements?.filtersList ?? [];
  const { location, body } = splitDescription(position.description);

  async function toggleFilter(index: number): Promise<void> {
    // §2.6: flipping `active` is independent of the filter's predicate — flip
    // the bool, carry the predicate through untouched, resend the whole list.
    // Round-tripping through a draft preserves legacy filters verbatim and
    // re-derives the label for structured ones.
    setBusy(true);
    setWriteError(null);
    try {
      await updatePosition(position, {
        filters: filters.map((f, i) =>
          draftToProto({
            ...draftFromWire(f),
            active: i === index ? !f.active : f.active,
          }),
        ),
      });
      onChanged();
    } catch (err: unknown) {
      setWriteError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li
      style={{
        background: tokens.color.surface,
        border: `${tokens.border.default} solid ${siteThemes.positions.accent}`,
        borderRadius: tokens.radius.md,
        boxShadow: tokens.shadow.sm,
        padding: "14px 16px",
        display: "grid",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
        <span style={{ fontWeight: 600 }}>{position.title || "Untitled position"}</span>
        <span style={{ fontSize: "12px", color: stateInfo.color }}>{stateInfo.label}</span>
        {editable && !editing && (
          <button
            type="button"
            onClick={() => {
              setWriteError(null);
              setEditing(true);
            }}
            style={{ ...smallButtonStyle, marginLeft: "auto" }}
          >
            Edit
          </button>
        )}
      </div>

      {editing && org ? (
        <EditPositionForm
          position={position}
          organisations={organisations}
          issuerAccountId={org.hederaAccountAddress}
          onDone={(changed) => {
            setEditing(false);
            if (changed) {
              onChanged();
            }
          }}
        />
      ) : (
        <>
          {location !== "" && (
            <div style={{ fontSize: "13px", opacity: 0.75 }}>
              Location: {location}
              <span style={{ fontSize: "11px", opacity: 0.6 }}>
                {" "}
                (stored in the description — Position has no location field)
              </span>
            </div>
          )}
          {body !== "" && (
            <div style={{ opacity: 0.7, fontSize: "14px", whiteSpace: "pre-wrap" }}>{body}</div>
          )}

          {filters.length > 0 && (
            <div>
              <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "4px" }}>
                Requirement filters (all active filters must hold)
              </div>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "4px" }}>
                {filters.map((f, index) => (
                  <li
                    key={f.naturalLanguageCriteria}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      fontSize: "13px",
                      opacity: f.active ? 0.9 : 0.5,
                    }}
                  >
                    <span style={{ flex: "none", marginTop: "1px" }}>
                      {editable ? (
                        <Toggle
                          checked={f.active}
                          disabled={busy}
                          label={`Filter active: ${f.naturalLanguageCriteria}`}
                          onChange={() => void toggleFilter(index)}
                        />
                      ) : (
                        <Badge color={f.active ? tokens.color.success : tokens.color.textMuted}>
                          {f.active ? "active" : "inactive"}
                        </Badge>
                      )}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflowWrap: "anywhere",
                        textDecoration: f.active ? "none" : "line-through",
                      }}
                    >
                      {f.naturalLanguageCriteria}
                      {isLegacyWireFilter(f) && (
                        <span style={{ fontSize: "11px", color: tokens.color.warning }}>
                          {" "}
                          (legacy — not enforceable)
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {writeError && (
            <p style={{ color: tokens.color.danger, fontSize: "13px", margin: 0 }}>{writeError}</p>
          )}
        </>
      )}

      <dl style={fieldGridStyle}>
        <Field label="Effective" value={formatTime(position.effectiveTime)} />
        <Field label="Closes" value={formatTime(position.closingTime)} />
        <Field label="Created" value={formatTime(position.createTime)} />
        <Field label="Updated" value={formatTime(position.updateTime)} />
      </dl>

      {/* Provenance for the position, not something acted on from the card —
          the whole block collapses to one ⓘ. */}
      <HederaInfo title="On-chain">
        {org ? (
          <>
            <HederaRef
              kind="account"
              label="Issuer Hedera account"
              value={org.hederaAccountAddress}
            />
            {/* Public key only — the org's private_key never leaves the
                server, so it is not in this component's props at all. */}
            <HederaRef kind="key" label="Issuer public key" value={org.issuerPublicKey} />
          </>
        ) : (
          <div style={{ opacity: 0.55 }}>
            Posted by an organisation outside your memberships — issuer key not
            visible here.
          </div>
        )}
        {/* Every lifecycle transition is published to the shared HCS position
            topic; hcs_record back-links the row to its latest event. Absent
            only on positions created before the HCS wiring landed. */}
        {position.hcsRecord ? (
          <>
            <HederaRef
              kind="topic"
              label="HCS position topic"
              value={position.hcsRecord.topicId}
            />
            <HederaRef
              kind="topic-message"
              label="Latest event"
              value={position.hcsRecord.topicId}
              sequenceNumber={position.hcsRecord.latestSequenceNumber}
            />
          </>
        ) : (
          <div style={{ opacity: 0.5 }}>
            Not anchored to HCS — this position predates position events being
            published to the consensus topic.
          </div>
        )}
      </HederaInfo>

      <div>
        <button
          type="button"
          onClick={() => setShowProfiles((s) => !s)}
          style={smallButtonStyle}
        >
          {showProfiles ? "Hide eligible profiles" : "View eligible profiles"}
        </button>
        {showProfiles && (
          <div style={{ marginTop: "8px" }}>
            <EligibleProfiles positionName={position.name} />
          </div>
        )}
      </div>

      <div
        style={{
          opacity: 0.5,
          fontSize: "12px",
          fontFamily: "monospace",
          overflowWrap: "anywhere",
        }}
      >
        {position.name}
      </div>
    </li>
  );
}

function EditPositionForm({
  position,
  organisations,
  issuerAccountId,
  onDone,
}: {
  position: Position.AsObject;
  organisations: Organisation.AsObject[];
  /** The posting org's Hedera account id — default issuer for new filters. */
  issuerAccountId: string;
  onDone: (changed: boolean) => void;
}): React.ReactNode {
  const initial = splitDescription(position.description);
  const [title, setTitle] = useState(position.title);
  const [location, setLocation] = useState(initial.location);
  const [body, setBody] = useState(initial.body);
  const [drafts, setDrafts] = useState<DraftFilter[]>(() =>
    (position.requirements?.filtersList ?? []).map(draftFromWire),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const originalFilters: WireFilter[] = position.requirements?.filtersList ?? [];
  const newDescription = composeDescription(location, body);
  // The label is derived from the predicate, so comparing labels compares
  // predicates — every field of both predicate types appears in the label.
  const filtersChanged =
    drafts.length !== originalFilters.length ||
    drafts.some(
      (d, i) =>
        draftLabel(d) !== originalFilters[i].naturalLanguageCriteria ||
        d.active !== originalFilters[i].active,
    );
  const titleChanged = title.trim() !== position.title;
  const descriptionChanged = newDescription !== position.description;
  const anyChange = titleChanged || descriptionChanged || filtersChanged;

  const valid =
    title.trim() !== "" &&
    drafts.length > 0 &&
    drafts.every(draftIsValid) &&
    !draftsHaveDuplicates(drafts);

  async function save(): Promise<void> {
    setSaving(true);
    setSaveError(null);
    try {
      await updatePosition(position, {
        ...(titleChanged ? { title: title.trim() } : {}),
        ...(descriptionChanged ? { description: newDescription } : {}),
        // Any filter change (add/remove/edit/toggle) resends the whole list.
        ...(filtersChanged ? { filters: drafts.map(draftToProto) } : {}),
      });
      onDone(true);
    } catch (err: unknown) {
      setSaveError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "8px" }}>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        style={editInputStyle}
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location (stored in the description)"
        style={editInputStyle}
      />
      <input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Description"
        style={editInputStyle}
      />
      <div style={{ fontSize: "12px", opacity: 0.6 }}>Requirement filters</div>
      <FilterBuilder
        drafts={drafts}
        onChange={setDrafts}
        organisations={organisations}
        defaultIssuer={issuerAccountId}
        disabled={saving}
      />
      {drafts.length === 0 && (
        <p style={{ color: tokens.color.warning, fontSize: "12px", margin: 0 }}>
          A position needs at least one filter.
        </p>
      )}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          disabled={saving || !anyChange || !valid}
          onClick={() => void save()}
          style={{
            ...smallButtonStyle,
            fontWeight: 600,
            opacity: saving || !anyChange || !valid ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onDone(false)}
          style={smallButtonStyle}
        >
          Cancel
        </button>
      </div>
      {saveError && (
        <p style={{ color: tokens.color.danger, fontSize: "13px", margin: 0 }}>{saveError}</p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }): React.ReactNode {
  return (
    <div>
      <dt style={{ opacity: 0.55, fontSize: "12px" }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: "13px", opacity: 0.85 }}>{value}</dd>
    </div>
  );
}

const fieldGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: "8px",
  margin: 0,
} as const;

const smallButtonStyle = {
  background: tokens.color.surface,
  border: `${tokens.border.default} solid ${tokens.color.border}`,
  borderRadius: "8px",
  padding: "5px 10px",
  color: "inherit",
  font: "inherit",
  fontSize: "12px",
  cursor: "pointer",
} as const;

const editInputStyle = {
  background: tokens.color.surface,
  border: `${tokens.border.default} solid ${tokens.color.border}`,
  borderRadius: "8px",
  padding: "8px 10px",
  color: "inherit",
  font: "inherit",
  fontSize: "13px",
} as const;
