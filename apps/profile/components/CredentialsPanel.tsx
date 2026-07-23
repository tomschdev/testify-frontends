"use client";

import { useCallback, useEffect, useState } from "react";

import { Credential, ListCredentialsRequest, GetTokenRequest, ListTokenHoldingsRequest } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_pb";

import { HederaRef, siteThemes, tokens } from "@attestant/ui";

import { Badge, EmptyState, ErrorState, SectionHeader, buttonStyle } from "@/components/primitives";
import { errorMessage, isSessionError, mirrorClient } from "@/lib/clients";
import { useBoundedPoll } from "@/lib/useBoundedPoll";
import { useMyUser } from "@/lib/useMyUser";

const XP_TYPE = "xp_credential";
const REPUTATION_TYPE = "reputation_credential";

type CredentialsState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; credentials: Credential.AsObject[] };

interface TokenHoldingView {
  tokenId: string;
  balance: number;
  name: string;
  symbol: string;
  /** Hedera token type as the mirror reports it — see `isXpToken`. */
  type: string;
}

/**
 * XP is the only *fungible* thing a candidate holds (TECHNICAL.md §Hedera
 * assets): credentials are NonFungibleUnique collections, so every credential
 * held also shows up as a token holding of the platform's credential
 * collection — "Interface Reputation Credentials", balance 1. Those are the
 * same records already listed above as credentials, so they are excluded here
 * rather than doubled as XP.
 *
 * Spelling varies between the mirror REST form (`FUNGIBLE_COMMON`) and the
 * SDK's (`FungibleCommon`), so the comparison is normalised. A holding whose
 * type could not be read at all (GetToken failed — name and symbol are blank
 * too) is kept: hiding a real balance is worse than one unlabelled row.
 */
function isXpToken(type: string): boolean {
  const normalised = type.replace(/[^a-z]/gi, "").toUpperCase();
  if (normalised === "") return true;
  return normalised.includes("FUNGIBLE") && !normalised.includes("NONFUNGIBLE");
}

type TokensState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; holdings: TokenHoldingView[] };

function formatIssueTime(ts: { seconds: number; nanos: number } | undefined): string {
  if (!ts || ts.seconds === 0) return "—";
  return new Date(ts.seconds * 1000).toLocaleString();
}

/**
 * Credentials menu (§3.3–3.5): the signed-in user's held credentials and XP
 * token holdings, keyed off their Hedera account address. Session-gated by the
 * page; the RPCs themselves also refuse session-less calls at the proxy.
 */
