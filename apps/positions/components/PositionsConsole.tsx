"use client";

import { useEffect, useState } from "react";

import { Panel, PanelGrid, tokens } from "@attestant/ui";

import {
  ListMyOrganisationsRequest,
  Organisation,
} from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";

import { CreatePosition } from "@/components/CreatePosition";
import { OrgList } from "@/components/OrgList";
import { PositionsList } from "@/components/PositionsList";
import { orgsClient } from "@/lib/clients";
import { errorMessage, isSessionError } from "@/lib/grpcError";

const PAGE_SIZE = 50;

type OrgsState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; organisations: Organisation.AsObject[] };

/**
 * Signed-in console body: post a position, see it appear in the list. The
 * user's organisations are fetched once here (ListMyOrganisations scopes to
 * the caller — identity comes from x-alis-forwarded-authorization) and shared
 * by the children: the org section shows them with roles, the form needs
 * them as posting targets, the list needs them to show the on-chain identity
 * behind each of the user's own positions.
 */
export function PositionsConsole(): React.ReactNode {
  const [orgs, setOrgs] = useState<OrgsState>({ phase: "loading" });
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    const req = new ListMyOrganisationsRequest();
    req.setPageSize(PAGE_SIZE);
    orgsClient
      .listMyOrganisations(req, {})
      .then((res) =>
        setOrgs({ phase: "ready", organisations: res.toObject().organisationsList }),
      )
      .catch((err: unknown) => {
        setOrgs({ phase: "error", message: errorMessage(err) });
      });
  }, []);

  if (orgs.phase === "loading") {
    return <p style={{ opacity: 0.7 }}>Loading your organisations…</p>;
  }
  if (orgs.phase === "error") {
    if (isSessionError(orgs.message)) {
      return (
        <p style={{ color: tokens.color.danger }}>
          Your session is not valid for this app.{" "}
          <a href="/auth/signin" style={{ color: "inherit" }}>
            Sign in again
          </a>
          .
        </p>
      );
    }
    return (
      <p style={{ color: tokens.color.danger }}>
        Could not fetch your organisations from the users service: {orgs.message}
      </p>
    );
  }

  return (
    <PanelGrid>
      {/* Identity — the organisations you can post as. */}
      <Panel title="Your organisations" accent={tokens.palette.primary}>
        <OrgList organisations={orgs.organisations} />
      </Panel>

      {/* Action — author a new position. */}
      <Panel title="Post a position" accent={tokens.palette.secondary}>
        <CreatePosition
          organisations={orgs.organisations}
          onCreated={() => setRefreshToken((n) => n + 1)}
        />
      </Panel>

      {/* The live list of everything posted. */}
      <Panel wide title="Positions" accent={tokens.color.ink}>
        <PositionsList
          organisations={orgs.organisations}
          refreshToken={refreshToken}
          onChanged={() => setRefreshToken((n) => n + 1)}
        />
      </Panel>
    </PanelGrid>
  );
}
