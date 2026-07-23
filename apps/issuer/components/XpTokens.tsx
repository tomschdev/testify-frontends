"use client";

import { useEffect, useState } from "react";

import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import {
  Button,
  Card,
  HederaInfo,
  HederaRef,
  Input,
  SectionHeader,
  Select,
  siteThemes,
  tokens,
} from "@attestant/ui";

import { IssueXpForm } from "@/components/IssueXpForm";
import {
  clearXpToken,
  readXpToken,
  writeXpToken,
  type StoredXpToken,
} from "@/lib/xpTokenStore";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** "Fenwick Systems" → "FSXP"; a starting point the org can overwrite. */
function suggestSymbol(displayName: string): string {
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 4);
  return `${initials}XP`;
}

interface XpTokensProps {
  /** Organisations with an on-chain identity — the issuing identities. */
  organisations: Organisation.AsObject[];
}

/**
 * XP tokens (§1.7–1.8): create the organisation's token once, then issue
 * amounts from it.
 *
 * The once-per-org rule is enforced here and nowhere else. issue-v1 is
 * stateless: a second create mints a second, equally valid token and silently
 * orphans the first, taking every balance already issued with it. So when a
 * token id is stored for the selected org this shows the token, not the form.
 */
export function XpTokens({ organisations }: XpTokensProps): React.ReactNode {
  const [orgName, setOrgName] = useState(organisations[0]?.name ?? "");
  // Undefined until the localStorage read has run (it cannot run during SSR),
  // so the create form is never flashed before custody is known.
  const [token, setToken] = useState<StoredXpToken | null | undefined>(undefined);
  const [mismatch, setMismatch] = useState<string | null>(null);

  useEffect(() => {
    setMismatch(null);
    setToken(orgName === "" ? null : readXpToken(orgName));
  }, [orgName]);

  const org = organisations.find((o) => o.name === orgName);

  function store(next: StoredXpToken): void {
    writeXpToken(orgName, next);
    setToken(next);
    setMismatch(null);
  }

  function forget(): void {
    clearXpToken(orgName);
    setToken(null);
    setMismatch(null);
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <label style={{ fontSize: "13px", opacity: 0.75, maxWidth: "480px", display: "block" }}>
        Organisation
        <Select
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          style={{ display: "block", width: "100%", marginTop: "4px" }}
        >
          {organisations.map((o) => (
            <option key={o.name} value={o.name}>
              {o.displayName}
            </option>
          ))}
        </Select>
      </label>

      {token === undefined || !org ? null : token === null ? (
        <CreateXpToken org={org} onCreated={store} onRestored={store} />
      ) : (
        <>
          <section>
            <SectionHeader>Your XP token</SectionHeader>
            <Card borderColor={siteThemes.issuer.accent}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600 }}>{token.tokenName || "XP token"}</span>
                {token.tokenSymbol && (
                  <span style={{ fontFamily: tokens.font.mono, opacity: 0.7 }}>
                    {token.tokenSymbol}
                  </span>
                )}
              </div>
              {/* The token id is inline, not behind the ⓘ: nothing on the
                  backend can look it up, so this display is the record. */}
              <HederaRef kind="token" label="XP token id" value={token.tokenId} />
              <HederaInfo title="Recovery">
                <HederaRef kind="account" label="Issuer account" value={token.issuer} />
                <div style={{ fontSize: "12px", opacity: 0.7 }}>
                  Kept in this browser only. Write the token id down: if it is lost,
                  the token is still on-chain as the one whose memo is{" "}
                  <span style={{ fontFamily: tokens.font.mono }}>xp:{token.issuer}</span>.
                </div>
              </HederaInfo>
              <div>
                <Button onClick={forget} style={{ fontSize: "12px", padding: "5px 10px" }}>
                  Forget this token id
                </Button>
              </div>
            </Card>
            {mismatch && (
              <p style={{ color: tokens.color.danger, fontSize: "13px", margin: "10px 0 0" }}>
                {mismatch}
              </p>
            )}
          </section>

          <section>
            <SectionHeader>Issue XP</SectionHeader>
            <IssueXpForm organisation={orgName} token={token} onTokenMismatch={setMismatch} />
          </section>
        </>
      )}
    </div>
  );
}

