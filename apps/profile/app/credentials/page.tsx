import { SiteShell } from "@attestant/ui";

import { CredentialsPanel } from "@/components/CredentialsPanel";
import { ProfileNav } from "@/components/ProfileNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { hasSessionCookies } from "@/lib/session";

export default async function CredentialsPage() {
  const hasSession = await hasSessionCookies();

  return (
    <SiteShell
      site="profile"
      name="Credentials"
      audience="For candidates"
      purpose="The XP and reputation credentials you hold, read from the Hedera mirror node."
    >
      <ProfileNav active="/credentials" />
      {/* Session-gated: this is the user's own data and must never be served
          via the SA-only path (impl spec §6.1). */}
      {hasSession ? <CredentialsPanel /> : <SignInPrompt what="the credentials you hold" />}
    </SiteShell>
  );
}
