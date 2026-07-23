import { CredentialsPanel } from "@/components/CredentialsPanel";
import { AuthAction, ProfileShell } from "@/components/ProfileShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { hasSessionCookies } from "@/lib/session";

export default async function CredentialsPage() {
  const hasSession = await hasSessionCookies();

  return (
    <ProfileShell
      active="/credentials"
      title="Credentials"
      actions={<AuthAction hasSession={hasSession} />}
    >
      {/* Session-gated: this is the user's own data and must never be served
          via the SA-only path (impl spec §6.1). */}
      {hasSession ? <CredentialsPanel /> : <SignInPrompt what="the credentials you hold" />}
    </ProfileShell>
  );
}
