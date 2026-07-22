import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@attestant/auth";
import { SiteShell, siteThemes } from "@attestant/ui";

import { Organisations } from "@/components/Organisations";

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
      purpose="Create your organisation, mint XP tokens, and issue XP and reputation credentials to candidates."
    >
      <div style={{ marginTop: "24px" }}>
        {hasSession ? (
          <>
            <Organisations />
            <p style={{ opacity: 0.55, fontSize: "13px", marginTop: "20px" }}>
              Credential issuance and XP minting are not wired up yet: the
              vendored protobuf bundle ships no generated client for the issue
              service.
            </p>
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
