"use client";

import { useEffect, useState } from "react";

import { Button, HederaRef, siteThemes, tokens } from "@attestant/ui";
import { SearchProfilesRequest, SearchProfilesResponse } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_pb";

import { mirrorClient } from "@/lib/clients";
import { errorMessage } from "@/lib/grpcError";
import { useBoundedPoll } from "@/lib/useBoundedPoll";

type ProfileRow = SearchProfilesResponse.ProfileEligibility.AsObject;

type ProfilesState =
  | { phase: "pending" }
  | { phase: "error"; message: string }
  | { phase: "ready"; profiles: ProfileRow[] };

/**
 * Org-side matching (feature-list §2.5): who qualifies for this position?
 *
 * Calls MirrorService.SearchProfiles — PositionsService.SearchProfiles
 * returns Unimplemented (impl spec §6.2), so the profiles-v1 mirror is the
 * working matcher. The mirror trails consensus by a few seconds, so the
 * first read after a write polls with a bounded ceiling and a pending state.
 */
export function EligibleProfiles({
  positionName,
}: {
  positionName: string;
}): React.ReactNode {
  const [state, setState] = useState<ProfilesState>({ phase: "pending" });

  const { state: pollState, start } = useBoundedPoll(
    async () => {
      const req = new SearchProfilesRequest();
      req.setPosition(positionName);
      try {
        const res = await mirrorClient.searchProfiles(req, {});
        setState({ phase: "ready", profiles: res.toObject().profilesList });
        return true;
      } catch (err: unknown) {
        setState({ phase: "error", message: errorMessage(err) });
        // Keep polling inside the ceiling: right after a create the mirror
        // may not have seen the position yet (impl spec §6.4).
        return false;
      }
    },
    { intervalMs: 5_000, timeoutMs: 60_000 },
  );

  useEffect(() => {
    start();
  }, [start]);

  if (state.phase === "pending" || (state.phase === "error" && pollState === "pending")) {
    return <p style={{ opacity: 0.7, fontSize: "13px" }}>Checking the mirror for matching profiles…</p>;
  }
  if (state.phase === "error") {
    return (
      <div style={{ fontSize: "13px" }}>
        <p style={{ color: tokens.color.danger, margin: "0 0 6px" }}>
          Could not fetch eligible profiles from the mirror: {state.message}
        </p>
        <button type="button" onClick={start} style={smallButtonStyle}>
          Retry
        </button>
      </div>
    );
  }

  const eligible = state.profiles.filter((p) => p.eligible);

  return (
    <div style={{ display: "grid", gap: "8px", fontSize: "13px" }}>
      {/* Caveat, no longer surfaced in the UI (impl spec §4.3): the deployed
          matcher enforces the fixed XP + Reputation predicate from the
          position's org regardless of the configured filter text or active
          flags. Filters persist and toggle, but do not change this answer
          until a filter-compiling matcher lands backend-side. */}
      {eligible.length === 0 ? (
        <p style={{ margin: 0, opacity: 0.7 }}>
          No profiles currently satisfy this position&apos;s predicate.
          {state.profiles.length > 0 &&
            ` (${state.profiles.length} profile${state.profiles.length === 1 ? "" : "s"} checked.)`}{" "}
          Newly issued credentials can take a little while to reach the
          mirror.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "6px" }}>
          {eligible.map((profile) => (
            <li
              key={profile.hederaAccountAddress || profile.user}
              style={{
                border: `${tokens.border.default} solid ${tokens.color.border}`,
                borderRadius: "8px",
                padding: "8px 10px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {/* The candidate's account address stays inline: it is the only
                  handle on this person, and it is there to be copied. */}
              <div style={{ fontFamily: "monospace", fontSize: "12px", opacity: 0.85, minWidth: 0 }}>
                <div>{profile.user || "unknown user"}</div>
                <HederaRef
                  kind="account"
                  label={null}
                  value={profile.hederaAccountAddress}
                />
              </div>
              {/* Dummy by design (feature-list §2.5): renders, clickable,
                  does nothing. No invite/notification flow in this POC.
                  Styled as the accent-filled primary action, symmetric with
                  the Profile Console's "Apply". */}
              <Button
                tone={siteThemes.positions.accent}
                onClick={() => undefined}
                style={{ marginLeft: "auto", padding: "8px 16px", fontSize: "13px" }}
              >
                Invite for interview
              </Button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" onClick={start} style={{ ...smallButtonStyle, justifySelf: "start" }}>
        Refresh
      </button>
    </div>
  );
}

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