export function CredentialsPanel(): React.ReactNode {
  const me = useMyUser();
  const [credentials, setCredentials] = useState<CredentialsState>({ phase: "loading" });
  const [tokens, setTokens] = useState<TokensState>({ phase: "loading" });
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const accountId = me.phase === "ready" ? me.user.hederaAccountAddress : "";

  const refresh = useCallback((): void => {
    if (!accountId) return;

    const credReq = new ListCredentialsRequest();
    credReq.setAccountId(accountId);
    mirrorClient
      .listCredentials(credReq, {})
      .then((res) => {
        setCredentials({ phase: "ready", credentials: res.toObject().credentialsList });
        setLastRefreshed(new Date());
      })
      .catch((err: unknown) => setCredentials({ phase: "error", message: errorMessage(err) }));

    const holdingsReq = new ListTokenHoldingsRequest();
    holdingsReq.setAccountId(accountId);
    mirrorClient
      .listTokenHoldings(holdingsReq, {})
      .then(async (res) => {
        const holdings = await Promise.all(
          res.toObject().holdingsList.map(async (h): Promise<TokenHoldingView> => {
            const tokenReq = new GetTokenRequest();
            tokenReq.setTokenId(h.tokenId);
            try {
              const token = (await mirrorClient.getToken(tokenReq, {})).toObject();
              return {
                tokenId: h.tokenId,
                balance: h.balance,
                name: token.name,
                symbol: token.symbol,
                type: token.type,
              };
            } catch {
              // Name/symbol are cosmetic; the holding itself is still real.
              return { tokenId: h.tokenId, balance: h.balance, name: "", symbol: "", type: "" };
            }
          }),
        );
        setTokens({ phase: "ready", holdings: holdings.filter((h) => isXpToken(h.type)) });
      })
      .catch((err: unknown) => setTokens({ phase: "error", message: errorMessage(err) }));
  }, [accountId]);

  // Mirror-node lag (impl spec §6.4): "Refresh" opens a bounded polling
  // window rather than a single refetch, so a just-issued credential shows as
  // arriving rather than absent.
  const poll = useBoundedPoll(refresh);

  useEffect(() => {
    if (accountId) refresh();
  }, [accountId, refresh]);

  if (me.phase === "loading") {
    return <p style={{ opacity: 0.7 }}>Loading your profile…</p>;
  }
  if (me.phase === "error") {
    if (isSessionError(me.message)) {
      return (
        <ErrorState>
          Your session is not valid for this app.{" "}
          <a href="/auth/signin" style={{ color: "inherit" }}>
            Sign in again
          </a>
          .
        </ErrorState>
      );
    }
    return <ErrorState>Could not load your user record: {me.message}</ErrorState>;
  }
  if (!accountId) {
    return (
      <ErrorState>
        Your account has no Hedera address yet, so there is nothing to look up
        on the mirror node.
      </ErrorState>
    );
  }

  const xp =
    credentials.phase === "ready"
      ? credentials.credentials.filter((c) => c.type === XP_TYPE)
      : [];
  const reputation =
    credentials.phase === "ready"
      ? credentials.credentials.filter((c) => c.type === REPUTATION_TYPE)
      : [];
  const other =
    credentials.phase === "ready"
      ? credentials.credentials.filter((c) => c.type !== XP_TYPE && c.type !== REPUTATION_TYPE)
      : [];

  return (
    <div style={{ display: "grid", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <button type="button" className="neo-interactive" style={buttonStyle} onClick={poll.polling ? poll.stop : poll.start}>
          {poll.polling ? "Stop auto-refresh" : "Refresh"}
        </button>
        <span style={{ fontSize: "12px", opacity: 0.6 }}>
          {poll.polling
            ? "Auto-refreshing every 10s for up to 2 minutes — the mirror node can trail a fresh issuance by a few seconds."
            : lastRefreshed
              ? `Last refreshed ${lastRefreshed.toLocaleTimeString()}`
              : ""}
        </span>
      </div>

      <section>
        <SectionHeader
          title="XP Credentials"
          aside={<Badge tone="accent">{`${xp.length} held`}</Badge>}
        />
        <CredentialList state={credentials} items={xp} emptyText="No XP credentials held yet." />
      </section>

      <section>
        <SectionHeader
          title="Reputation Credentials"
          aside={<Badge tone="accent">{`${reputation.length} held`}</Badge>}
        />
        <CredentialList
          state={credentials}
          items={reputation}
          emptyText="No reputation credentials held yet."
        />
      </section>

      {other.length > 0 && (
        <section>
          <SectionHeader title="Other credentials" />
          <CredentialList state={credentials} items={other} emptyText="" />
        </section>
      )}

      <section>
        <SectionHeader title="XP Tokens" />
        {tokens.phase === "loading" && <p style={{ opacity: 0.7 }}>Loading token holdings…</p>}
        {tokens.phase === "error" && (
          <ErrorState>Could not fetch token holdings from the mirror node: {tokens.message}</ErrorState>
        )}
        {tokens.phase === "ready" &&
          (tokens.holdings.length === 0 ? (
            <EmptyState>No XP tokens held.</EmptyState>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "8px" }}>
              {tokens.holdings.map((h) => (
                <li key={h.tokenId} style={rowStyle}>
                  <span style={{ fontWeight: 600 }}>
                    {h.name || h.tokenId}
                    {h.symbol ? ` (${h.symbol})` : ""}
                  </span>
                  <span style={{ fontFamily: "monospace" }}>{h.balance}</span>
                </li>
              ))}
            </ul>
          ))}
      </section>

      {/* Inline, not behind the ⓘ: this is the user's own account address,
          the thing they hand out and copy. */}
      <HederaRef kind="account" label="Hedera account" value={accountId} />
    </div>
  );
}

function CredentialList({
  state,
  items,
  emptyText,
}: {
  state: CredentialsState;
  items: Credential.AsObject[];
  emptyText: string;
}): React.ReactNode {
  if (state.phase === "loading") {
    return <p style={{ opacity: 0.7 }}>Loading credentials…</p>;
  }
  if (state.phase === "error") {
    return (
      <ErrorState>Could not fetch credentials from the mirror node: {state.message}</ErrorState>
    );
  }
  if (items.length === 0) {
    // Empty list ≠ error: the RPC answered and this account simply holds none.
    return <EmptyState>{emptyText}</EmptyState>;
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "8px" }}>
      {items.map((c, i) => (
        <li key={`${c.issuer}-${c.title}-${i}`} style={{ ...rowStyle, display: "grid", gap: "4px" }}>
          <span style={{ fontWeight: 600 }}>{c.title || "Untitled credential"}</span>
          <span style={{ fontSize: "13px", opacity: 0.7 }}>
            Issued by <span style={{ fontFamily: "monospace" }}>{c.issuer || "—"}</span> ·{" "}
            {formatIssueTime(c.issueTime)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const rowStyle: React.CSSProperties = {
  background: tokens.color.surface,
  border: `${tokens.border.default} solid ${siteThemes.profile.accent}`,
  borderRadius: tokens.radius.md,
  boxShadow: tokens.shadow.sm,
  padding: "10px 14px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: "12px",
};
