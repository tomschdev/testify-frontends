import { AuthAction, ProfileShell } from "@/components/ProfileShell";
import { SignInPrompt } from "@/components/SignInPrompt";
import { WalletPanel } from "@/components/WalletPanel";
import { hasSessionCookies } from "@/lib/session";

export default async function WalletPage() {
  const hasSession = await hasSessionCookies();

  return (
    <ProfileShell active="/wallet" title="Wallet" actions={<AuthAction hasSession={hasSession} />}>
      {hasSession ? <WalletPanel /> : <SignInPrompt what="your wallet" />}
    </ProfileShell>
  );
}
