import { Panel } from "@attestant/ui";

import { CredentialsPanel } from "@/components/CredentialsPanel";
import { MyUser } from "@/components/MyUser";
import { AuthAction, ProfileShell } from "@/components/ProfileShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { hasSessionCookies } from "@/lib/session";

export default async function Home() {
  const hasSession = await hasSessionCookies();

  return (
    <ProfileShell active="/" title="Profile" actions={<AuthAction hasSession={hasSession} />}>
      <div style={{ display: "grid", gap: "16px" }}>
        <Panel title="Account">
          {hasSession ? <MyUser /> : <SignInPrompt what="your profile" />}
        </Panel>
        {/* Session-gated: this is the user's own data and must never be served
            via the SA-only path (impl spec §6.1). */}
        <Panel title="Credentials">
          {hasSession ? <CredentialsPanel /> : <SignInPrompt what="the credentials you hold" />}
        </Panel>
      </div>
    </ProfileShell>
  );
}
