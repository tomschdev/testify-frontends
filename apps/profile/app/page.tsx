import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@attestant/auth";
import { SiteShell, siteThemes } from "@attestant/ui";

import { MyUser } from "@/components/MyUser";

const linkStyle = {
  display: "inline-block",
  marginTop: "20px",
  padding: "10px 18px",
  borderRadius: "10px",
  background: siteThemes.profile.accentSoft,
  color: siteThemes.profile.accent,
  fontWeight: 600,
  textDecoration: "none",
} as const;

export default async function Home() {
  const store = await cookies();
  const hasSession =
    store.has(ACCESS_TOKEN_COOKIE) || store.has(REFRESH_TOKEN_COOKIE);

  return (
    <SiteShell
      site="profile"
      name="Profile"
      audience="For candidates"
      purpose="View the credentials you hold, sign what needs signing, and browse open positions to see whether you qualify."
    >
      <div style={{ marginTop: "24px" }}>
        {hasSession ? (
          <>
            <MyUser />
            <a href="/auth/signout" style={{ ...linkStyle, marginRight: "12px" }}>
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
