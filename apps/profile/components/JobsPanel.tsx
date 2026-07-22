"use client";

import { useCallback, useEffect, useState } from "react";

import { ListPositionsRequest, SearchProfilesRequest } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_pb";
import { Position, PositionState } from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_pb";

import { siteThemes, tokens } from "@attestant/ui";

import { Badge, EmptyState, ErrorState, SectionHeader, buttonStyle } from "@/components/primitives";
import { errorMessage, mirrorClient } from "@/lib/clients";
import { useMyUser } from "@/lib/useMyUser";

const PAGE_SIZE = 50;

type FeedState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; positions: Position.AsObject[] };

/**
 * One entry per position resource name — computed once per feed load, never
 * refired on render (brief §3.8). "absent" means the user did not appear in
 * the SearchProfiles response, which the backend produces only for accounts
 * that hold at least one credential from the issuing org — treated as not
 * eligible.
 */
type Eligibility =
  | { phase: "checking" }
  | { phase: "done"; eligible: boolean }
  | { phase: "error"; message: string };

const STATE_LABELS: Record<PositionState, { label: string; tone: "positive" | "negative" | "neutral" }> = {
  [PositionState.POSITION_STATE_UNSPECIFIED]: { label: "Unknown", tone: "neutral" },
  [PositionState.POSITION_STATE_OPEN]: { label: "Open", tone: "positive" },
  [PositionState.POSITION_STATE_REVOKED]: { label: "Revoked", tone: "negative" },
  [PositionState.POSITION_STATE_FULFILLED]: { label: "Fulfilled", tone: "neutral" },
};

/**
 * Jobs menu (§3.6–3.10). The feed itself is public — `ListPositions` is the
 * one method the proxy serves without a session (SA-backed, impl spec §6.1).
 * The qualify check is signed-in only: it needs the user's Hedera address to
 * find their row in `SearchProfiles`.
 */
