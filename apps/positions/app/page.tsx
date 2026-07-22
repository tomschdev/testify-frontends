import { SiteShell } from "@attestant/ui";

export default function Home() {
  return (
    <SiteShell
      site="positions"
      name="Positions Console"
      audience="For organisations"
      purpose="Create positions as chained credential filters, so candidates can be matched on the credentials they hold."
    />
  );
}
