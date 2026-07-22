import type { CSSProperties, ReactNode } from "react";

import { tokens } from "./tokens";

export interface OnChainPanelProps {
  /** Section heading. Defaults to "On-chain". */
  title?: string;
  /** Border colour of the rule above the block, e.g. a site accentSoft. */
  borderColor?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * The bordered "On-chain" block that every Hedera-backed resource card uses to
 * group its `HederaRef`s, so the section looks identical on a position, a
 * credential, an organisation and a user.
 *
 * No `"use client"` here on purpose — it is pure markup, so it composes into
 * server components as well as client ones.
 */
export function OnChainPanel({
  title = "On-chain",
  borderColor = tokens.color.border,
  style,
  children,
}: OnChainPanelProps): ReactNode {
  return (
    <section
      style={{
        borderTop: `1px solid ${borderColor}`,
        paddingTop: "8px",
        display: "grid",
        gap: "4px",
        fontSize: "12px",
        ...style,
      }}
    >
      {title !== "" && <div style={{ opacity: 0.6 }}>{title}</div>}
      {children}
    </section>
  );
}
