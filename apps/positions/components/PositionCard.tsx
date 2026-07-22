"use client";

import { useState } from "react";

import * as fieldMaskPb from "google-protobuf/google/protobuf/field_mask_pb";

import { parseFilterCriteria } from "@attestant/filter-spec";
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
  draftCriteria,
  draftFromWire,
  draftIsValid,
  draftsHaveDuplicates,
  FilterBuilder,
  type DraftFilter,
} from "@/components/FilterBuilder";
import { Badge, Toggle } from "@/components/primitives";
import { positionsClient } from "@/lib/clients";
import { errorMessage } from "@/lib/grpcError";
import { composeDescription, splitDescription } from "@/lib/location";

const STATE_LABELS: Record<PositionState, { label: string; color: string }> = {
  [PositionState.POSITION_STATE_UNSPECIFIED]: { label: "Unknown", color: "#94a3b8" },
  [PositionState.POSITION_STATE_OPEN]: { label: "Open", color: "#86efac" },
  [PositionState.POSITION_STATE_REVOKED]: { label: "Revoked", color: "#fca5a5" },
  [PositionState.POSITION_STATE_FULFILLED]: { label: "Fulfilled", color: "#93c5fd" },
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

function filtersToRequirements(
  filters: readonly { criteria: string; active: boolean }[],
): Requirements {
  const requirements = new Requirements();
  requirements.setFiltersList(
    filters.map(({ criteria, active }) => {
      const filter = new Filter();
      filter.setNaturalLanguageCriteria(criteria);
      filter.setActive(active);
      return filter;
    }),
  );
  return requirements;
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
    filters?: readonly { criteria: string; active: boolean }[];
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
    // §2.6: flipping `active` is independent of the filter's configuration —
    // flip the bool, keep the string, resend the whole list.
    setBusy(true);
    setWriteError(null);
    try {
      await updatePosition(position, {
        filters: filters.map((f, i) => ({
          criteria: f.naturalLanguageCriteria,
          active: i === index ? !f.active : f.active,
        })),
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
        border: "1px solid rgba(252, 165, 165, 0.25)",
        borderRadius: "10px",
        padding: "12px 14px",
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
          orgName={org.name}
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
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      opacity: f.active ? 0.9 : 0.5,
                    }}
                  >
                    {editable ? (
                      <Toggle
                        checked={f.active}
                        disabled={busy}
                        label={`Filter active: ${f.naturalLanguageCriteria}`}
                        onChange={() => void toggleFilter(index)}
                      />
                    ) : (
                      <Badge color={f.active ? "#86efac" : "#94a3b8"}>
                        {f.active ? "active" : "inactive"}
                      </Badge>
                    )}
                    <span style={{ textDecoration: f.active ? "none" : "line-through" }}>
                      {f.naturalLanguageCriteria}
                    </span>
                    {parseFilterCriteria(f.naturalLanguageCriteria) === null && (
                      <span style={{ fontSize: "11px", opacity: 0.6 }}>(raw text)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {writeError && (
            <p style={{ color: "#fca5a5", fontSize: "13px", margin: 0 }}>{writeError}</p>
          )}
        </>
      )}

      <dl style={fieldGridStyle}>
        <Field label="Effective" value={formatTime(position.effectiveTime)} />
        <Field label="Closes" value={formatTime(position.closingTime)} />
        <Field label="Created" value={formatTime(position.createTime)} />
        <Field label="Updated" value={formatTime(position.updateTime)} />
      </dl>

      <div
        style={{
          borderTop: "1px solid rgba(252, 165, 165, 0.15)",
          paddingTop: "8px",
          fontSize: "12px",
        }}
      >
        <div style={{ opacity: 0.6, marginBottom: "2px" }}>On-chain</div>
        {org ? (
          <div style={{ fontFamily: "monospace", opacity: 0.75 }}>
            <div>Issuer Hedera account: {org.hederaAccountAddress || "—"}</div>
            <div style={{ overflowWrap: "anywhere" }}>
              Issuer public key: {org.issuerPublicKey || "—"}
            </div>
          </div>
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
          <div style={{ fontFamily: "monospace", opacity: 0.75, marginTop: "4px" }}>
            <div>HCS position topic: {position.hcsRecord.topicId}</div>
            <div>Latest event sequence: {position.hcsRecord.latestSequenceNumber}</div>
          </div>
        ) : (
          <div style={{ opacity: 0.5, marginTop: "4px" }}>
            Not anchored to HCS — this position predates position events being
            published to the consensus topic.
          </div>
        )}
      </div>

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

      <div style={{ opacity: 0.5, fontSize: "12px", fontFamily: "monospace" }}>
        {position.name}
      </div>
    </li>
  );
}

function EditPositionForm({
  position,
  organisations,
  orgName,
  onDone,
}: {
  position: Position.AsObject;
  organisations: Organisation.AsObject[];
  orgName: string;
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

  const originalFilters = position.requirements?.filtersList ?? [];
  const newDescription = composeDescription(location, body);
  const filtersChanged =
    drafts.length !== originalFilters.length ||
    drafts.some(
      (d, i) =>
        draftCriteria(d) !== originalFilters[i].naturalLanguageCriteria ||
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
        ...(filtersChanged
          ? {
              filters: drafts.map((d) => ({
                criteria: draftCriteria(d),
                active: d.active,
              })),
            }
          : {}),
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
        defaultIssuer={orgName}
        disabled={saving}
      />
      {drafts.length === 0 && (
        <p style={{ color: "#fcd34d", fontSize: "12px", margin: 0 }}>
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
        <p style={{ color: "#fca5a5", fontSize: "13px", margin: 0 }}>{saveError}</p>
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
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid #232a3a",
  borderRadius: "8px",
  padding: "5px 10px",
  color: "inherit",
  font: "inherit",
  fontSize: "12px",
  cursor: "pointer",
} as const;

const editInputStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid #232a3a",
  borderRadius: "8px",
  padding: "8px 10px",
  color: "inherit",
  font: "inherit",
  fontSize: "13px",
} as const;
