"use client";

import { useState } from "react";

import { MirrorServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_grpc_web_pb";
import { GetHederaAccountRequest } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_pb";
import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import { Button, Input, Select, tokens } from "@attestant/ui";

import type { IssuedEntry } from "@/components/RecentlyIssued";

// Same pattern as the alis console apps: grpc-web PromiseClient pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route.
const mirrorClient = new MirrorServicePromiseClient("/api/grpc");

export type CredentialVariant = "xp" | "reputation";

const VARIANT_CONFIG: Record<
  CredentialVariant,
  { type: "xp_credential" | "reputation_credential"; titleLabel: string; issueLabel: string }
> = {
  xp: {
    type: "xp_credential",
    titleLabel: "Course / credential title, e.g. Data Science Bootcamp",
    issueLabel: "Issue XP Credential",
  },
  reputation: {
    type: "reputation_credential",
    titleLabel: "Endorsement message",
    issueLabel: "Issue Reputation Credential",
  },
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Recipient identification is by public key (feature-list §4), but prepare
 * wants both `subject` (account id) and `subjectPublicKey`. One account-id
 * input satisfies both: the key is resolved via MirrorService.GetHederaAccount
 * and displayed before submission, so typos surface as NOT_FOUND before
 * issuance instead of after.
 */
type RecipientState =
  | { phase: "unresolved" }
  | { phase: "resolving" }
  | { phase: "resolved"; accountId: string; publicKey: string }
  | { phase: "error"; message: string };

interface IssueCredentialFormProps {
  variant: CredentialVariant;
  /** Organisations with an on-chain identity — the issuing identities. */
  organisations: Organisation.AsObject[];
  /** Called with the submit receipt after a successful issuance. */
  onIssued: (entry: IssuedEntry) => void;
}

export function IssueCredentialForm({
  variant,
  organisations,
  onIssued,
}: IssueCredentialFormProps): React.ReactNode {
  const config = VARIANT_CONFIG[variant];

  const [orgName, setOrgName] = useState(organisations[0]?.name ?? "");
  const [accountId, setAccountId] = useState("");
  const [recipient, setRecipient] = useState<RecipientState>({ phase: "unresolved" });
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  async function resolveRecipient(): Promise<void> {
    const id = accountId.trim();
    if (id === "" || (recipient.phase === "resolved" && recipient.accountId === id)) {
      return;
    }
    setRecipient({ phase: "resolving" });
    try {
      const req = new GetHederaAccountRequest();
      req.setAccountId(id);
      const account = await mirrorClient.getHederaAccount(req, {});
      setRecipient({
        phase: "resolved",
        accountId: id,
        publicKey: account.getPublicKey(),
      });
    } catch (err: unknown) {
      setRecipient({ phase: "error", message: errorMessage(err) });
    }
  }

  async function issue(): Promise<void> {
    if (recipient.phase !== "resolved") return;
    setIssuing(true);
    setIssueError(null);

    // The prepare schema has no grade field — grade is folded into the title
    // (e.g. "Data Science Bootcamp — Distinction") rather than inventing a
    // payload field the backend would not understand.
    const fullTitle =
      variant === "xp" && grade.trim() !== ""
        ? `${title.trim()} — ${grade.trim()}`
        : title.trim();

    try {
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: config.type,
          organisation: orgName,
          subject: recipient.accountId,
          subjectPublicKey: recipient.publicKey,
          title: fullTitle,
        }),
      });
      const body = (await res.json()) as
        | {
            topicId: string;
            sequenceNumber: number;
            contentHash: string;
            tokenId: string;
            serial: number;
            issuer: string;
          }
        | { error: string };
      if (!res.ok || "error" in body) {
        setIssueError("error" in body ? body.error : `issuance failed with HTTP ${res.status}`);
        return;
      }

      onIssued({
        key: `${body.tokenId}/${body.serial}`,
        type: config.type,
        title: fullTitle,
        subject: recipient.accountId,
        issuer: body.issuer,
        tokenId: body.tokenId,
        serial: body.serial,
        topicId: body.topicId,
        sequenceNumber: body.sequenceNumber,
        issuedAtMs: Date.now(),
      });
      setTitle("");
      setGrade("");
    } catch (err: unknown) {
      setIssueError(errorMessage(err));
    } finally {
      setIssuing(false);
    }
  }

  const selectedOrg = organisations.find((org) => org.name === orgName);
  const canIssue = !issuing && recipient.phase === "resolved" && title.trim() !== "";

  return (
    <div style={{ display: "grid", gap: "8px", maxWidth: "480px" }}>
      <label style={{ fontSize: "13px", opacity: 0.75 }}>
        Issuing as
        <Select
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: "4px" }}
        >
          {organisations.map((org) => (
            <option key={org.name} value={org.name}>
              {org.displayName}
            </option>
          ))}
        </Select>
      </label>
      {selectedOrg && (
        <div style={{ fontSize: "12px", fontFamily: tokens.font.mono, opacity: 0.55 }}>
          Signing as Hedera account {selectedOrg.hederaAccountAddress}
        </div>
      )}

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
        <div style={{ fontSize: "12px", opacity: 0.6 }}>Resolving recipient key…</div>
      )}
      {recipient.phase === "resolved" && (
        <div
          style={{
            fontSize: "12px",
            fontFamily: tokens.font.mono,
            color: tokens.color.success,
            overflowWrap: "anywhere",
          }}
        >
          Recipient key: {recipient.publicKey}
        </div>
      )}
      {recipient.phase === "error" && (
        <div style={{ fontSize: "12px", color: tokens.color.danger }}>
          Could not resolve the recipient account: {recipient.message}
        </div>
      )}

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={config.titleLabel}
      />
      {variant === "xp" && (
        <Input
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          placeholder="Grade (optional), e.g. Distinction"
        />
      )}

      <Button onClick={() => void issue()} disabled={!canIssue} busy={issuing} busyLabel="Issuing…">
        {config.issueLabel}
      </Button>
      {issueError && (
        <p style={{ color: tokens.color.danger, fontSize: "14px", margin: 0 }}>{issueError}</p>
      )}
    </div>
  );
}
