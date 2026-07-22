"use client";

import { useState, type ReactNode } from "react";

import {
  elideMiddle,
  hashscanUrl,
  hederaNetwork,
  hederaRefLabels,
  type HederaNetwork,
  type HederaRefKind,
} from "./hederaNetwork";
import { tokens } from "./tokens";

interface HederaRefBaseProps {
  /**
   * Label shown before the value. Defaults to the kind's label; pass a
   * resource-specific one ("Issuer account", "HCS position topic") where that
   * reads better. Pass `null` to render the value alone.
   */
  label?: string | null;
  /** Overrides the app-wide network for this one reference. */
  network?: HederaNetwork;
  /** Rendered after the value — serial numbers, balances, timestamps. */
  note?: ReactNode;
  /** Shown in place of the value when it is empty. */
  fallback?: string;
}

export type HederaRefProps = HederaRefBaseProps &
  (
    | {
        kind: Exclude<HederaRefKind, "topic-message" | "token">;
        value: string;
        sequenceNumber?: never;
        serialNumber?: never;
      }
    | {
        kind: "token";
        value: string;
        /** Deep-links the individual NFT (credential serial) when given. */
        serialNumber?: number | string;
        sequenceNumber?: never;
      }
    | {
        kind: "topic-message";
        /** The topic id; `sequenceNumber` identifies the message within it. */
        value: string;
        /**
         * Rendered as `{topic} #{seq}`. HashScan has no per-message URL, so
         * the link goes to the topic's Messages tab — see `hashscanUrl`.
         */
        sequenceNumber?: number | string;
        serialNumber?: never;
      }
  );

/**
 * One on-chain reference: monospace value, copy affordance, and — for the
 * kinds that have an explorer page — a link to HashScan on the configured
 * network.
 *
 * This is the only renderer for Hedera ids across the three consoles. A topic
 * id must look and link the same on a position card, a credential row and an
 * organisation header (impl spec §5); if an app grows a bespoke version, one
 * of the two is wrong.
 *
 * `key`, `evm` and `hash` render and copy but never link — they identify, they
 * do not navigate. There is no private-key kind by design; see
 * `hederaNetwork.ts`.
 */
export function HederaRef({
  kind,
  value,
  label,
  network,
  note,
  fallback = "—",
  sequenceNumber,
  serialNumber,
}: HederaRefProps): ReactNode {
  const [copied, setCopied] = useState(false);

  const resolvedLabel = label === undefined ? hederaRefLabels[kind] : label;
  const trimmed = value.trim();
  const href =
    trimmed === ""
      ? null
      : hashscanUrl(kind, trimmed, network ?? hederaNetwork(), { sequenceNumber, serialNumber });

  // A message or NFT reference carries its ordinal in both the display and the
  // clipboard, so the pair survives a copy; every other kind is exactly its id.
  const ordinal =
    sequenceNumber !== undefined && sequenceNumber !== ""
      ? `#${String(sequenceNumber)}`
      : serialNumber !== undefined && serialNumber !== ""
        ? `#${String(serialNumber)}`
        : null;

  const copyValue = ordinal === null ? trimmed : `${trimmed} ${ordinal}`;
  const shown = ordinal === null ? elideMiddle(trimmed) : `${trimmed} ${ordinal}`;

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(copyValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard access can be denied (insecure origin, permissions policy).
      // The full value is selectable in the DOM either way — nothing to say.
    }
  }

  if (trimmed === "") {
    return (
      <span style={rowStyle}>
        {resolvedLabel !== null && <span style={labelStyle}>{resolvedLabel}</span>}
        <span style={{ ...valueStyle, opacity: 0.5 }}>{fallback}</span>
      </span>
    );
  }

  return (
    <span style={rowStyle}>
      {resolvedLabel !== null && <span style={labelStyle}>{resolvedLabel}</span>}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          title={`${copyValue} — open on HashScan`}
          style={{ ...valueStyle, color: tokens.color.info }}
        >
          {shown}
        </a>
      ) : (
        <span title={copyValue} style={valueStyle}>
          {shown}
        </span>
      )}
      {note !== undefined && <span style={noteStyle}>{note}</span>}
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${resolvedLabel ?? hederaRefLabels[kind]} ${copyValue}`}
        style={copyButtonStyle}
      >
        {copied ? "copied" : "copy"}
      </button>
    </span>
  );
}

const rowStyle = {
  display: "inline-flex",
  alignItems: "baseline",
  flexWrap: "wrap",
  gap: "6px",
  fontSize: "12px",
  maxWidth: "100%",
} as const;

const labelStyle = {
  opacity: 0.55,
  fontFamily: tokens.font.sans,
} as const;

const valueStyle = {
  fontFamily: tokens.font.mono,
  overflowWrap: "anywhere",
} as const;

const noteStyle = {
  opacity: 0.6,
  fontFamily: tokens.font.sans,
} as const;

const copyButtonStyle = {
  background: "transparent",
  border: `1px solid ${tokens.color.border}`,
  borderRadius: "6px",
  padding: "0 5px",
  color: "inherit",
  font: "inherit",
  fontSize: "10px",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  opacity: 0.6,
  cursor: "pointer",
} as const;
