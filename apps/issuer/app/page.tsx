import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@attestant/auth";
import { SiteShell, siteThemes } from "@attestant/ui";

import { IssuerConsole } from "@/components/IssuerConsole";

const linkStyle = {
  display: "inline-block",
  marginTop: "20px",
  padding: "10px 18px",
  borderRadius: "10px",
  background: siteThemes.issuer.accentSoft,
  color: siteThemes.issuer.accent,
  fontWeight: 600,
  textDecoration: "none",
} as const;

export default async function Home() {
  const store = await cookies();
  const hasSession =
    store.has(ACCESS_TOKEN_COOKIE) || store.has(REFRESH_TOKEN_COOKIE);

  return (
    <SiteShell
      site="issuer"
      name="Issuer Console"
      audience="For organisations"
      purpose="Create your organisation and issue XP and reputation credentials to candidates."
    >
      <div style={{ marginTop: "24px" }}>
        {hasSession ? (
          <>
            <IssuerConsole />
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
