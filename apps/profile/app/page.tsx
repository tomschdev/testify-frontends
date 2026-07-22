import { SiteShell } from "@attestant/ui";

export default function Home() {
  return (
    <SiteShell
      site="profile"
      name="Profile"
      audience="For candidates"
      purpose="View the credentials you hold, sign what needs signing, and browse open positions to see whether you qualify."
    />
  );
}
