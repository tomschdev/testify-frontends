import { Panel } from "@attestant/ui";

import { MyUser } from "@/components/MyUser";
import { AuthAction, ProfileShell } from "@/components/ProfileShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { hasSessionCookies } from "@/lib/session";

export default async function Home() {
  const hasSession = await hasSessionCookies();

  return (
    <ProfileShell active="/" title="Profile" actions={<AuthAction hasSession={hasSession} />}>
      <Panel title="Account">
        {hasSession ? <MyUser /> : <SignInPrompt what="your profile" />}
      </Panel>
    </ProfileShell>
  );
}
