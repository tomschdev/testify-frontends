"use client";

import { useCallback, useEffect, useState } from "react";

import { OrganisationsServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_grpc_web_pb";
import {
  CreateOrganisationRequest,
  ListMyOrganisationsRequest,
  Organisation,
} from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";

// Same pattern as the alis console apps: grpc-web PromiseClient pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route.
const orgsClient = new OrganisationsServicePromiseClient("/api/grpc");

const PAGE_SIZE = 50;

/**
 * The proxy answers status 16 with this message when the session cookie is
 * missing or unusable, and clears the cookie on that same response — so a
 * reload lands on the signed-out page.
 */
function isSessionError(message: string): boolean {
  return message.includes("no session");
}

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; organisations: Organisation.AsObject[] };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function Organisations(): React.ReactNode {
  const [state, setState] = useState<State>({ phase: "loading" });
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ListMyOrganisations scopes to the caller's memberships, so it needs no
  // parent — the identity comes from x-alis-forwarded-authorization.
  const load = useCallback(async (): Promise<void> => {
    const req = new ListMyOrganisationsRequest();
    req.setPageSize(PAGE_SIZE);
    try {
      const res = await orgsClient.listMyOrganisations(req, {});
      setState({ phase: "ready", organisations: res.toObject().organisationsList });
    } catch (err: unknown) {
      setState({ phase: "error", message: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      await load();
    } catch (err: unknown) {
      setCreateError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "20px" }}>
      <section>
        <h2 style={{ fontSize: "15px", margin: "0 0 10px", opacity: 0.75 }}>
          Your organisations
        </h2>
        {state.phase === "loading" && <p style={{ opacity: 0.7 }}>Loading organisations…</p>}
        {state.phase === "error" && isSessionError(state.message) && (
          <p style={{ color: "#fca5a5" }}>
            Your session is not valid for this app.{" "}
            <a href="/auth/signin" style={{ color: "inherit" }}>
              Sign in again
            </a>
            .
          </p>
        )}
        {state.phase === "error" && !isSessionError(state.message) && (
          <p style={{ color: "#fca5a5" }}>
            Could not fetch your organisations from the users service: {state.message}
          </p>
        )}
        {state.phase === "ready" && state.organisations.length === 0 && (
          <p style={{ opacity: 0.7 }}>
            You are not a member of any organisation yet. Create one below.
          </p>
        )}
        {state.phase === "ready" && state.organisations.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "12px" }}>
            {state.organisations.map((org) => (
              <li
                key={org.name}
                style={{
                  border: "1px solid rgba(165, 180, 252, 0.25)",
                  borderRadius: "10px",
                  padding: "12px 14px",
                }}
              >
                <div style={{ fontWeight: 600 }}>{org.displayName}</div>
                {org.description && (
                  <div style={{ opacity: 0.7, fontSize: "14px", marginTop: "4px" }}>
                    {org.description}
                  </div>
                )}
                <div
                  style={{
                    opacity: 0.5,
                    fontSize: "12px",
                    fontFamily: "monospace",
                    marginTop: "6px",
                  }}
                >
                  {org.name}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "15px", margin: "0 0 10px", opacity: 0.75 }}>
          Create an organisation
        </h2>
        <div style={{ display: "grid", gap: "8px", maxWidth: "420px" }}>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name, e.g. University of Cape Town"
            style={inputStyle}
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={() => void create()}
            disabled={creating || displayName.trim() === ""}
            style={{
              ...inputStyle,
              cursor: creating || displayName.trim() === "" ? "default" : "pointer",
              opacity: creating || displayName.trim() === "" ? 0.5 : 1,
              fontWeight: 600,
            }}
          >
            {creating ? "Creating…" : "Create organisation"}
          </button>
          {createError && (
            <p style={{ color: "#fca5a5", fontSize: "14px", margin: 0 }}>{createError}</p>
          )}
        </div>
      </section>
    </div>
  );
}

const inputStyle = {
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid #232a3a",
  borderRadius: "8px",
  padding: "9px 11px",
  color: "inherit",
  font: "inherit",
} as const;
