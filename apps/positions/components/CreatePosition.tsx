"use client";

import { useState } from "react";

import { HederaInfo, HederaRef, tokens } from "@attestant/ui";
import { requirementsFromFilters } from "@attestant/filter-spec";
import { Organisation } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_pb";
import {
  CreatePositionRequest,
  Position,
  Requirements,
} from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_pb";

import {
  draftIsValid,
  draftsHaveDuplicates,
  draftToProto,
  FilterBuilder,
  newDraftFilter,
  type DraftFilter,
} from "@/components/FilterBuilder";
import { positionsClient } from "@/lib/clients";
import { errorMessage } from "@/lib/grpcError";
import { composeDescription } from "@/lib/location";

export function buildRequirements(drafts: readonly DraftFilter[]): Requirements {
  return requirementsFromFilters(drafts.map(draftToProto));
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
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  // Filters name issuers by Hedera account id, so the posting org's default
  // issuer is its account address — not its resource name.
  const defaultIssuer =
    organisations.find((org) => org.name === orgName)?.hederaAccountAddress ?? "";
  const [drafts, setDrafts] = useState<DraftFilter[]>(() =>
    defaultIssuer === "" ? [] : [newDraftFilter(defaultIssuer)],
  );
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  async function post(): Promise<void> {
    setPosting(true);
    setPostError(null);

    const position = new Position();
    position.setTitle(title.trim());
    // Position has no location field (positions.proto) — location travels
    // inside description under a "Location:" label; see lib/location.ts,
    // where a first-class field is flagged as a backend request.
    position.setDescription(composeDescription(location, description));
    position.setRequirements(buildRequirements(drafts));

    const req = new CreatePositionRequest();
    req.setParent(orgName);
    req.setPosition(position);
    // position_id is left unset: the server assigns the {position} segment of
    // the resource name.

    try {
      await positionsClient.createPosition(req, {});
      setTitle("");
      setLocation("");
      setDescription("");
      setDrafts([newDraftFilter(defaultIssuer)]);
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
  const filtersValid =
    drafts.length > 0 && // at least one filter, authored at creation time
    drafts.every(draftIsValid) &&
    !draftsHaveDuplicates(drafts);
  const canPost = !posting && orgName !== "" && title.trim() !== "" && filtersValid;

  return (
    // minWidth: 0 so a wide child shrinks with the panel instead of widening
    // the grid past it — the panel has no horizontal scroll to fall back on.
    <div style={{ display: "grid", gap: "8px", maxWidth: "560px", minWidth: 0 }}>
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
      {/* Complementary: which on-chain identity the post will be signed with.
          Nothing here is acted on while filling the form, so it sits behind
          the ⓘ rather than pushing the fields down. */}
      {selectedOrg && (
        <HederaInfo title="Posting identity">
          <HederaRef
            kind="account"
            label="Hedera account"
            value={selectedOrg.hederaAccountAddress}
          />
          <HederaRef kind="key" label="Issuer key" value={selectedOrg.issuerPublicKey} />
        </HederaInfo>
      )}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title, e.g. Credentialed Engineer"
        style={inputStyle}
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Location, e.g. Zurich (stored in the description — Position has no location field)"
        style={inputStyle}
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description"
        style={inputStyle}
      />

      <div style={{ fontSize: "13px", opacity: 0.75, marginTop: "4px" }}>
        Requirement filters — candidates must satisfy <em>all</em> active
        filters (AND); at least one is required.
      </div>
      <FilterBuilder
        drafts={drafts}
        onChange={setDrafts}
        organisations={organisations}
        defaultIssuer={defaultIssuer}
      />
      {drafts.length === 0 && (
        <p style={{ color: tokens.color.warning, fontSize: "12px", margin: 0 }}>
          Add at least one filter to post this position.
        </p>
      )}

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
        <p style={{ color: tokens.color.danger, fontSize: "14px", margin: 0 }}>{postError}</p>
      )}
    </div>
  );
}

const inputStyle = {
  // An <input> sizes itself from its `size` attribute and a grid item's
  // min-width defaults to that intrinsic width; both must be neutralised or
  // the field pushes the form wider than the panel.
  width: "100%",
  minWidth: 0,
  background: tokens.color.surface,
  border: `${tokens.border.default} solid ${tokens.color.border}`,
  borderRadius: tokens.radius.md,
  padding: "9px 11px",
  color: "inherit",
  font: "inherit",
  fontWeight: 600,
} as const;
