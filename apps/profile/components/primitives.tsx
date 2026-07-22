import type { CSSProperties, ReactNode } from "react";

import { tokens } from "@attestant/ui";

// TODO(shared): swap these for the @attestant/ui primitives (Badge,
// EmptyState, ErrorState, SectionHeader) once the shared versions land — the
// Issuer/Positions sprints may publish them; until then this app keeps its own
// minimal copies rather than pushing conflicting versions into packages/ui.

export type BadgeTone = "positive" | "negative" | "neutral" | "accent";

const badgeTones: Record<BadgeTone, { color: string; background: string }> = {
  positive: { color: "#86efac", background: "rgba(134, 239, 172, 0.12)" },
  negative: { color: "#fca5a5", background: "rgba(252, 165, 165, 0.12)" },
  neutral: { color: tokens.color.textMuted, background: "rgba(139, 147, 167, 0.12)" },
  accent: { color: "#5eead4", background: "rgba(94, 234, 212, 0.12)" },
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }): ReactNode {
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        borderRadius: tokens.radius.md,
        padding: "3px 10px",
        whiteSpace: "nowrap",
        ...badgeTones[tone],
      }}
    >
      {children}
    </span>
  );
}

export function SectionHeader({ title, aside }: { title: string; aside?: ReactNode }): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "12px",
        borderBottom: `1px solid ${tokens.color.border}`,
        paddingBottom: "8px",
        marginBottom: "12px",
      }}
    >
      <h2 style={{ fontSize: "18px", fontWeight: 600, margin: 0 }}>{title}</h2>
      {aside}
    </div>
  );
}

/** Honest empty state: the RPC succeeded and the account holds nothing. */
export function EmptyState({ children }: { children: ReactNode }): ReactNode {
  return (
    <p style={{ opacity: 0.6, margin: "4px 0", fontSize: "14px" }}>{children}</p>
  );
}

/** Reserved for RPC failure — an empty list is not an error. */
export function ErrorState({ children }: { children: ReactNode }): ReactNode {
  return (
    <p style={{ color: "#fca5a5", margin: "4px 0", fontSize: "14px" }}>{children}</p>
  );
}

export const buttonStyle: CSSProperties = {
  padding: "8px 16px",
  borderRadius: tokens.radius.md,
  border: `1px solid ${tokens.color.border}`,
  background: "transparent",
  color: tokens.color.text,
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
  fontFamily: "inherit",
};
