/**
 * Hedera network + block-explorer configuration, shared by every console.
 *
 * The backend runs on one network at a time; a mainnet id under a testnet
 * explorer path resolves to nothing, so the network is configuration, not a
 * per-call argument. Default is testnet (the deployment the POC backend
 * provisions accounts on); override per app with `NEXT_PUBLIC_HEDERA_NETWORK`.
 */

// `packages/ui` has no @types/node (it is a React-only package) and this is
// the one place it reads an env var. Declaring the shape used here keeps the
// package's dependency surface unchanged; consuming apps that do have
// @types/node resolve the same shape.
declare const process: { env: Record<string, string | undefined> };

export type HederaNetwork = "mainnet" | "testnet" | "previewnet";

const NETWORKS: readonly HederaNetwork[] = ["mainnet", "testnet", "previewnet"];

export const DEFAULT_HEDERA_NETWORK: HederaNetwork = "testnet";

/**
 * The network every `HederaRef` links against unless given an explicit
 * `network` prop. Reads `NEXT_PUBLIC_HEDERA_NETWORK` — which Next inlines at
 * build time, so this is safe in both server and client components — and
 * falls back to testnet on anything unrecognised rather than emitting a
 * broken explorer path.
 */
export function hederaNetwork(): HederaNetwork {
  const configured = process.env.NEXT_PUBLIC_HEDERA_NETWORK;
  return NETWORKS.find((n) => n === configured) ?? DEFAULT_HEDERA_NETWORK;
}

/**
 * Reference kinds. Deliberately covers only values that are safe to render in
 * a browser: account ids, token ids, topic ids and message coordinates, public
 * keys, EVM addresses and content hashes.
 *
 * There is no private-key kind, and there must never be one. `User.private_key`
 * and `Organisation.private_key` come back on FULL reads (POC custody: the
 * platform holds the wallet) and are used server-side at signing time only. A
 * private key reaching a client component's props is a bug, not a missing
 * variant here.
 */
export type HederaRefKind =
  | "account"
  | "token"
  | "topic"
  | "topic-message"
  | "key"
  | "evm"
  | "hash";

/** Human label per kind, so the same id reads the same everywhere. */
export const hederaRefLabels: Record<HederaRefKind, string> = {
  account: "Account",
  token: "Token",
  topic: "Topic",
  "topic-message": "Topic message",
  key: "Public key",
  evm: "EVM address",
  hash: "Content hash",
};

const EXPLORER_BASE = "https://hashscan.io";

export interface HashscanUrlOptions {
  /** `topic-message` only. Displayed alongside the link; see below. */
  sequenceNumber?: number | string;
  /** `token` only — deep-links the individual NFT rather than the collection. */
  serialNumber?: number | string;
}

/**
 * Explorer URL for a reference, or `null` for the kinds that have no canonical
 * explorer page (`key`, `evm`, `hash`) — those are identity, not navigation,
 * and render unlinked.
 *
 * Paths follow HashScan's own router table (verified against its route
 * definitions, 2026-07): `/{network}/account/{id}`, `/{network}/token/{id}`,
 * `/{network}/token/{id}/{serial}`, `/{network}/topic/{id}` with a `messages`
 * child tab.
 *
 * Note on `topic-message`: HashScan has **no** per-sequence message route —
 * `topic/{id}` accepts only the `messages` / `others` child tabs, and anything
 * else falls through its catch-all to page-not-found. So a message reference
 * links to the topic's Messages tab and renders the sequence number as text.
 * If HashScan later gains a real deep link, this is the one place to change.
 */
export function hashscanUrl(
  kind: HederaRefKind,
  value: string,
  network: HederaNetwork,
  options: HashscanUrlOptions = {},
): string | null {
  if (value === "") {
    return null;
  }
  const id = encodeURIComponent(value);
  switch (kind) {
    case "account":
      return `${EXPLORER_BASE}/${network}/account/${id}`;
    case "token": {
      const token = `${EXPLORER_BASE}/${network}/token/${id}`;
      const { serialNumber } = options;
      if (serialNumber === undefined || serialNumber === "" || Number(serialNumber) === 0) {
        return token;
      }
      return `${token}/${encodeURIComponent(String(serialNumber))}`;
    }
    case "topic":
      return `${EXPLORER_BASE}/${network}/topic/${id}`;
    case "topic-message":
      return `${EXPLORER_BASE}/${network}/topic/${id}/messages`;
    case "key":
    case "evm":
    case "hash":
      return null;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * Middle-elides long values (keys, hashes, EVM addresses) for display. The
 * full value is always what gets copied and what the `title` attribute shows —
 * only the rendered glyphs are shortened.
 */
export function elideMiddle(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 1) {
    return value;
  }
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
