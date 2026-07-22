"use client";

import { useEffect, useState } from "react";

import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import {
  ListPositionsRequest,
  Position,
  PositionView,
} from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_pb";

import { PositionCard } from "@/components/PositionCard";
import { positionsClient } from "@/lib/clients";
import { errorMessage, isSessionError } from "@/lib/grpcError";

/**
 * AIP-159 wildcard parent: lists positions across every organisation the
 * caller can see. A real console would scope this to the signed-in user's
 * organisation once organisation selection exists.
 */
const ALL_ORGANISATIONS = "organisations/-";

const PAGE_SIZE = 20;

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; positions: Position.AsObject[] };

interface PositionsListProps {
  /**
   * The signed-in user's organisations — used to show the Hedera identity
   * behind positions posted by an organisation the user belongs to, and to
   * decide which positions offer the edit UI.
   */
  organisations: Organisation.AsObject[];
  /** Bump to reload the list, e.g. after posting a new position. */
  refreshToken?: number;
  /** Called after any in-card write (update/toggle) so the parent can bump. */
  onChanged: () => void;
}

export function PositionsList({
  organisations,
  refreshToken = 0,
  onChanged,
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
        setState({ phase: "error", message: errorMessage(err) });
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
          onChanged={onChanged}
        />
      ))}
    </ul>
  );
}
