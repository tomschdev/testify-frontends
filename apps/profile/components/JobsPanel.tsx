"use client";

import { useCallback, useEffect, useState } from "react";

import {
  ListCredentialsRequest,
  ListPositionsRequest,
  ListTokenHoldingsRequest,
  SearchProfilesRequest,
} from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_pb";
import { Position, PositionState } from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_pb";

import {
  CREDENTIAL_TYPE_LABELS,
  evaluateRequirements,
  type EvaluableCredential,
  type EvaluableTokenHolding,
  type EvaluationSubject,
  type FilterEvaluation,
} from "@attestant/filter-spec";
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

/**
 * What the signed-in user brings to the per-filter match explanation (§3.9):
 * their credentials and their token balances, fetched once per feed load.
 *
 * `resolveXpToken` is deliberately absent. An issuer's XP token is created
 * with memo `xp:<issuer account>`, but the mirror's `Token` exposes neither
 * memo nor treasury and there is no lookup-by-issuer RPC — the only record of
 * the mapping lives in the issuer console's localStorage. So XP-balance
 * filters evaluate to *unknown* here rather than to a wrong `false`. Wiring a
 * resolver in is a one-line change once a lookup exists.
 */
type SubjectState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; subject: EvaluationSubject };

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
  const [subject, setSubject] = useState<SubjectState>({ phase: "loading" });
  // Bumped by every feed load so the subject refetches alongside it — during
  // the demo a just-landed credential must be able to change the explanation.
  const [reloadKey, setReloadKey] = useState(0);

  const myAddress =
    hasSession && me.phase === "ready" ? me.user.hederaAccountAddress : "";

  const loadFeed = useCallback((): void => {
    setFeed({ phase: "loading" });
    // A fresh feed load re-runs the qualify checks too — during the demo a
    // just-landed credential must be able to flip the badge.
    setEligibility({});
    setReloadKey((k) => k + 1);

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

  // The user's own credentials and balances, for the §3.9 match explanation.
  // One fetch for the whole feed — the same subject is evaluated against every
  // position's filters.
  useEffect(() => {
    if (!myAddress) {
      return;
    }
    let cancelled = false;

    const credReq = new ListCredentialsRequest();
    credReq.setAccountId(myAddress);
    const holdingsReq = new ListTokenHoldingsRequest();
    holdingsReq.setAccountId(myAddress);

    Promise.all([
      mirrorClient.listCredentials(credReq, {}),
      mirrorClient.listTokenHoldings(holdingsReq, {}),
    ])
      .then(([credRes, holdingsRes]) => {
        if (cancelled) return;
        const credentials: EvaluableCredential[] = credRes
          .toObject()
          .credentialsList.map((c) => ({ type: c.type, issuer: c.issuer }));
        const holdings: EvaluableTokenHolding[] = holdingsRes
          .toObject()
          .holdingsList.map((h) => ({ tokenId: h.tokenId, balance: h.balance }));
        setSubject({ phase: "ready", subject: { credentials, holdings } });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSubject({ phase: "error", message: errorMessage(err) });
      });

    return () => {
      cancelled = true;
    };
  }, [myAddress, reloadKey]);

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
                subject={subject}
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

/**
 * The §3.9 match explanation for one filter, rendered from the predicate's
 * structure rather than from its label.
 */
function FilterExplanation({
  evaluation,
}: {
  evaluation: FilterEvaluation;
}): React.ReactNode {
  const { text, tone } = explain(evaluation);
  return (
    <li style={{ marginBottom: "2px" }}>
      <span>{evaluation.criteria}</span>
      {/* A filter with nothing to report shows its criteria alone. */}
      {text !== null && (
        <span
          style={{
            display: "block",
            fontSize: "12px",
            color:
              tone === "positive"
                ? tokens.color.success
                : tone === "negative"
                  ? tokens.color.danger
                  : tokens.color.textMuted,
          }}
        >
          {text}
        </span>
      )}
    </li>
  );
}

function explain(evaluation: FilterEvaluation): {
  /** `null` when there is nothing to say — the caller renders no line. */
  text: string | null;
  tone: "positive" | "negative" | "neutral";
} {
  switch (evaluation.kind) {
    case "credentialCount": {
      const label = CREDENTIAL_TYPE_LABELS[evaluation.spec.credentialType];
      const noun = evaluation.required === 1 ? label : `${label}s`;
      return {
        text: `You hold ${evaluation.held} of ${evaluation.required} required ${noun} from ${evaluation.spec.issuer}.`,
        tone: evaluation.satisfied ? "positive" : "negative",
      };
    }
    case "xpBalance":
      if (evaluation.balance === null) {
        // Unknown, not false: no issuer → XP-token lookup exists yet (see
        // SubjectState). The criteria line stands on its own rather than
        // explaining the gap to the candidate.
        return { text: null, tone: "neutral" };
      }
      return {
        text: `Your XP balance from ${evaluation.spec.issuer} is ${evaluation.balance} of ${evaluation.required} required.`,
        tone: evaluation.satisfied ? "positive" : "negative",
      };
    case "legacy":
      return {
        text: "Legacy filter — stored before filters carried structure, so it cannot be checked or enforced.",
        tone: "neutral",
      };
  }
}

function PositionCard({
  position,
  signedIn,
  eligibility,
  subject,
}: {
  position: Position.AsObject;
  signedIn: boolean;
  eligibility: Eligibility | undefined;
  subject: SubjectState;
}): React.ReactNode {
  const stateInfo = STATE_LABELS[position.state] ?? STATE_LABELS[0];
  const allFilters = position.requirements?.filtersList ?? [];
  const activeFilters = allFilters.filter((f) => f.active);
  // Evaluated only when signed in and the subject loaded; otherwise the
  // requirements render as plain labels, as they did before.
  const evaluation =
    signedIn && subject.phase === "ready"
      ? evaluateRequirements(activeFilters, subject.subject)
      : null;

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
          <ul style={{ margin: 0, paddingLeft: "18px", opacity: 0.85, fontSize: "13px" }}>
            {evaluation
              ? evaluation.filters.map((f) => (
                  <FilterExplanation key={f.criteria} evaluation={f} />
                ))
              : activeFilters.map((f) => (
                  <li key={f.naturalLanguageCriteria}>{f.naturalLanguageCriteria}</li>
                ))}
          </ul>
          {signedIn && subject.phase === "error" && (
            <div style={{ fontSize: "12px", color: tokens.color.textMuted }}>
              Could not load your credentials, so these are shown unchecked:{" "}
              {subject.message}
            </div>
          )}
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
        >
          Apply
        </button>
      </div>

      <div style={{ opacity: 0.5, fontSize: "12px", fontFamily: "monospace" }}>{position.name}</div>
    </li>
  );
}
