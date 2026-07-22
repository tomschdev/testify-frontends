"use client";

import { useState } from "react";

import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import { PositionsServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_grpc_web_pb";
import {
  CreatePositionRequest,
  Filter,
  Position,
  Requirements,
} from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_pb";

// Same pattern as the alis console apps: grpc-web PromiseClient pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route.
const positionsClient = new PositionsServicePromiseClient("/api/grpc");

/**
 * The POC predicate is fixed: holds an XP Credential AND a Reputation
 * Credential issued by this organisation. MirrorService.SearchProfiles
 * enforces exactly that regardless of the filter text, so these filters exist
 * for display and audit — there is deliberately no filter-authoring UI
 * (console spec §4.3).
 */
function pocRequirementCriteria(orgName: string): readonly string[] {
  return [
    `Holds an XP Credential issued by ${orgName}`,
    `Holds a Reputation Credential issued by ${orgName}`,
  ];
}

function buildRequirements(orgName: string): Requirements {
  const requirements = new Requirements();
  requirements.setFiltersList(
    pocRequirementCriteria(orgName).map((criteria) => {
      const filter = new Filter();
      filter.setNaturalLanguageCriteria(criteria);
      filter.setActive(true);
      return filter;
    }),
  );
  return requirements;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface CreatePositionProps {
  /** The signed-in user's organisations — posting targets. */
  organisations: Organisation.AsObject[];
  /** Called after a position is successfully created, so the list can reload. */
  onCreated: () => void;
}

export function CreatePosition({
  organisations,
  onCreated,
}: CreatePositionProps): React.ReactNode {
  const [orgName, setOrgName] = useState(organisations[0]?.name ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  async function post(): Promise<void> {
    setPosting(true);
    setPostError(null);

    const position = new Position();
    position.setTitle(title.trim());
    position.setDescription(description.trim());
    position.setRequirements(buildRequirements(orgName));

    const req = new CreatePositionRequest();
    req.setParent(orgName);
    req.setPosition(position);
    // position_id is left unset: the server assigns the {position} segment of
    // the resource name.

    try {
      await positionsClient.createPosition(req, {});
      setTitle("");
      setDescription("");
      onCreated();
    } catch (err: unknown) {
      setPostError(errorMessage(err));
    } finally {
      setPosting(false);
    }
  }

  if (organisations.length === 0) {
    return (
      <p style={{ opacity: 0.7 }}>
        Posting a position requires an organisation, and you are not a member of
        any yet. Create one in the{" "}
        <a href="https://attestant-issuer.vercel.app" style={{ color: "inherit" }}>
          Issuer console
        </a>{" "}
        first.
      </p>
    );
  }

  const selectedOrg = organisations.find((org) => org.name === orgName);
  const canPost = !posting && orgName !== "" && title.trim() !== "";

  return (
    <div style={{ display: "grid", gap: "8px", maxWidth: "480px" }}>
      <label style={{ fontSize: "13px", opacity: 0.75 }}>
        Posting as
        <select
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          style={{ ...inputStyle, display: "block", width: "100%", marginTop: "4px" }}
        >
          {organisations.map((org) => (
            <option key={org.name} value={org.name}>
              {org.displayName}
            </option>
          ))}
        </select>
      </label>
      {selectedOrg && (
        <div style={{ fontSize: "12px", fontFamily: "monospace", opacity: 0.55 }}>
          Hedera account {selectedOrg.hederaAccountAddress || "—"} · issuer key{" "}
          {selectedOrg.issuerPublicKey || "—"}
        </div>
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title, e.g. Credentialed Engineer"
        style={inputStyle}
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        style={inputStyle}
      />
      <div
        style={{
          border: "1px solid rgba(252, 165, 165, 0.25)",
          borderRadius: "8px",
          padding: "10px 12px",
          fontSize: "13px",
        }}
      >
        <div style={{ opacity: 0.75, marginBottom: "6px" }}>
          Candidates qualify when they hold both:
        </div>
        <ul style={{ margin: 0, paddingLeft: "18px", opacity: 0.85 }}>
          {pocRequirementCriteria(orgName).map((criteria) => (
            <li key={criteria}>{criteria}</li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => void post()}
        disabled={!canPost}
        style={{
          ...inputStyle,
          cursor: canPost ? "pointer" : "default",
          opacity: canPost ? 1 : 0.5,
          fontWeight: 600,
        }}
      >
        {posting ? "Posting…" : "Post position"}
      </button>
      {postError && (
        <p style={{ color: "#fca5a5", fontSize: "14px", margin: 0 }}>{postError}</p>
      )}
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
