import type { ReactNode } from "react";

import { siteThemes, tokens } from "@attestant/ui";

/** Session-gated menus render this when no session cookie is present. */
export function SignInPrompt({ what }: { what: string }): ReactNode {
  return (
    <div style={{ display: "grid", gap: "16px", justifyItems: "start" }}>
      <p style={{ color: tokens.color.textMuted, margin: 0 }}>Sign in to see {what}.</p>
      <a
        href="/auth/signin"
        className="neo-interactive"
        style={{
          display: "inline-block",
          padding: "10px 18px",
          borderRadius: tokens.radius.md,
          background: siteThemes.profile.accent,
          color: tokens.color.ink,
          border: `${tokens.border.default} solid ${tokens.color.ink}`,
          boxShadow: tokens.shadow.sm,
          fontWeight: 700,
          textDecoration: "none",
        }}
      >
        Sign in / Sign up
      </a>
    </div>
  );
}
