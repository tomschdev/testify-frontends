import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@attestant/auth";
import { Dashboard, Panel, siteThemes, tokens } from "@attestant/ui";

import { IssuerConsole } from "@/components/IssuerConsole";

const signOutStyle = {
  display: "inline-block",
  padding: "7px 14px",
  borderRadius: tokens.radius.md,
  background: tokens.color.surface,
  color: tokens.color.ink,
  border: `${tokens.border.default} solid ${tokens.color.ink}`,
  boxShadow: tokens.shadow.sm,
  fontWeight: 700,
  fontSize: "13px",
  textDecoration: "none",
} as const;

const signInStyle = {
  display: "inline-block",
  marginTop: "4px",
  padding: "10px 18px",
  borderRadius: tokens.radius.md,
  background: siteThemes.issuer.accent,
  color: tokens.color.ink,
  border: `${tokens.border.default} solid ${tokens.color.ink}`,
  boxShadow: tokens.shadow.sm,
  fontWeight: 700,
  textDecoration: "none",
} as const;

export default async function Home() {
  const store = await cookies();
  const hasSession =
    store.has(ACCESS_TOKEN_COOKIE) || store.has(REFRESH_TOKEN_COOKIE);

  return (
    <Dashboard
      site="issuer"
      name="Issuer Console"
      audience="For organisations"
      purpose="Create your organisation and issue XP and reputation credentials to candidates."
      actions={
        hasSession ? (
          <a href="/auth/signout" className="neo-interactive" style={signOutStyle}>
            Sign out
          </a>
        ) : undefined
      }
    >
      {hasSession ? (
        <IssuerConsole />
      ) : (
        <Panel title="Sign in" accent={siteThemes.issuer.accent}>
          <div style={{ display: "grid", gap: "14px", justifyItems: "start" }}>
            <p style={{ margin: 0, color: tokens.color.textMuted, maxWidth: "48ch" }}>
              Sign in to create your organisation and issue credentials from its
              on-chain identity.
            </p>
            <a href="/auth/signin" className="neo-interactive" style={signInStyle}>
              Sign in / Sign up
            </a>
          </div>
        </Panel>
      )}
    </Dashboard>
  );
}
