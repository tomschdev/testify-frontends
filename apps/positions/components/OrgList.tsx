"use client";

import { useEffect, useState } from "react";

import { GetIamPolicyRequest } from "@alis-build/google-common-protos/google/iam/v1/iam_policy_pb";
import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import { RetrieveMyUserRequest } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/user_pb";

import { Badge } from "@/components/primitives";
import { orgsClient, usersClient } from "@/lib/clients";

// TODO(shared): the Issuer brief builds this exact org-list-with-role-chip
// component for packages/ui — swap this in-app version for the shared one
// once that sprint lands it. Kept minimal here on purpose.

/**
 * ListMyOrganisations carries no role, so each org's role is resolved via
 * OrganisationsService.GetIamPolicy: find the binding whose members include
 * the signed-in user (`user:{id}`, per the backend's owner-binding shape).
 * A denied or failed policy read degrades to no chip — membership is still
 * shown, just unlabelled.
 */
const ROLE_LABELS: Record<string, string> = {
  "roles/organisations.owner": "owner",
  "roles/organisations.admin": "admin",
  "roles/organisations.member": "member",
};

type RolesState =
  | { phase: "loading" }
  | { phase: "ready"; roles: ReadonlyMap<string, string> };

async function resolveRoles(
  organisations: readonly Organisation.AsObject[],
): Promise<ReadonlyMap<string, string>> {
  const roles = new Map<string, string>();

  let member: string;
  try {
    const me = await usersClient.retrieveMyUser(new RetrieveMyUserRequest(), {});
    // "users/{id}" → IAM member string "user:{id}".
    const id = me.getName().split("/")[1] ?? "";
    if (id === "") {
      return roles;
    }
    member = `user:${id}`;
  } catch {
    return roles; // cannot know who we are → no chips, degrade quietly
  }

  await Promise.all(
    organisations.map(async (org) => {
      try {
        const req = new GetIamPolicyRequest();
        req.setResource(org.name);
        const policy = await orgsClient.getIamPolicy(req, {});
        for (const binding of policy.getBindingsList()) {
          if (binding.getMembersList().includes(member)) {
            const label = ROLE_LABELS[binding.getRole()];
            if (label) {
              roles.set(org.name, label);
              return;
            }
          }
        }
      } catch {
        // GetIamPolicy denied (e.g. plain member without the permission on
        // some deployments) or unavailable — leave this org chip-less.
      }
    }),
  );
  return roles;
}

export function OrgList({
  organisations,
}: {
  organisations: readonly Organisation.AsObject[];
}): React.ReactNode {
  const [state, setState] = useState<RolesState>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    void resolveRoles(organisations).then((roles) => {
      if (!cancelled) {
        setState({ phase: "ready", roles });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [organisations]);

  if (organisations.length === 0) {
    return (
      <p style={{ opacity: 0.7 }}>
        You are not a member of any organisation yet. Create one in the{" "}
        <a href="https://attestant-issuer.vercel.app" style={{ color: "inherit" }}>
          Issuer console
        </a>
        .
      </p>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "8px" }}>
      {organisations.map((org) => {
        const role = state.phase === "ready" ? state.roles.get(org.name) : undefined;
        return (
          <li
            key={org.name}
            style={{
              border: "1px solid #232a3a",
              borderRadius: "8px",
              padding: "8px 12px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span style={{ fontWeight: 600 }}>{org.displayName || org.name}</span>
            {role ? (
              <Badge>{role}</Badge>
            ) : (
              state.phase === "loading" && (
                <span style={{ fontSize: "11px", opacity: 0.5 }}>resolving role…</span>
              )
            )}
            <span
              style={{
                marginLeft: "auto",
                fontSize: "11px",
                fontFamily: "monospace",
                opacity: 0.5,
              }}
            >
              {org.name}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
