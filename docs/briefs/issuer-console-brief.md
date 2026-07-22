# Brief — Issuer Console (`apps/issuer`)

This is the **Organization Console** of `docs/specification/console-feature-lists.md` §1.
Audience: organisations. Job: create an organisation, then issue XP and Reputation
Credentials as that organisation.

Read first: `docs/specification/console-feature-lists.md` §1 and §4,
`docs/context/console-implementation-specification.md` §2, §4.2, §6.
Backend source of truth: `/Users/thomasscholtz/alis.build/interface/build/ti`
(protos: `/Users/thomasscholtz/alis.build/interface/define/interface/ti`).

## Current repo state (ground truth — overrides "already built" claims in the feature list)

| Feature-list item | Actual state in this repo |
|---|---|
| §1.1–1.2 Sign up / sign in | ✅ Built (`packages/auth`, `app/auth/*` routes) |
| §1.3 Create organisation | ✅ Built (`components/Organisations.tsx`) |
| §1.4 Organisation state (list + role) | ⚠️ List built; **role display missing** |
| §1.5 Issue XP Credential | ❌ Not built |
| §1.6 Issue Reputation Credential | ❌ Not built |
| §1.7–1.8 XP Token create/issue | ❌ Not built — **and has no backend surface, see Blockers** |
| §1.9 Recently issued list | ❌ Not built (feature list says "already built" — that refers to a prior codebase, not this repo) |

## Features to build, in order

### 1. Organisation state with role (§1.4)

`OrganisationsService.ListMyOrganisations` returns the orgs only — **no role field
exists on the response** (`organisation.proto:198-203`). Roles are IAM bindings on
each Organisation. To show owner/admin/member:

- Per listed org, call `OrganisationsService.GetIamPolicy(resource=organisations/*)`
  and find the signed-in user's binding.
- If the call is denied for plain members, degrade gracefully: show the org
  without a role chip rather than erroring the whole list.

The empty state already shows the create form — keep that. The list-with-role
shape (not a singular "current org") is required; the demo just happens to have one.

Note the open question in feature-list §4: nothing yet says role *gates* anything.
Do not build permission gating; render the role informationally until answered.

### 2. Issue XP Credential (§1.5) and Issue Reputation Credential (§1.6)

The one flow that is not a pass-through. Three legs (impl spec §6.2), all
server-side in a route handler (e.g. `app/api/issue/route.ts`) so the org key
never reaches the browser:

1. `POST {ISSUE_SERVICE}/v1/credentials:prepare`
   `{type, issuer, subject, subjectPublicKey, title}` → `{payload}` (base64).
   `type` is `xp_credential` or `reputation_credential`. `issue-v1` is **plain
   HTTP/JSON** — call it with `fetch` carrying the Google ID token; no gRPC
   client exists or is needed (the vendored bundle has none, by design).
2. Fetch the org's signing key at issuance time:
   `OrganisationsService.GetOrganisation` with `read_mask: private_key` (the
   persist-private-keys change has landed — `Organisation.private_key` is on the
   proto). Sign the **exact bytes** returned by prepare, ECDSA secp256k1.
   **Do not re-marshal the payload between prepare and submit** — the signature
   is the only authorization on submit; a byte-level difference fails silently
   as an auth rejection.
3. `POST /v1/credentials:submit` `{payload, signature}` →
   `{topicId, sequenceNumber, contentHash, tokenId, serial}`.

Form fields:
- **XP Credential**: recipient, title, grade (optional). The prepare schema has
  **no grade field** — fold grade into the title (e.g. `"Data Science Bootcamp — Distinction"`)
  and say so in a code comment; don't invent a payload field.
- **Reputation Credential**: recipient, endorsement message → the `title` field.
- **Recipient**: feature-list §4 fixes identification by **public key**. Prepare
  wants both `subject` (Hedera account id) and `subjectPublicKey`. Collect the
  account id (`0.0.x`) and resolve the key via `MirrorService.GetHederaAccount`,
  displaying the resolved key before submission — one input, both fields
  satisfied, and typos surface as NOT_FOUND before issuance instead of after.

### 3. Recently issued list (§1.9)

Build it (it does not exist here). Purpose: visual confirmation during the live
demo. There is **no issuer-scoped credential listing RPC** — `ListCredentials`
is holder-scoped. Two layers:

- Session-local list of this session's issuances, appended from the submit
  response (`topicId`, `sequenceNumber`, `tokenId`, `serial`).
- Per entry, poll `MirrorService.ListCredentials(recipient account)` until the
  credential appears, then flip the entry from **pending → confirmed**.
  Mirror-node lag is real (impl spec §6.4): poll with a bounded ceiling
  (90–120s), show a pending state — never an empty state, never a fake success.

## Blockers / flags

- **XP Token create + issue (§1.7–1.8): no backend surface exists.** `issue-v1`
  exposes exactly two routes (`credentials:prepare`, `credentials:submit` —
  verified in `issue/v1/main.go:99-100`), and no token RPC exists on any neuron.
  These were optional/cut-first anyway — **do not build**; request the endpoints
  from backend if they're wanted. The Profile app's XP Tokens screen shows an
  empty state accordingly.
- **Role display** depends on `GetIamPolicy` being permitted for the caller — verify
  against the deployed service before committing to the UI shape.

## Shared foundations (build once, consume in all three apps)

- Expand `packages/ui` beyond `SiteShell`/`tokens`: `Button`, `Input`, `Select`,
  `Card`, `Badge` (role chips, credential type, pending/confirmed), `SectionHeader`,
  `EmptyState`, `ErrorState` (incl. the session-invalid variant currently
  duplicated in `Organisations.tsx` and `PositionsConsole.tsx`), `Toggle`.
  All three consoles must be visibly one product (impl spec §5); inline style
  objects currently duplicated per app move into these primitives.
- A shared **pending/poll hook** (bounded polling with timeout ceiling) — needed
  here for issuance confirmation and in Profile/Positions after writes.
- Auth/proxy plumbing is already shared via `packages/auth`; keep the app's
  route files as thin re-exports.

## Conventions & verification

- TS strict, no `any`, explicit return types on exports, named exports except
  Next.js special files, Server Components by default with narrow `"use client"`.
- Two-token rule on every backend call (`authorization` = SA Google ID token,
  `x-alis-forwarded-authorization` = user JWT) — already handled by
  `packages/auth/grpcProxy`; the issue-v1 route handler must do the same.
- grpc-web always returns HTTP 200; real status is in trailers.
- Run `npx tsc --noEmit` in the app before committing. Reuse
  `packages/auth/scripts/verify-*.mjs` after env changes.

## Explicitly out of scope

Reward tokens, Impact Certificates, employment events, revocation, DAO
governance, key registry management, email→pubkey lookup (raw account/key input
only), and any permission gating by role until the §4 open question is answered.
