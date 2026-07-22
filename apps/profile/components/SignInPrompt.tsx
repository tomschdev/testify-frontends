import type { ReactNode } from "react";

import { siteThemes } from "@attestant/ui";

/** Session-gated menus render this when no session cookie is present. */
export function SignInPrompt({ what }: { what: string }): ReactNode {
  return (
    <div style={{ display: "grid", gap: "16px", justifyItems: "start" }}>
      <p style={{ opacity: 0.7, margin: 0 }}>Sign in to see {what}.</p>
      <a
        href="/auth/signin"
        style={{
          display: "inline-block",
          padding: "10px 18px",
          borderRadius: "10px",
          background: siteThemes.profile.accentSoft,
          color: siteThemes.profile.accent,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Sign in / Sign up
      </a>
    </div>
  );
}
