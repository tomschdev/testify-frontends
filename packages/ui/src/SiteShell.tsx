import type { CSSProperties, ReactNode } from "react";

import { siteThemes, tokens, type SiteKey } from "./tokens";

export interface SiteShellProps {
  site: SiteKey;
  /** Site name shown in the header, e.g. "Issuer Console". */
  name: string;
  /** Audience label, e.g. "For organisations". */
  audience: string;
  /** One-sentence description of the site's primary job. */
  purpose: string;
  children?: ReactNode;
}

const styles: Record<string, CSSProperties> = {
  page: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    background: tokens.color.bg,
    color: tokens.color.text,
    fontFamily: tokens.font.sans,
  },
  card: {
    width: "100%",
    maxWidth: tokens.maxWidth,
    background: tokens.color.surface,
    border: `${tokens.border.thick} solid ${tokens.color.ink}`,
    borderRadius: tokens.radius.lg,
    boxShadow: tokens.shadow.xl,
    padding: "40px 32px",
  },
  product: {
    fontFamily: tokens.font.mono,
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: tokens.color.textMuted,
    marginBottom: "20px",
  },
  name: {
    fontSize: "34px",
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: "-0.02em",
    margin: "0 0 12px",
  },
  purpose: {
    fontSize: "16px",
    lineHeight: 1.6,
    color: tokens.color.textMuted,
    margin: 0,
  },
  footer: {
    marginTop: "28px",
    paddingTop: "20px",
    borderTop: `${tokens.border.default} solid ${tokens.color.ink}`,
    fontSize: "13px",
    fontWeight: 600,
    color: tokens.color.textMuted,
  },
};

export function SiteShell({ site, name, audience, purpose, children }: SiteShellProps): ReactNode {
  const theme = siteThemes[site];
  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <div style={styles.product}>Project Attestant</div>
        <span
          style={{
            display: "inline-block",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: tokens.color.ink,
            background: theme.accent,
            border: `${tokens.border.default} solid ${tokens.color.ink}`,
            boxShadow: tokens.shadow.sm,
            borderRadius: tokens.radius.sm,
            padding: "4px 10px",
            marginBottom: "16px",
          }}
        >
          {audience}
        </span>
        <h1 style={styles.name}>{name}</h1>
        <p style={styles.purpose}>{purpose}</p>
        {children}
        <div style={styles.footer}>Deployed on Vercel · Phase 1</div>
      </div>
    </main>
  );
}
