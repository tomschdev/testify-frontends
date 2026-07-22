import { SiteShell } from "@attestant/ui";

export default function Home() {
  return (
    <SiteShell
      site="issuer"
      name="Issuer Console"
      audience="For organisations"
      purpose="Create your organisation, mint XP tokens, and issue XP and reputation credentials to candidates."
    />
  );
}
