import { cookies } from "next/headers";

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@attestant/auth";
import { SiteShell, siteThemes, tokens } from "@attestant/ui";

import { MyUser } from "@/components/MyUser";
import { ProfileNav } from "@/components/ProfileNav";

const linkStyle = {
  display: "inline-block",
  marginTop: "20px",
  padding: "10px 18px",
  borderRadius: tokens.radius.md,
  background: siteThemes.profile.accent,
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
      site="profile"
      name="Profile"
      audience="For candidates"
      purpose="View the credentials you hold, sign what needs signing, and browse open positions to see whether you qualify."
    >
      <ProfileNav />
      <div style={{ marginTop: "24px" }}>
        {hasSession ? (
          <>
            <MyUser />
            <a href="/auth/signout" className="neo-interactive" style={{ ...linkStyle, marginRight: "12px" }}>
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
