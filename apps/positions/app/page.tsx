import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@attestant/auth";
import { Dashboard, Panel, siteThemes, tokens } from "@attestant/ui";

import { PositionsConsole } from "@/components/PositionsConsole";

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
  background: siteThemes.positions.accent,
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
      site="positions"
      name="Welcome to the Job Market: Filter Talent, Fill Positions"
      audience="For organisations"
      purpose="Create positions as chained credential filters, so candidates can be matched on the credentials they hold."
      actions={
        hasSession ? (
          <a href="/auth/signout" className="neo-interactive" style={signOutStyle}>
            Sign out
          </a>
        ) : undefined
      }
    >
      {hasSession ? (
        <PositionsConsole />
      ) : (
        <Panel title="Sign in" accent={siteThemes.positions.accent}>
          <div style={{ display: "grid", gap: "14px", justifyItems: "start" }}>
            <p style={{ margin: 0, color: tokens.color.textMuted, maxWidth: "48ch" }}>
              Sign in to post positions on behalf of your organisations and match
              them against candidate credentials.
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
