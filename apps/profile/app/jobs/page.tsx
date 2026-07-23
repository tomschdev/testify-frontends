import { JobsPanel } from "@/components/JobsPanel";
import { AuthAction, ProfileShell } from "@/components/ProfileShell";
import { hasSessionCookies } from "@/lib/session";

export default async function JobsPage() {
  // The feed is public (§3.6) — no gate here. The session only unlocks the
  // qualify check and the "Jobs I qualify for" toggle.
  const hasSession = await hasSessionCookies();

  return (
    <ProfileShell active="/jobs" title="Jobs" actions={<AuthAction hasSession={hasSession} />}>
      <JobsPanel hasSession={hasSession} />
    </ProfileShell>
  );
}
