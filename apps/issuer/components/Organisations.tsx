"use client";

import { useState } from "react";

import { OrganisationsServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_grpc_web_pb";
import {
  CreateOrganisationRequest,
  Organisation,
} from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  SectionHeader,
  siteThemes,
  tokens,
  type BadgeTone,
} from "@attestant/ui";

import type { OrgRole } from "@/components/IssuerConsole";

// Same pattern as the alis console apps: grpc-web PromiseClient pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route.
const orgsClient = new OrganisationsServicePromiseClient("/api/grpc");

const ROLE_TONE: Record<OrgRole, BadgeTone> = {
  owner: "success",
  admin: "info",
  member: "neutral",
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface OrganisationsProps {
  organisations: Organisation.AsObject[];
  /** org resource name → the caller's role, where resolvable (informational only). */
  roles: Record<string, OrgRole>;
  /** Called after an organisation is successfully created, so the list can reload. */
  onCreated: () => void;
}

export function Organisations({
  organisations,
  roles,
  onCreated,
}: OrganisationsProps): React.ReactNode {
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function create(): Promise<void> {
    setCreating(true);
    setCreateError(null);

    const organisation = new Organisation();
    organisation.setDisplayName(displayName.trim());
    organisation.setDescription(description.trim());

    const req = new CreateOrganisationRequest();
    req.setOrganisation(organisation);
    // organisation_id is left unset: the server assigns the {organisation}
    // segment of the resource name.

    try {
      await orgsClient.createOrganisation(req, {});
      setDisplayName("");
      setDescription("");
      onCreated();
    } catch (err: unknown) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <section>
        <SectionHeader>Your organisations</SectionHeader>
        {organisations.length === 0 ? (
          <EmptyState>
            You are not a member of any organisation yet. Create one below.
          </EmptyState>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "12px" }}>
            {organisations.map((org) => {
              const role = roles[org.name];
              return (
                <Card key={org.name} as="li" borderColor={siteThemes.issuer.accent}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
                    <span style={{ fontWeight: 600 }}>{org.displayName}</span>
                    {/* No chip when the caller's binding could not be resolved
                        (e.g. GetIamPolicy denied) — degrade, don't error. */}
                    {role && <Badge tone={ROLE_TONE[role]}>{role}</Badge>}
                  </div>
                  {org.description && (
                    <div style={{ opacity: 0.7, fontSize: "14px" }}>{org.description}</div>
                  )}
                  {org.hederaAccountAddress && (
                    <div
                      style={{
                        fontSize: "12px",
                        fontFamily: tokens.font.mono,
                        opacity: 0.55,
                        overflowWrap: "anywhere",
                      }}
                    >
                      Hedera account {org.hederaAccountAddress} · issuer key{" "}
                      {org.issuerPublicKey || "—"}
                    </div>
                  )}
                  <div
                    style={{ opacity: 0.5, fontSize: "12px", fontFamily: tokens.font.mono }}
                  >
                    {org.name}
                  </div>
                </Card>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader>Create an organisation</SectionHeader>
        <div style={{ display: "grid", gap: "8px", maxWidth: "420px" }}>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name, e.g. University of Cape Town"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
          />
          <Button
            onClick={() => void create()}
            disabled={displayName.trim() === ""}
            busy={creating}
            busyLabel="Creating…"
          >
            Create organisation
          </Button>
          {createError && (
            <p style={{ color: tokens.color.danger, fontSize: "14px", margin: 0 }}>
              {createError}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