export function JobsPanel({ hasSession }: { hasSession: boolean }): React.ReactNode {
  const me = useMyUser(hasSession);
  const [feed, setFeed] = useState<FeedState>({ phase: "loading" });
  const [eligibility, setEligibility] = useState<Record<string, Eligibility>>({});
  const [qualifiedOnly, setQualifiedOnly] = useState(false);

  const myAddress =
    hasSession && me.phase === "ready" ? me.user.hederaAccountAddress : "";

  const loadFeed = useCallback((): void => {
    setFeed({ phase: "loading" });
    // A fresh feed load re-runs the qualify checks too — during the demo a
    // just-landed credential must be able to flip the badge.
    setEligibility({});

    const req = new ListPositionsRequest();
    req.setPageSize(PAGE_SIZE);
    mirrorClient
      .listPositions(req, {})
      .then((res) => setFeed({ phase: "ready", positions: res.toObject().positionsList }))
      .catch((err: unknown) => setFeed({ phase: "error", message: errorMessage(err) }));
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Qualification check (§3.8): one SearchProfiles call per position in the
  // feed, cached per position name in `eligibility`.
  useEffect(() => {
    if (!myAddress || feed.phase !== "ready") return;

    const unchecked = feed.positions.filter((p) => !(p.name in eligibility));
    if (unchecked.length === 0) return;

    setEligibility((prev) => {
      const next = { ...prev };
      for (const p of unchecked) next[p.name] = { phase: "checking" };
      return next;
    });

    for (const position of unchecked) {
      const req = new SearchProfilesRequest();
      req.setPosition(position.name);
      mirrorClient
        .searchProfiles(req, {})
        .then((res) => {
          const mine = res
            .toObject()
            .profilesList.find((p) => p.hederaAccountAddress === myAddress);
          setEligibility((prev) => ({
            ...prev,
            [position.name]: { phase: "done", eligible: mine?.eligible ?? false },
          }));
        })
        .catch((err: unknown) => {
          setEligibility((prev) => ({
            ...prev,
            [position.name]: { phase: "error", message: errorMessage(err) },
          }));
        });
    }
  }, [myAddress, feed, eligibility]);

  const visiblePositions =
    feed.phase === "ready"
      ? qualifiedOnly
        ? feed.positions.filter((p) => {
            // Computed live from the §3.8 results, never a stored boolean.
            const e = eligibility[p.name];
            return e?.phase === "done" && e.eligible;
          })
        : feed.positions
      : [];

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <SectionHeader
        title="Job feed"
        aside={
          <button type="button" className="neo-interactive" style={buttonStyle} onClick={loadFeed}>
            Refresh
          </button>
        }
      />

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "14px",
            opacity: hasSession ? 1 : 0.5,
            cursor: hasSession ? "pointer" : "not-allowed",
          }}
        >
          <input
            type="checkbox"
            checked={qualifiedOnly}
            disabled={!hasSession}
            onChange={(e) => setQualifiedOnly(e.target.checked)}
          />
          Jobs I qualify for
        </label>
        {!hasSession && (
          <span style={{ fontSize: "13px", opacity: 0.6 }}>
            <a href="/auth/signin" style={{ color: "inherit" }}>
              Sign in
            </a>{" "}
            to see which jobs you qualify for.
          </span>
        )}
      </div>

      {feed.phase === "loading" && <p style={{ opacity: 0.7 }}>Loading positions…</p>}
      {feed.phase === "error" && (
        <ErrorState>Could not fetch the job feed: {feed.message}</ErrorState>
      )}
      {feed.phase === "ready" &&
        (feed.positions.length === 0 ? (
          <EmptyState>No positions have been posted yet.</EmptyState>
        ) : visiblePositions.length === 0 ? (
          <EmptyState>
            None of the current positions match your held credentials yet.
          </EmptyState>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "12px" }}>
            {visiblePositions.map((position) => (
              <PositionCard
                key={position.name}
                position={position}
                signedIn={Boolean(myAddress)}
                eligibility={eligibility[position.name]}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}

function QualifyBadge({
  signedIn,
  eligibility,
}: {
  signedIn: boolean;
  eligibility: Eligibility | undefined;
}): React.ReactNode {
  if (!signedIn) return null;
  if (!eligibility || eligibility.phase === "checking") {
    return <Badge tone="neutral">Checking…</Badge>;
  }
  if (eligibility.phase === "error") {
    return <Badge tone="neutral">Check failed</Badge>;
  }
  return eligibility.eligible ? (
    <Badge tone="positive">You qualify</Badge>
  ) : (
    <Badge tone="negative">You don&rsquo;t qualify</Badge>
  );
}

function PositionCard({
  position,
  signedIn,
  eligibility,
}: {
  position: Position.AsObject;
  signedIn: boolean;
  eligibility: Eligibility | undefined;
}): React.ReactNode {
  const stateInfo = STATE_LABELS[position.state] ?? STATE_LABELS[0];
  const activeFilters = position.requirements?.filtersList.filter((f) => f.active) ?? [];

  return (
    <li
      style={{
        background: tokens.color.surface,
        border: `${tokens.border.default} solid ${siteThemes.profile.accent}`,
        borderRadius: tokens.radius.md,
        boxShadow: tokens.shadow.sm,
        padding: "14px 16px",
        display: "grid",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span style={{ fontWeight: 600, fontSize: "15px" }}>
          {position.title || "Untitled position"}
        </span>
        <Badge tone={stateInfo.tone}>{stateInfo.label}</Badge>
        <QualifyBadge signedIn={signedIn} eligibility={eligibility} />
      </div>

      {position.description && (
        <div style={{ opacity: 0.7, fontSize: "14px" }}>{position.description}</div>
      )}

      {activeFilters.length > 0 && (
        <div>
          <div style={{ fontSize: "12px", opacity: 0.6, marginBottom: "2px" }}>Requirements</div>
          {/* TODO(shared): once the FilterSpec parser/evaluator lands in
              packages/ (owned by the Positions sprint), evaluate these against
              the user's ListCredentials data for the §3.9 match explanation.
              Until then filters render as the raw criteria text. */}
          <ul style={{ margin: 0, paddingLeft: "18px", opacity: 0.8, fontSize: "13px" }}>
            {activeFilters.map((f) => (
              <li key={f.naturalLanguageCriteria}>{f.naturalLanguageCriteria}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Dummy by explicit decision (§3.10) — symmetric to the Positions
            Console's "Invite for interview". No application flow exists. */}
        <button
          type="button"
          className="neo-interactive"
          style={{ ...buttonStyle, background: siteThemes.profile.accent, color: tokens.color.ink }}
          onClick={() => undefined}
          title="Demo only — applications are not wired up yet"
        >
          Apply
        </button>
        <span style={{ fontSize: "11px", opacity: 0.45 }}>Demo only</span>
      </div>

      <div style={{ opacity: 0.5, fontSize: "12px", fontFamily: "monospace" }}>{position.name}</div>
    </li>
  );
}
