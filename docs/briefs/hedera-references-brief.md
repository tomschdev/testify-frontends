# Brief — On-chain references on every Hedera-backed resource (cross-cutting)

Every resource that has a presence on Hedera must render its Hedera data, in a
single consistent way, linked to a block explorer. This spans all three apps and
is owned by `packages/ui` — not reimplemented per app. The positions console
already does this ad-hoc inline in `PositionCard.tsx` ("On-chain" block: HCS
topic, latest sequence, issuer account, issuer key); that inline version is the
thing being replaced, not extended.

## The shared component (build in `packages/ui`, export from index)

A small family, driven by the reference *type* so the explorer link and label
are always correct:

- `HederaRef({ kind, value, network? })` — one monospace, copyable, linked
  reference. `kind` ∈ `account | token | topic | topic-message | key | evm |
  hash`. Renders the value (elided in the middle for long keys/hashes), a copy
  affordance, and — for the linkable kinds — an anchor to the explorer.
- `OnChainPanel({ title?, children })` — the bordered "On-chain" section wrapper
  the resource cards use, so the block looks identical on a position, a
  credential, an org and a user.
- Explorer + network config: default network **testnet** (backend runs Hedera
  testnet per `docs/context/TECHNICAL.md`), overridable via a
  `NEXT_PUBLIC_HEDERA_NETWORK` env var. **Verify the deployed backend's network
  before shipping links** — a mainnet id under a testnet explorer path 404s.
  HashScan URL shapes: account `/{network}/account/{id}`, token
  `/{network}/token/{id}`, topic `/{network}/topic/{id}`; confirm the
  topic-message deep-link form during verification rather than guessing it —
  fall back to the topic link + a shown sequence number if it's uncertain.
- `key`, `evm` and `hash` kinds render + copy but **do not link** (no canonical
  explorer page); show them as identity, not navigation.

## Resource → fields to render (from the protos, exhaustively)

| Resource | Fields (proto) | `HederaRef` kinds |
|---|---|---|
| **Position** | `hcs_record.topic_id`, `hcs_record.latest_sequence_number` | topic, topic-message (topic + seq) |
| **Organisation** | `hedera_account_address`, `issuer_public_key` | account, key |
| **User** | `hedera_account_address`, `public_key` | account, key |
| **Credential** (issuance submit response) | `topicId`, `sequenceNumber`, `contentHash`, `tokenId`, `serial` | topic, topic-message, hash, token (+ serial shown) |
| **Credential** (mirror `ListCredentials`) | `issuer`, `subject` (both account ids), `issue_time` | account, account |
| **Token** (`GetToken`) | `token_id`, `name`, `symbol`, `type` | token |
| **TokenHolding** | `token_id`, `balance` | token (+ balance shown) |
| **HederaAccount** (`GetHederaAccount`) | `account_id`, `public_key`, `evm_address`, `hbar_balance` | account, key, evm |

Any resource that later gains a Hedera field renders it through the same
component — the table is the current set, not a ceiling.

## SECURITY — hard rule

`User.private_key` and `Organisation.private_key` are returned by the backend on
FULL view / read-mask (POC custody: platform-is-the-wallet). **These must NEVER
be rendered, logged, copied, or sent to the browser.** The issuer console fetches
`private_key` server-side at signing time only; it does not travel to any
component. `HederaRef` has no `key`-private kind by design — if a private key is
ever in a client component's props, that's the bug. Treat this as the one
invariant of this brief.

## Where each app wires it in

- **Positions** (`apps/positions`): replace the inline "On-chain" block in
  `PositionCard.tsx` with `OnChainPanel` + `HederaRef` (position topic/sequence,
  and the owning org's account + issuer key when visible). Behaviour parity with
  today, including the honest "not anchored to HCS" / "outside your memberships"
  fallbacks — keep those messages.
- **Issuer** (`apps/issuer`): org list rows show the org's account + issuer key;
  the recently-issued list shows each credential's topic/sequence/contentHash/
  token+serial from the submit response.
- **Profile** (`apps/profile`): the user's own account + public key (a small
  identity header); each credential row shows issuer + subject accounts and its
  on-chain anchor; XP token rows show token id via `HederaRef`.

## Consistency requirement

The point is uniformity: a topic id looks and links the same on a position card,
a credential row, and anywhere else. No app keeps a bespoke on-chain renderer
after this — if two implementations exist, one is wrong (impl spec §5).

## Parallel-work note

The three console sprints are running concurrently in this same working tree.
`packages/ui` is shared and actively churning (it already gained
`primitives.tsx`, `states.tsx`, `useBoundedPoll.ts`). Add `HederaRef` /
`OnChainPanel` as new files + new index exports; do not rewrite existing
primitives. Each console adopts the component as it reaches its on-chain
rendering — positions first (it has the live example to port).

## Verification

`npx tsc --noEmit` in `packages/ui` and each touched app. In the browser:
resolve one real account, one token, one topic, and one topic-message link and
confirm each opens the correct explorer page on the correct network. Grep the
client bundle for `private_key` / `privateKey` and confirm it never appears in
any app's client output.
