"use client";

import { useEffect, useState } from "react";

import { PositionsServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_grpc_web_pb";
import {
  ListPositionsRequest,
  Position,
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

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; positions: Position.AsObject[] };

interface PositionsListProps {
  /** Bump to reload the list, e.g. after posting a new position. */
  refreshToken?: number;
}

export function PositionsList({ refreshToken = 0 }: PositionsListProps): React.ReactNode {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    setState({ phase: "loading" });

    const req = new ListPositionsRequest();
    req.setParent(ALL_ORGANISATIONS);
    req.setPageSize(PAGE_SIZE);

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
        <li
          key={position.name}
          style={{
            border: "1px solid rgba(252, 165, 165, 0.25)",
            borderRadius: "10px",
            padding: "12px 14px",
          }}
        >
          <div style={{ fontWeight: 600 }}>{position.title}</div>
          <div style={{ opacity: 0.7, fontSize: "14px", marginTop: "4px" }}>
            {position.description}
          </div>
          {position.requirements && position.requirements.filtersList.length > 0 && (
            <ul
              style={{
                margin: "6px 0 0",
                paddingLeft: "18px",
                opacity: 0.7,
                fontSize: "13px",
              }}
            >
              {position.requirements.filtersList
                .filter((f) => f.active)
                .map((f) => (
                  <li key={f.naturalLanguageCriteria}>{f.naturalLanguageCriteria}</li>
                ))}
            </ul>
          )}
          <div style={{ opacity: 0.5, fontSize: "12px", fontFamily: "monospace", marginTop: "6px" }}>
            {position.name}
          </div>
        </li>
      ))}
    </ul>
  );
}
