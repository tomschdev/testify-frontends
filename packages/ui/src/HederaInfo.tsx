"use client";

import type { ReactNode } from "react";

import { InfoTooltip } from "./InfoTooltip";
import { tokens } from "./tokens";

export interface HederaInfoProps {
  /** Heading inside the panel. Defaults to "On-chain". */
  title?: string;
  /** Text beside the icon. Defaults to "On-chain"; pass `null` for a bare icon. */
  label?: string | null;
  /** The `HederaRef`s to reveal. */
  children?: ReactNode;
}

/**
 * The ⓘ that complementary Hedera detail hides behind.
 *
 * The split it enforces: an id the user acts on — their own account address,
 * a candidate's — stays inline as a bare `HederaRef`, because it exists to be
 * read and copied. Provenance that merely explains a record — the issuer key
 * behind a form, the topic a position was anchored to — comes in here, so it
 * stops competing with the content it annotates.
 */
export function HederaInfo({
  title = "On-chain",
  label = "On-chain",
  children,
}: HederaInfoProps): ReactNode {
  return (
    <InfoTooltip label={label ?? undefined} ariaLabel={`${title} details`}>
      {title !== "" && <div style={titleStyle}>{title}</div>}
      <div style={{ display: "grid", gap: "6px" }}>{children}</div>
    </InfoTooltip>
  );
}

const titleStyle = {
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  opacity: 0.6,
  fontFamily: tokens.font.sans,
} as const;
