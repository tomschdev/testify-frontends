"use client";

import { MirrorServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_grpc_web_pb";
import { ListCredentialsRequest } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_pb";
import {
  Badge,
  Card,
  EmptyState,
  siteThemes,
  tokens,
  useBoundedPoll,
  type BadgeTone,
} from "@attestant/ui";

// Same pattern as the alis console apps: grpc-web PromiseClient pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route.
const mirrorClient = new MirrorServicePromiseClient("/api/grpc");

/**
 * One issuance from this session, built from the /api/issue submit receipt.
 * Session-local on purpose: there is no issuer-scoped credential listing RPC
 * (ListCredentials is holder-scoped), so this list exists for visual
 * confirmation during the live demo and does not survive a reload.
 */
export interface IssuedEntry {
  /** Stable render key — `{tokenId}/{serial}` is unique per issuance. */
  key: string;
  type: "xp_credential" | "reputation_credential";
  title: string;
  /** Recipient Hedera account id. */
  subject: string;
  /** Issuing organisation's Hedera account id — matches Credential.issuer. */
  issuer: string;
  tokenId: string;
  serial: number;
  topicId: string;
  sequenceNumber: number;
  issuedAtMs: number;
}

const TYPE_LABEL: Record<IssuedEntry["type"], string> = {
  xp_credential: "XP",
  reputation_credential: "Reputation",
};

const STATUS_META: Record<string, { label: string; tone: BadgeTone }> = {
  pending: { label: "Pending", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  timeout: { label: "Unconfirmed", tone: "danger" },
};

interface RecentlyIssuedProps {
  /** Newest first. */
  entries: IssuedEntry[];
}

export function RecentlyIssued({ entries }: RecentlyIssuedProps): React.ReactNode {
  if (entries.length === 0) {
    return (
      <EmptyState>
        Nothing issued in this session yet. Credentials you issue above appear here,
        pending until the mirror node confirms them.
      </EmptyState>
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "12px" }}>
      {entries.map((entry) => (
        <IssuedCard key={entry.key} entry={entry} />
      ))}
    </ul>
  );
}

function IssuedCard({ entry }: { entry: IssuedEntry }): React.ReactNode {
  // Mirror-node lag is real (impl spec §6.4): poll the recipient's holder-
  // scoped credential list with a bounded ceiling, showing pending — never an
  // empty state, never a fake success. "Unconfirmed" after the ceiling means
  // exactly that: the write may still land; the mirror just hasn't shown it.
  const status = useBoundedPoll(
    async (): Promise<boolean> => {
      const req = new ListCredentialsRequest();
      req.setAccountId(entry.subject);
      const res = await mirrorClient.listCredentials(req, {});
      return res
        .getCredentialsList()
        .some(
          (c) =>
            c.getType() === entry.type &&
            c.getIssuer() === entry.issuer &&
            c.getTitle() === entry.title,
        );
    },
    { intervalMs: 5_000, timeoutMs: 120_000 },
  );
  const meta = STATUS_META[status] ?? STATUS_META.pending;

  return (
    <Card as="li" borderColor={siteThemes.issuer.accent}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
        <Badge color={siteThemes.issuer.accent}>{TYPE_LABEL[entry.type]}</Badge>
        <span style={{ fontWeight: 600 }}>{entry.title}</span>
        <Badge tone={meta.tone}>{meta.label}</Badge>
      </div>
      <div style={{ fontSize: "13px", opacity: 0.75 }}>
        Issued to {entry.subject} · {new Date(entry.issuedAtMs).toLocaleTimeString()}
      </div>
      <div
        style={{
          fontSize: "12px",
          fontFamily: tokens.font.mono,
          opacity: 0.55,
          overflowWrap: "anywhere",
        }}
      >
        <div>
          NFT {entry.tokenId} · serial {entry.serial}
        </div>
        <div>
          HCS topic {entry.topicId} · sequence {entry.sequenceNumber}
        </div>
      </div>
      {status === "timeout" && (
        <div style={{ fontSize: "12px", color: tokens.color.warning }}>
          The mirror node has not shown this credential within 120s. It may still be
          propagating — check the recipient&apos;s profile shortly.
        </div>
      )}
    </Card>
  );
}
