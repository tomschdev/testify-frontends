"use client";

import { useCallback, useEffect, useState } from "react";

import { GetIamPolicyRequest } from "@alis-build/google-common-protos/google/iam/v1/iam_policy_pb";
import { OrganisationsServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_grpc_web_pb";
import {
  ListMyOrganisationsRequest,
  Organisation,
  OrganisationView,
} from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import { UsersServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/user_grpc_web_pb";
import { RetrieveMyUserRequest } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/user_pb";
import { EmptyState, ErrorState, Panel, PanelGrid, tokens } from "@attestant/ui";

import { IssueCredentialForm } from "@/components/IssueCredentialForm";
import { Organisations } from "@/components/Organisations";
import { RecentlyIssued, type IssuedEntry } from "@/components/RecentlyIssued";

// Same pattern as the alis console apps: grpc-web PromiseClient pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route.
const orgsClient = new OrganisationsServicePromiseClient("/api/grpc");
const usersClient = new UsersServicePromiseClient("/api/grpc");

const PAGE_SIZE = 50;

/** Informational only — nothing is permission-gated by role yet (feature-list §4 open question). */
export type OrgRole = "owner" | "admin" | "member";

const ROLE_BY_BINDING: Record<string, OrgRole> = {
  "roles/organisations.owner": "owner",
  "roles/organisations.admin": "admin",
  "roles/organisations.member": "member",
};

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type OrgsState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; organisations: Organisation.AsObject[] };

/**
 * Signed-in console body. The user's organisations are fetched once here and
 * shared by all sections: the org list shows them with the caller's role, the
 * issue forms need them as issuing identities, and the recently-issued list
 * needs the issuer account to confirm credentials against the mirror node.
 */
export function IssuerConsole(): React.ReactNode {
  const [orgs, setOrgs] = useState<OrgsState>({ phase: "loading" });
  // org resource name → the signed-in user's role on it. Absent while the
  // policy read is in flight or when GetIamPolicy is denied for this caller —
  // the org then renders without a role chip rather than erroring the list.
  const [roles, setRoles] = useState<Record<string, OrgRole>>({});
  // Session-local list of this session's issuances (no issuer-scoped listing
  // RPC exists — ListCredentials is holder-scoped), newest first.
  const [issued, setIssued] = useState<IssuedEntry[]>([]);

  const load = useCallback(async (): Promise<void> => {
    const req = new ListMyOrganisationsRequest();
    req.setPageSize(PAGE_SIZE);
    // FULL view: the issue flow needs hedera_account_address as the issuer
    // identity (the default BASIC view strips it).
    req.setView(OrganisationView.ORGANISATION_VIEW_FULL);

    let organisations: Organisation.AsObject[];
    try {
      const res = await orgsClient.listMyOrganisations(req, {});
      organisations = res.toObject().organisationsList;
      setOrgs({ phase: "ready", organisations });
    } catch (err: unknown) {
      setOrgs({ phase: "error", message: errorMessage(err) });
      return;
    }

    // Roles are IAM bindings on each organisation — ListMyOrganisations has no
    // role field. Resolve the caller's binding per org; failures (including
    // PermissionDenied for plain members on some policies) degrade to no chip.
    try {
      const me = await usersClient.retrieveMyUser(new RetrieveMyUserRequest(), {});
      // Bindings hold "user:{id}" where {id} is the user resource id.
      const principal = `user:${me.getName().replace(/^users\//, "")}`;
      const results = await Promise.allSettled(
        organisations.map(async (org) => {
          const policyReq = new GetIamPolicyRequest();
          policyReq.setResource(org.name);
          const policy = await orgsClient.getIamPolicy(policyReq, {});
          const binding = policy
            .getBindingsList()
            .find((b) => b.getMembersList().includes(principal));
          const role = binding ? ROLE_BY_BINDING[binding.getRole()] : undefined;
          return { name: org.name, role };
        }),
      );
      const next: Record<string, OrgRole> = {};
      for (const result of results) {
        if (result.status === "fulfilled" && result.value.role) {
          next[result.value.name] = result.value.role;
        }
      }
      setRoles(next);
    } catch {
      // Role display is informational; the org list stands without it.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (orgs.phase === "loading") {
    return <EmptyState>Loading your organisations…</EmptyState>;
  }
  if (orgs.phase === "error") {
    return (
      <ErrorState
        context="Could not fetch your organisations from the users service"
        message={orgs.message}
      />
    );
  }

  const issuable = orgs.organisations.filter((org) => org.hederaAccountAddress !== "");

  const needsIdentity = (
    <EmptyState>
      Issuing needs an organisation with an on-chain identity. Create one in
      Organisations.
    </EmptyState>
  );

  return (
    <PanelGrid>
      {/* Identity — who you are and who you can issue as. */}
      <Panel wide title="Organisations" accent={tokens.palette.primary}>
        <Organisations
          organisations={orgs.organisations}
          roles={roles}
          onCreated={() => void load()}
        />
      </Panel>

      {/* Issuing actions — two credential types, side by side. */}
      <Panel title="Issue XP credential" accent={tokens.palette.secondary}>
        {issuable.length === 0 ? (
          needsIdentity
        ) : (
          <IssueCredentialForm
            variant="xp"
            organisations={issuable}
            onIssued={(entry) => setIssued((list) => [entry, ...list])}
          />
        )}
      </Panel>

      <Panel title="Issue reputation credential" accent={tokens.palette.tertiary}>
        {issuable.length === 0 ? (
          needsIdentity
        ) : (
          <IssueCredentialForm
            variant="reputation"
            organisations={issuable}
            onIssued={(entry) => setIssued((list) => [entry, ...list])}
          />
        )}
      </Panel>

      {/* Audit log — confirmation of what this session issued. */}
      <Panel wide title="Recently issued" accent={tokens.color.ink}>
        <RecentlyIssued entries={issued} />
      </Panel>
    </PanelGrid>
  );
}
