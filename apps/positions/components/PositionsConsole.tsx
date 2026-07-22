"use client";

import { useState } from "react";

import { CreatePosition } from "@/components/CreatePosition";
import { PositionsList } from "@/components/PositionsList";

/**
 * Signed-in console body: post a position, see it appear in the list. The
 * refresh counter is the only state shared between the two — everything else
 * is fetched from the backend on each load (spec §1: sites own no domain
 * state).
 */
export function PositionsConsole(): React.ReactNode {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <section>
        <h2 style={{ fontSize: "15px", margin: "0 0 10px", opacity: 0.75 }}>
          Post a position
        </h2>
        <CreatePosition onCreated={() => setRefreshToken((n) => n + 1)} />
      </section>

      <section>
        <h2 style={{ fontSize: "15px", margin: "0 0 10px", opacity: 0.75 }}>
          Open positions
        </h2>
        <PositionsList refreshToken={refreshToken} />
      </section>
    </div>
  );
}
