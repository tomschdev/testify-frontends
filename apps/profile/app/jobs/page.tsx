import { SiteShell } from "@attestant/ui";

import { JobsPanel } from "@/components/JobsPanel";
import { ProfileNav } from "@/components/ProfileNav";
import { hasSessionCookies } from "@/lib/session";

export default async function JobsPage() {
  // The feed is public (§3.6) — no gate here. The session only unlocks the
  // qualify check and the "Jobs I qualify for" toggle.
  const hasSession = await hasSessionCookies();

  return (
    <SiteShell
      site="profile"
      name="Jobs"
      audience="For candidates"
      purpose="Every posted position, with a live check of whether your credentials qualify you."
    >
      <ProfileNav active="/jobs" />
      <JobsPanel hasSession={hasSession} />
    </SiteShell>
  );
}
