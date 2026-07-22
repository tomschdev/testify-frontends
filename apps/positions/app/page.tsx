import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@attestant/auth";
import { SiteShell, siteThemes, tokens } from "@attestant/ui";

import { PositionsConsole } from "@/components/PositionsConsole";

const linkStyle = {
  display: "inline-block",
  marginTop: "20px",
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
    <SiteShell
      site="positions"
      name="Positions Console"
      audience="For organisations"
      purpose="Create positions as chained credential filters, so candidates can be matched on the credentials they hold."
    >
      <div style={{ marginTop: "24px" }}>
        {hasSession ? (
          <>
            <PositionsConsole />
            <a href="/auth/signout" className="neo-interactive" style={linkStyle}>
              Sign out
            </a>
          </>
        ) : (
          <a href="/auth/signin" className="neo-interactive" style={linkStyle}>
            Sign in / Sign up
          </a>
        )}
      </div>
    </SiteShell>
  );
}
