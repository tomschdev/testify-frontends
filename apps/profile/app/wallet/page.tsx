import { SiteShell } from "@attestant/ui";

import { ProfileNav } from "@/components/ProfileNav";
import { SignInPrompt } from "@/components/SignInPrompt";
import { WalletPanel } from "@/components/WalletPanel";
import { hasSessionCookies } from "@/lib/session";

export default async function WalletPage() {
  const hasSession = await hasSessionCookies();

  return (
    <SiteShell
      site="profile"
      name="Wallet"
      audience="For candidates"
      purpose="Reward token balances — sample data only in this proof of concept."
    >
      <ProfileNav active="/wallet" />
      {hasSession ? <WalletPanel /> : <SignInPrompt what="your wallet" />}
    </SiteShell>
  );
}
