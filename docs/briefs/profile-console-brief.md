# Brief — Profile Console (`apps/profile`)

This is the **Profile Console** of `docs/specification/console-feature-lists.md` §3.
Audience: candidates. Job: view held credentials, browse positions, see
qualify / don't-qualify per position.

Read first: `docs/specification/console-feature-lists.md` §3 and §4,
`docs/context/console-implementation-specification.md` §2, §4.1, §6.
Backend source of truth: `/Users/thomasscholtz/alis.build/interface/build/ti`
(protos: `.../define/interface/ti/profiles/v1/mirror.proto`,
`.../users/v1/user.proto`).

## Current repo state (ground truth — overrides "already built" claims in the feature list)

| Feature-list item | Actual state in this repo |
|---|---|
| §3.1 Sign in / sign up | ✅ Built (`packages/auth`, `app/auth/*`) |
| §3.2 Wallet (hardcoded reward tokens) | ❌ Not built |
| §3.3 XP Credentials list | ❌ Not built (feature list says "already built" — that was a prior codebase; this app has only `MyUser.tsx`) |
| §3.4 XP Tokens | ❌ Not built — and will stay an **empty state**: no token issuance backend exists (see Issuer brief, Blockers) |
| §3.5 Reputation Credentials | ❌ Not built (same caveat as §3.3) |
| §3.6 Job feed | ❌ Not built |
| §3.7 "Jobs I qualify for" filter | ❌ Not built |
| §3.8 Qualification check | ❌ Not built |
| §3.9 Match explanation (nice-to-have) | ❌ Not built |
| §3.10 Apply button (dummy) | ❌ Not built |

Structure: three menus — **Credentials**, **Jobs**, **Wallet** — plus auth.
Build order: Credentials → Jobs → Wallet (Wallet is cosmetic, lowest priority,
first to cut).

## Prerequisite: the user's Hedera address

Everything user-scoped keys off `User.hedera_account_address`
(`user.proto:238`), returned by `UsersService.RetrieveMyUser` (already called in
`MyUser.tsx`). Fetch it once post-auth and thread it through; also needed to
locate the user's own row in `SearchProfiles` results.

Register `PROFILES_SERVICE` in this app's proxy `SERVICE_HOSTS` map —
`MirrorService` lives on profiles-v1 and the vendored bundle 1.0.14 ships
`mirror_grpc_web_pb`, so the client exists.

## Features to build, in order

### 1. Credentials menu (§3.3–3.5)

- `MirrorService.ListCredentials(account_id)` → credentials with `type`,
  `issuer`, `subject`, `title`, `issue_time`. Split into **XP Credentials**
  (`type === "xp_credential"`) and **Reputation Credentials**
  (`reputation_credential`) sections. Gated behind session — this is the
  user's own data; never serve it via the SA-only path (impl spec §6.1).
- **XP Tokens** (§3.4): `MirrorService.ListTokenHoldings(account_id)` +
  `GetToken` for name/symbol. Since no XP-token issuance backend exists, this
  renders an honest empty state ("No XP tokens held") — build the screen, not
  fixture data.
- Empty list ≠ error: the RPCs return empty lists for accounts holding
  nothing; render the empty state, reserve the error state for RPC failure.

### 2. Jobs menu (§3.6–3.10)

- **Job feed** (§3.6): `MirrorService.ListPositions()` — every position across
  all organisations. **Public, no auth gate** (feature-list §3.6 resolves this
  explicitly): the route handler carries the SA token and omits
  `x-alis-forwarded-authorization` when there is no session. Scope the
  ungated path to this one method — it is an SA-backed proxy; do not extend
  the pattern to `ListCredentials` or `SearchProfiles` (impl spec §6.1).
- **Qualification check** (§3.8), signed-in only: per position, call
  `MirrorService.SearchProfiles(position)` and find the signed-in user's entry
  by `hedera_account_address` → boolean `eligible`, rendered as a clear
  qualify / don't-qualify badge. This is the same evaluation the Positions
  Console shows from the org side — same backend answer, opposite direction.
  Batch sensibly: one `SearchProfiles` call per position in the feed; cache
  per position, don't refire on every render.
- **"Jobs I qualify for" filter** (§3.7): a toggle that filters the feed to
  positions whose check returned true. Computed live from §3.8 results, never
  a stored boolean. Signed-out, the toggle is disabled with a sign-in prompt.
- **Match explanation** (§3.9, nice-to-have, cut first): name the satisfying
  credentials, e.g. "Qualified via: XP Credential 'Data Science Bootcamp' and
  a Reputation Credential, both from <org>". Compute client-side by
  evaluating the position's active filters against the already-fetched
  `ListCredentials` data using the **shared FilterSpec parser/evaluator from
  `packages/`** (owned by the Positions brief — consume it, do not reimplement;
  filters that don't parse canonically are shown as raw text, unevaluated).
  Note the known gap: the backend boolean enforces the fixed XP+Reputation
  predicate regardless of filter config; if the client-side explanation and
  the backend boolean ever disagree, trust the boolean and say "evaluated
  against the standard predicate".
- **Apply button** (§3.10): renders on each position, clickable, does
  nothing — symmetric to the Positions Console's "Invite for interview".
  No application flow, no backend call. (The feature list flags this
  assumption; it stands unless the user says otherwise.)

### 3. Wallet menu (§3.2)

Hardcoded Reward Token balances — fixture data by explicit decision
(feature-list §3.2 overrides the impl spec's "no mock data" rule for this one
screen). Label it visibly as sample data in the UI so the demo can't be
mistaken for a real balance. No redemption, no backend calls. Build last.

### 4. Freshness after issuance

During the demo, credentials are issued live and the mirror node trails
consensus (impl spec §6.4). The Credentials screens need a manual refresh
affordance and, ideally, the shared bounded-poll hook so a just-issued
credential shows as arriving rather than absent.

## Shared foundations

Consume, don't duplicate: `packages/ui` primitives (Card, Badge for
credential type and qualify/don't-qualify, Toggle, EmptyState, ErrorState,
SectionHeader), the bounded-poll hook, and the FilterSpec
model/parser/evaluator (see Positions brief — single implementation across
writer and reader is a hard requirement, impl spec §5). The three-menu layout
itself (tab/menu navigation inside `SiteShell`) is a candidate for
`packages/ui` if either other console grows tabs.

## Conventions & verification

Identical to the other briefs: TS strict / no `any` / explicit return types /
named exports except Next.js special files / Server Components by default with
narrow `"use client"`; two-token proxy via `packages/auth`; grpc-web returns
HTTP 200 with the real status in trailers; `npx tsc --noEmit` before
committing; kill stale dev servers before browser verification.

Demo-path verification (the loop this console closes): issue a credential from
the Issuer Console → it appears under Credentials (within mirror lag) → the
position posted from the Positions Console appears in the feed → the qualify
badge flips to qualified once both credentials have landed.

## Explicitly out of scope

Wallet *association* flow (HTS token-account association), real reward-token
redemption or wiring, selective disclosure controls, any application-submission
flow behind the Apply button, and Profile-User onboarding beyond the standard
sign-up already built.
