import type { CSSProperties, ReactNode } from "react";

import { Badge as UIBadge, controlStyle, siteThemes, tokens } from "@attestant/ui";

// Profile keeps its own tone vocabulary (positive / negative / accent), but the
// rendering now delegates to the shared neo-brutalism primitives — one chip,
// one button style, across all three consoles.

export type BadgeTone = "positive" | "negative" | "neutral" | "accent";

const toneFill: Record<BadgeTone, string> = {
  positive: tokens.palette.tertiary, // mint
  negative: tokens.color.danger, // coral
  neutral: tokens.color.surface, // white
  accent: siteThemes.profile.accent, // mint (profile accent)
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }): ReactNode {
  return <UIBadge color={toneFill[tone]}>{children}</UIBadge>;
}

export function SectionHeader({ title, aside }: { title: string; aside?: ReactNode }): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "12px",
        borderBottom: `${tokens.border.default} solid ${tokens.color.ink}`,
        paddingBottom: "8px",
        marginBottom: "12px",
      }}
    >
      <h2
        style={{
          fontSize: "16px",
          fontWeight: 800,
          letterSpacing: "0.01em",
          margin: 0,
          color: tokens.color.text,
        }}
      >
        {title}
      </h2>
      {aside}
    </div>
  );
}

/** Honest empty state: the RPC succeeded and the account holds nothing. */
export function EmptyState({ children }: { children: ReactNode }): ReactNode {
  return (
    <p style={{ color: tokens.color.textMuted, margin: "4px 0", fontSize: "14px" }}>{children}</p>
  );
}

/** Reserved for RPC failure — an empty list is not an error. */
export function ErrorState({ children }: { children: ReactNode }): ReactNode {
  return (
    <p style={{ color: tokens.color.danger, fontWeight: 600, margin: "4px 0", fontSize: "14px" }}>
      {children}
    </p>
  );
}

export const buttonStyle: CSSProperties = {
  ...controlStyle,
  padding: "8px 16px",
  boxShadow: tokens.shadow.sm,
  fontSize: "13px",
  cursor: "pointer",
};
