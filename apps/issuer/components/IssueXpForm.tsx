"use client";

import { useState } from "react";

import { MirrorServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_grpc_web_pb";
import {
  GetHederaAccountRequest,
  ListTokenHoldingsRequest,
} from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_pb";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  HederaInfo,
  HederaRef,
  Input,
  siteThemes,
  tokens,
  useBoundedPoll,
  type BadgeTone,
} from "@attestant/ui";

import type { StoredXpToken } from "@/lib/xpTokenStore";

// Same pattern as the alis console apps: grpc-web PromiseClient pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route.
const mirrorClient = new MirrorServicePromiseClient("/api/grpc");

/** One XP transfer from this session, built from the submit receipt. */
export interface XpIssuance {
  key: string;
  tokenId: string;
  tokenSymbol: string;
  recipient: string;
  amount: number;
  /**
   * The recipient's balance of this token read just before submitting, so the
   * confirmation poll can look for `baseline + amount` rather than "any
   * balance" — a second issuance to the same candidate must not confirm off
   * the first one's balance. Null when the pre-read failed: with no "before",
   * a balance on the mirror proves nothing about *this* grant, so the entry
   * stays "Unverified" rather than claiming a confirmation it cannot show.
   */
  baselineBalance: number | null;
  issuedAtMs: number;
}

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  // No baseline to compare against — see XpIssuance.baselineBalance.
  idle: { label: "Unverified", tone: "neutral" },
  pending: { label: "Pending", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  timeout: { label: "Unconfirmed", tone: "danger" },
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function readBalance(accountId: string, tokenId: string): Promise<number | null> {
  try {
    const req = new ListTokenHoldingsRequest();
    req.setAccountId(accountId);
    const res = await mirrorClient.listTokenHoldings(req, {});
    const holding = res.getHoldingsList().find((h) => h.getTokenId() === tokenId);
    return holding ? holding.getBalance() : 0;
  } catch {
    return null;
  }
}

/**
 * Recipient resolution mirrors the credential form: one account-id input,
 * checked against MirrorService.GetHederaAccount on blur so typos surface
 * before issuance rather than as a chain-level failure after it.
 */
type RecipientState =
  | { phase: "unresolved" }
  | { phase: "resolving" }
  | { phase: "resolved"; accountId: string }
  | { phase: "error"; message: string };

interface IssueXpFormProps {
  /** Organisation resource name — the issuing identity. */
  organisation: string;
  /** The org's XP token, from local custody. */
  token: StoredXpToken;
  /** Called when the stored token id turns out not to belong to this issuer. */
  onTokenMismatch: (message: string) => void;
}

/**
 * XP issuance (§1.8). The amount is a positive integer — the token has zero
 * decimals — and what lands is soulbound: the recipient's relationship to the
 * token is frozen after delivery, so this is a one-way grant.
 */
export function IssueXpForm({
  organisation,
  token,
  onTokenMismatch,
}: IssueXpFormProps): React.ReactNode {
  const [accountId, setAccountId] = useState("");
  const [recipient, setRecipient] = useState<RecipientState>({ phase: "unresolved" });
  const [amount, setAmount] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issued, setIssued] = useState<XpIssuance[]>([]);

  const parsedAmount = Number(amount.trim());
  const amountValid =
    amount.trim() !== "" && Number.isSafeInteger(parsedAmount) && parsedAmount > 0;

  async function resolveRecipient(): Promise<void> {
    const id = accountId.trim();
    if (id === "" || (recipient.phase === "resolved" && recipient.accountId === id)) {
      return;
    }
    setRecipient({ phase: "resolving" });
    try {
      const req = new GetHederaAccountRequest();
      req.setAccountId(id);
      await mirrorClient.getHederaAccount(req, {});
      setRecipient({ phase: "resolved", accountId: id });
    } catch (err: unknown) {
      setRecipient({ phase: "error", message: errorMessage(err) });
    }
  }

  async function issue(): Promise<void> {
    if (recipient.phase !== "resolved" || !amountValid) return;
    setIssuing(true);
    setIssueError(null);

    // Read the balance first: the confirmation poll needs a "before" to
    // compare against (see XpIssuance.baselineBalance).
    const baselineBalance = await readBalance(recipient.accountId, token.tokenId);

    try {
      const res = await fetch("/api/xp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisation,
          tokenId: token.tokenId,
          recipient: recipient.accountId,
          amount: parsedAmount,
        }),
      });
      const body = (await res.json()) as
        | { tokenId: string; recipient: string; amount: number }
        | { error: string };

      if (!res.ok || "error" in body) {
        const detail = "error" in body ? body.error : `HTTP ${res.status}`;
        if (res.status === 403) {
          // The token does not belong to this issuer — a stale or wrong
          // stored id, not a generic failure. Say exactly that.
          const message =
            `Token ${token.tokenId} does not belong to this organisation. ` +
            `The stored token id is wrong or belongs to another org — clear it ` +
            `and restore the right one. (${detail})`;
          setIssueError(message);
          onTokenMismatch(message);
        } else if (res.status === 401) {
          setIssueError(
            `The issuance signature did not verify against the organisation's account key. ` +
              `Its signing key may not match its Hedera account. (${detail})`,
          );
        } else {
          setIssueError(detail);
        }
        return;
      }

      setIssued((list) => [
        {
          key: `${body.tokenId}/${body.recipient}/${Date.now()}`,
          tokenId: body.tokenId,
          tokenSymbol: token.tokenSymbol,
          recipient: body.recipient,
          amount: body.amount,
          baselineBalance,
          issuedAtMs: Date.now(),
        },
        ...list,
      ]);
      setAmount("");
    } catch (err: unknown) {
      setIssueError(errorMessage(err));
    } finally {
      setIssuing(false);
    }
  }

  const canIssue = !issuing && recipient.phase === "resolved" && amountValid;

  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <div style={{ display: "grid", gap: "8px", maxWidth: "480px" }}>
        <Input
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            setRecipient({ phase: "unresolved" });
          }}
          onBlur={() => void resolveRecipient()}
          placeholder="Recipient Hedera account id, e.g. 0.0.12345"
        />
        {recipient.phase === "resolving" && (
          <div style={{ fontSize: "12px", opacity: 0.6 }}>Checking the recipient account…</div>
        )}
        {recipient.phase === "resolved" && (
          <div style={{ fontSize: "12px", color: tokens.color.success }}>
            Recipient account found.
          </div>
        )}
        {recipient.phase === "error" && (
          <div style={{ fontSize: "12px", color: tokens.color.danger }}>
            Could not resolve the recipient account: {recipient.message}
          </div>
        )}

        <Input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          placeholder={`Amount of ${token.tokenSymbol || "XP"}, e.g. 250`}
        />
        {amount.trim() !== "" && !amountValid && (
          <div style={{ fontSize: "12px", color: tokens.color.danger }}>
            Amount must be a positive whole number — the token has no decimals.
          </div>
        )}

        <Button
          onClick={() => void issue()}
          disabled={!canIssue}
          busy={issuing}
          busyLabel="Issuing…"
          tone={siteThemes.issuer.accent}
        >
          Issue XP
        </Button>
        <p style={{ margin: 0, fontSize: "12px", color: tokens.color.textMuted }}>
          XP lands soulbound: once delivered the recipient can hold it but never
          transfer it on.
        </p>
        {issueError && (
          <p style={{ color: tokens.color.danger, fontSize: "14px", margin: 0 }}>{issueError}</p>
        )}
      </div>

      {issued.length === 0 ? (
        <EmptyState>
          No XP issued in this session yet. Grants appear here, pending until the
          mirror node shows the new balance.
        </EmptyState>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "12px" }}>
          {issued.map((entry) => (
            <XpIssuanceCard key={entry.key} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}

function XpIssuanceCard({ entry }: { entry: XpIssuance }): React.ReactNode {
  // Mirror-node lag is real (impl spec §6.4): poll the recipient's holdings
  // with a bounded ceiling, showing pending throughout — never an empty state,
  // never a fake success. "Unconfirmed" means the mirror has not shown the new
  // balance yet, not that the transfer failed.
  const baseline = entry.baselineBalance;
  const status = useBoundedPoll(
    baseline === null
      ? null
      : async (): Promise<boolean> => {
          const balance = await readBalance(entry.recipient, entry.tokenId);
          return balance !== null && balance >= baseline + entry.amount;
        },
    { intervalMs: 5_000, timeoutMs: 120_000 },
  );
  const meta = STATUS_META[status] ?? STATUS_META.pending;

  return (
    <Card as="li" borderColor={siteThemes.issuer.accent}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
        <Badge color={siteThemes.issuer.accent}>
          +{entry.amount} {entry.tokenSymbol || "XP"}
        </Badge>
        <span style={{ fontWeight: 600 }}>{entry.recipient}</span>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <div style={{ fontSize: "13px", opacity: 0.75 }}>
        Issued {new Date(entry.issuedAtMs).toLocaleTimeString()}
      </div>
      {/* Provenance, not something the issuer works from — behind the ⓘ. */}
      <HederaInfo title="Transfer detail">
        <HederaRef kind="token" label="XP token" value={entry.tokenId} />
        <HederaRef kind="account" label="Recipient" value={entry.recipient} />
      </HederaInfo>
      {status === "idle" && (
        <div style={{ fontSize: "12px", color: tokens.color.textMuted }}>
          The recipient&apos;s balance could not be read before this grant, so a
          balance now would not prove this transfer landed. Check their wallet.
        </div>
      )}
      {status === "timeout" && (
        <div style={{ fontSize: "12px", color: tokens.color.warning }}>
          The mirror node has not shown the new balance within 120s. It may still
          be propagating — check the recipient&apos;s wallet shortly.
        </div>
      )}
    </Card>
  );
}
