"use client";

import { useEffect, useState } from "react";

import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import { PositionsServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_grpc_web_pb";
import {
  ListPositionsRequest,
  Position,
  PositionState,
  PositionView,
} from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_pb";

// Same pattern as the alis console apps: grpc-web PromiseClient pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route.
const positionsClient = new PositionsServicePromiseClient("/api/grpc");

/**
 * AIP-159 wildcard parent: lists positions across every organisation the
 * caller can see. A real console would scope this to the signed-in user's
 * organisation once organisation selection exists.
 */
const ALL_ORGANISATIONS = "organisations/-";

const PAGE_SIZE = 20;

/**
 * The proxy answers status 16 with this message when the session cookie is
 * missing or unusable, and clears the cookie on that same response — so a
 * reload lands on the signed-out page.
 */
function isSessionError(message: string): boolean {
  return message.includes("no session");
}

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

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; positions: Position.AsObject[] };

interface PositionsListProps {
  /**
   * The signed-in user's organisations — used to show the Hedera identity
   * behind positions posted by an organisation the user belongs to.
   */
  organisations: Organisation.AsObject[];
  /** Bump to reload the list, e.g. after posting a new position. */
  refreshToken?: number;
}

export function PositionsList({
  organisations,
  refreshToken = 0,
}: PositionsListProps): React.ReactNode {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    setState({ phase: "loading" });

    const req = new ListPositionsRequest();
    req.setParent(ALL_ORGANISATIONS);
    req.setPageSize(PAGE_SIZE);
    // The default (BASIC) view strips everything except name and etag —
    // FULL is required to get title, description, state, times and
    // requirements back (positions.go viewMask).
    req.setView(PositionView.POSITION_VIEW_FULL);

    positionsClient
      .listPositions(req, {})
      .then((res) =>
        setState({
          phase: "ready",
          positions: res.toObject().positionsList,
        }),
      )
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setState({ phase: "error", message });
      });
  }, [refreshToken]);

  if (state.phase === "loading") {
    return <p style={{ opacity: 0.7 }}>Loading positions…</p>;
  }
  if (state.phase === "error") {
    if (isSessionError(state.message)) {
      return (
        <p style={{ color: "#fca5a5" }}>
          Your session is not valid for this app.{" "}
          <a href="/auth/signin" style={{ color: "inherit" }}>
            Sign in again
          </a>
          .
        </p>
      );
    }
    return (
      <p style={{ color: "#fca5a5" }}>
        Could not fetch positions from the positions service: {state.message}
      </p>
    );
  }
  if (state.positions.length === 0) {
    return <p style={{ opacity: 0.7 }}>No positions have been posted yet.</p>;
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "12px" }}>
      {state.positions.map((position) => (
        <PositionCard
          key={position.name}
          position={position}
          organisations={organisations}
        />
      ))}
    </ul>
  );
}

function PositionCard({
  position,
  organisations,
}: {
  position: Position.AsObject;
  organisations: Organisation.AsObject[];
}): React.ReactNode {
  const stateInfo = STATE_LABELS[position.state] ?? STATE_LABELS[0];
  // "organisations/{org}/positions/{position}" → the owning organisation, if
  // it is one of the signed-in user's.
  const org = organisations.find((o) => position.name.startsWith(`${o.name}/`));
  const activeFilters =
    position.requirements?.filtersList.filter((f) => f.active) ?? [];

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
      </div>

      {position.description && (
        <div style={{ opacity: 0.7, fontSize: "14px" }}>{position.description}</div>
      )}

      {activeFilters.length > 0 && (
        <div>
          <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "2px" }}>
            Requirements
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", opacity: 0.8, fontSize: "13px" }}>
            {activeFilters.map((f) => (
              <li key={f.naturalLanguageCriteria}>{f.naturalLanguageCriteria}</li>
            ))}
          </ul>
        </div>
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
        {/* Honest about the current backend: position events are not yet
            published to HCS (positions service TODO), so there is no topic /
            sequence number to show for the position record itself. */}
        <div style={{ opacity: 0.5, marginTop: "4px" }}>
          Position record not yet anchored to HCS — the backend does not publish
          position events to a consensus topic yet. Requirement matching runs
          against HCS-anchored credentials issued by the organisation above.
        </div>
      </div>

      <div style={{ opacity: 0.5, fontSize: "12px", fontFamily: "monospace" }}>
        {position.name}
      </div>
    </li>
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
