import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@attestant/auth";
import { SiteShell, siteThemes } from "@attestant/ui";

import { PositionsConsole } from "@/components/PositionsConsole";

const linkStyle = {
  display: "inline-block",
  marginTop: "20px",
  padding: "10px 18px",
  borderRadius: "10px",
  background: siteThemes.positions.accentSoft,
  color: siteThemes.positions.accent,
  fontWeight: 600,
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
            <a href="/auth/signout" style={linkStyle}>
              Sign out
            </a>
          </>
        ) : (
          <a href="/auth/signin" style={linkStyle}>
            Sign in / Sign up
          </a>
        )}
      </div>
    </SiteShell>
  );
}