interface CreateXpTokenProps {
  org: Organisation.AsObject;
  onCreated: (token: StoredXpToken) => void;
  onRestored: (token: StoredXpToken) => void;
}

/**
 * The create form, shown only while no token id is held for this org. It also
 * takes a token id by hand — the recovery path when the browser's copy is
 * gone but the id is written down or readable on HashScan. Restoring is always
 * the right move over creating a second token.
 */
function CreateXpToken({ org, onCreated, onRestored }: CreateXpTokenProps): React.ReactNode {
  const [tokenName, setTokenName] = useState(`${org.displayName} XP`);
  const [tokenSymbol, setTokenSymbol] = useState(suggestSymbol(org.displayName));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [restoreId, setRestoreId] = useState("");

  async function create(): Promise<void> {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/xp-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisation: org.name,
          tokenName: tokenName.trim(),
          tokenSymbol: tokenSymbol.trim(),
        }),
      });
      const body = (await res.json()) as { tokenId: string; issuer: string } | { error: string };
      if (!res.ok || "error" in body) {
        setCreateError(
          "error" in body ? body.error : `XP token creation failed with HTTP ${res.status}`,
        );
        return;
      }
      onCreated({
        tokenId: body.tokenId,
        tokenName: tokenName.trim(),
        tokenSymbol: tokenSymbol.trim(),
        issuer: body.issuer,
        recordedAtMs: Date.now(),
      });
    } catch (err: unknown) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  const restoreValid = /^\d+\.\d+\.\d+$/.test(restoreId.trim());

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <section>
        <SectionHeader>Create your XP token</SectionHeader>
        <div style={{ display: "grid", gap: "8px", maxWidth: "480px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: tokens.color.textMuted }}>
            One token per organisation, created once. Every XP you issue is an
            amount of this token, so creating a second one would strand the
            balances already issued from the first.
          </p>
          <Input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder="Token name, e.g. Fenwick Systems XP"
          />
          <Input
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value)}
            placeholder="Symbol, e.g. FSXP"
          />
          {org.hederaAccountAddress && (
            <HederaInfo title="Signing identity" label="Signing as">
              <HederaRef kind="account" label="Hedera account" value={org.hederaAccountAddress} />
            </HederaInfo>
          )}
          <Button
            onClick={() => void create()}
            disabled={tokenName.trim() === "" || tokenSymbol.trim() === ""}
            busy={creating}
            busyLabel="Creating…"
            tone={siteThemes.issuer.accent}
          >
            Create XP token
          </Button>
          {createError && (
            <p style={{ color: tokens.color.danger, fontSize: "14px", margin: 0 }}>{createError}</p>
          )}
        </div>
      </section>

      <section>
        <SectionHeader>Already have one?</SectionHeader>
        <div style={{ display: "grid", gap: "8px", maxWidth: "480px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: tokens.color.textMuted }}>
            The token id lives in this browser only. If you created it elsewhere —
            or cleared your browser data — paste it here rather than creating a
            second token. It is the token on HashScan whose memo is{" "}
            <span style={{ fontFamily: tokens.font.mono }}>xp:{org.hederaAccountAddress}</span>.
          </p>
          <Input
            value={restoreId}
            onChange={(e) => setRestoreId(e.target.value)}
            placeholder="Existing XP token id, e.g. 0.0.12345"
          />
          <Button
            onClick={() =>
              onRestored({
                tokenId: restoreId.trim(),
                tokenName: tokenName.trim(),
                tokenSymbol: tokenSymbol.trim(),
                issuer: org.hederaAccountAddress,
                recordedAtMs: Date.now(),
              })
            }
            disabled={!restoreValid}
          >
            Use this token id
          </Button>
        </div>
      </section>
    </div>
  );
}
