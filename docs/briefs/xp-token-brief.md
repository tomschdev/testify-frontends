# Brief — XP Tokens (issuer console §1.7–1.8)

Backend surface shipped 2026-07-23 (backend brief:
`ti/docs/verticals/issuance/briefs/2026-07-23_slice-2-xp-tokens.md`). This
unblocks the two feature-list items previously marked **do-not-build** in
`issuer-console-brief.md` §Blockers.

Audience: organisations, in `apps/issuer`. Job: create the org's XP token
once, then issue XP amounts from it to candidate accounts.

Read first: `issuer-console-brief.md` (the §1.5–1.6 issuance flow — XP tokens
reuse its signing helper and error handling verbatim).
Backend source of truth: `ti/issue/v1/main.go` and
`ti/docs/verticals/issuance/specification/specification.md` §XP tokens.

## The two flows

Both are the same two-leg pattern as credential issuance on `issue-v1`
(plain HTTP/JSON, not gRPC, called directly): **prepare → sign the exact
returned bytes with the org's private key (ECDSA secp256k1) → submit.** The
signature is the only authorization. Never re-marshal the payload between
legs. The org's key comes from `GetOrganisation` at signing time, same as
credentials.

### 1. Create the org's XP token (§1.7 — once per org)

1. `POST /v1/xp-tokens:prepare` `{issuer, tokenName, tokenSymbol}` → `{payload}` (base64)
   - `issuer` = the org's `hedera_account_address` (`0.0.<n>`)
   - `tokenName` / `tokenSymbol` are the org's choice (e.g. "Fenwick Systems XP" / "FSXP"); non-empty, server-validated
2. Sign, then `POST /v1/xp-tokens:submit` `{payload, signature}` → `{tokenId}`

**Keep `tokenId`.** There is no backend lookup for it (deliberately deferred).
Custody: persist client-side (localStorage keyed by org name) and always show
it in the UI so it is recoverable by hand. Fallback if lost: the token is
on-chain as the token whose **memo** is `xp:<issuer account>` — findable via
HashScan or by walking the mirror node's tokens for the platform treasury.
Don't build that walk unless loss actually happens in practice.

**Create is once per org.** The backend does not enforce this (stateless) — a
second create mints a second, equally valid token and orphans the first. The
console must gate the button: if a tokenId is already stored for the org,
show the token, not the create form.

### 2. Issue XP (§1.8)

1. `POST /v1/xp:prepare` `{issuer, tokenId, recipient, amount}` → `{payload}`
   - `recipient` = the candidate's `hedera_account_address`
   - `amount` = positive integer (the token has zero decimals)
2. Sign, then `POST /v1/xp:submit` `{payload, signature}` → `{tokenId, recipient, amount}`

Errors to surface distinctly:
- **401** — signature didn't verify against the issuer's account key (wrong
  key, or payload bytes were altered between legs).
- **403** — the token doesn't belong to this issuer (`tokenId` names another
  org's token, or a stale/wrong id). Message the stored-tokenId mismatch, not
  a generic failure.

## Display

- XP lands **soulbound** (recipient's relationship is frozen after delivery).
- Balances are read from the mirror node (`MirrorService.ListTokenHoldings`,
  already wired for the Profile app's wallet screen). Mirror lag applies
  (impl spec §6.4): after issuing, poll with a bounded ceiling (90–120s) and
  show a pending state — never an empty state, never a fake success.
- The Profile app's XP Tokens empty state (`wallet-assets-brief.md`) becomes
  live with no extra work once orgs start issuing — holdings were always
  mirror-derived.

## Out of scope

- Reward tokens — no backend surface.
- Any aggregation of XP across issuers — per-issuer tokens by design; render
  per-token balances as the mirror returns them.
