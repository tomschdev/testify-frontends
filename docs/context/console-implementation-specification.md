# Project Attestant — Console Implementation Specification (v1)

## 1. Scope

Three sites, each a thin client over backend RPC services:

| Site | Audience | Primary job |
|---|---|---|
| **Profile app** | Candidates | View credentials, sign what needs signing, browse positions |
| **Issuer console** | Organisations | Create org, mint XP tokens, issue XP credentials, issue reputation credentials |
| **Positions console** | Organisations | Create positions as chained credential filters |

None of the three own any domain logic. No credential state, org state, or filter-evaluation logic lives in a site — every fact displayed is fetched from a backend RPC, and every write is a pass-through call to one. A site's only jobs are: render, collect input, redirect to auth, call RPCs, display the response.

This spec fixes the **build order** and the **integration seams**. The backend is deployed and its surface is now known — §6 carries the concrete hosts, RPCs and auth contract rather than placeholders.

---

## 2. Architecture decisions made now

**2.1 Repo/deploy shape.** One git repo, three app directories (`apps/profile`, `apps/issuer`, `apps/positions`), three separate Vercel Projects — each with its **Root Directory** pointed at its own app folder. This gives three independently deployable sites with three separate domains (what's needed) while sharing one `packages/` for code that must be byte-identical across sites (§6). If a monorepo turns out to be friction, splitting into three repos later is a smaller job than merging three repos would be now — so start shared.

**2.2 SSO across independently deployed sites.** The three sites do **not** share a session directly — they can't, they're different origins. Each site runs its own redirect to the auth host and its own callback. "Single sign-on" is delivered by the **identity provider's own session**: if the user already has an active session at the auth host, a redirect from any site's `/authorize` resolves silently and bounces straight back with a fresh code — no login screen shown twice. This is standard OIDC-style SSO and needs no custom work beyond each site correctly performing its own redirect/callback.

**2.3 Organisation continuity.** The requirement that "your organisation is visible in both the issuer console and positions console" is **not** a frontend state-sharing problem. Organisation is a backend entity keyed to the authenticated user. Both sites independently authenticate the user and independently call the same `GET current organisation` RPC. They arrive at the same answer because they're asking the same backend the same question — nothing is passed between the sites. Don't build a cross-site sync mechanism; it isn't needed.

**2.4 Session storage.** Each site sets its own `httpOnly`, `SameSite=Lax` cookie on its own domain, holding the access token (and refresh token if the auth host issues one). No token in `localStorage`, no token in the URL past the initial callback.

**2.5 RPC calls are proxied, not direct-from-browser.** Each site's own Next.js route handlers (`/api/...`) call the backend RPC hosts server-side, attaching the token from the session cookie. The browser never holds the token and never calls the RPC hosts directly. This sidesteps CORS entirely and keeps tokens off the client. Revisit only if the backend spec mandates browser-direct calls for a specific reason.

**2.6 Config.** There is no single `API_HOST` — the backend is four neurons on four Cloud Run hosts. Per Vercel Project environment variables:

```
USERS_SERVICE=https://users-v1-75542456563.europe-west1.run.app
POSITIONS_SERVICE=https://positions-v1-75542456563.europe-west1.run.app
PROFILES_SERVICE=https://profiles-v1-75542456563.europe-west1.run.app
ISSUE_SERVICE=https://issue-v1-75542456563.europe-west1.run.app

AUTH_HOST=                 # defaults to USERS_SERVICE — it is the identity provider
AUTH_CLIENT_ID=            # OAuth app id, from GET <AUTH_HOST>/apps/new while signed in
AUTH_CLIENT_SECRET=        # issued with the client_id; /token rejects one without the other
GOOGLE_APPLICATION_CREDENTIALS_JSON=   # SA credential — see §2.7
```

Same variable names across all three Vercel Projects; values are identical per environment.

**2.7 Two credentials travel on every backend call.** The Cloud Run services admit only the deployment service account, *and* separately resolve the acting user. Both facts must be satisfied at once, so each call carries two tokens:

| Header | Carries | Purpose |
|---|---|---|
| `authorization` | Google ID token whose `email` claim is `alis-build@<ALIS_OS_PROJECT>.iam.gserviceaccount.com` | Gets past the service's Cloud Run interceptor |
| `x-alis-forwarded-authorization` | The signed-in user's JWT from the identity service | Resolves the acting identity for IAM (`AddIdentityPolicy`) |

Sending only the first authenticates the *service*, not the user — every org-scoped read then answers as the deployment SA and the console silently shows the wrong data. Both, always.

**2.8 The proxy is a grpc-web bridge, not a REST facade.** The backend services (users, positions, profiles) speak **native gRPC only**; the browser stubs speak grpc-web-text. Each site's route handler decodes the base64 frames, forwards them over HTTP/2, and re-appends the gRPC trailers as a grpc-web trailer frame. Unary framing is byte-identical across the two protocols, so the bridge is a transport concern, not a translation layer — no per-RPC handler code. `issue-v1` is the exception: it is **plain HTTP/JSON**, not gRPC, and is called directly (see §6.2).

---

## 3. Build order

The order is the same for all three sites and is deliberately **landing page → data → auth**, not auth-first. Each phase has a concrete exit criterion so it's obvious when to move to the next one, and Phases 1–2 can proceed on all three sites in parallel with backend auth work still landing.

### Phase 1 — Landing page & deploy pipeline

Prove the deploy mechanics before adding any integration risk.

- Scaffold Next.js (App Router) in the app's directory
- One static route, no data fetching, no auth — just the site's name and purpose
- Connect the Vercel Project (Root Directory set correctly), confirm a production deploy
- Confirm a PR gets a working preview deploy

**Exit criterion:** site is reachable at its Vercel URL and redeploys automatically on push.

### Phase 2 — RPC data connections

Prove the site can read from the backend before locking anything behind auth.

- Service hosts supplied (§2.6) → wire read-only calls through the site's own `/api` route handlers
- All RPC calls go through one typed client module per site (`lib/api.ts`) — no component constructs a fetch call directly
- Where a real read is inherently user-scoped (issuer/positions org lookups), calls carrying only the SA token answer as the deployment SA (§6.1) — usable to prove the read path, but mark clearly that it is not a user's view
- No mock or fixture data ships past this phase — if the real RPC isn't ready for a given read, the screen shows an honest empty/error state, not fabricated data

**Exit criterion:** real backend data (not mock) renders on the deployed site for at least the site's primary read.

### Phase 3 — Auth redirect

Lock the app behind real identity once the read path is already proven to work.

- Redirect to `AUTH_HOST/authorize?redirect_uri=<site>/auth/callback` on protected routes
- Callback handler exchanges the code via `<AUTH_HOST>/token` (§6.1) and sets the session cookie
- RPC calls from Phase 2 now forward the user's token as `x-alis-forwarded-authorization` alongside the SA token (§2.7), so reads answer as the user rather than the deployment SA
- Sign-out clears the cookie

**Exit criterion:** an unauthenticated visit redirects to the auth host; after signing in, the user lands back on the site seeing their own data, not the Phase 2 test identity's.

---

## 4. Per-site sequencing notes

### 4.1 Profile app
- Phase 2 candidates: credentials list (`ListCredentials`), positions browse (`ListPositions`).
- Positions browse **may render signed-out** if product wants it (§6.1) — the route handler carries the SA credential, so no session is required. Credentials list must be gated: it is the user's own data.
- Phase 3: match state (`SearchProfiles`) needs the signed-in user's Hedera address to locate their entry in the response, so the qualify/don't-qualify badge is a post-auth feature even if the feed itself is public.

### 4.2 Issuer console
- Every meaningful read here is org-scoped (`ListMyOrganisations`), so Phase 2 shows the deployment SA's organisations, not a user's — enough to prove the read path, misleading if left unlabelled.
- Org creation stays disabled until Phase 3: creating as the SA provisions a real Hedera account and pollutes backend state.
- Issuance (§6.2) is the one flow that is not a simple pass-through — three steps, with a local signing operation in the middle. Build it last within this console, after auth, since it needs the org's key.

### 4.3 Positions console
- Same shape as 4.2: position list and creation are org-scoped. Demo the list in Phase 2; gate creation until Phase 3.
- Position requirements are `Filter` entries carrying `natural_language_criteria` + `active`. For the POC the predicate is fixed — holds an XP Credential **and** a Reputation Credential from this organisation — and `MirrorService.SearchProfiles` enforces exactly that regardless of the filter text. Write the two filters for display/audit; do not build a filter-compilation UI expecting the backend to interpret arbitrary criteria.

---

## 5. Shared package (`packages/`)

Code that must produce identical output on more than one site belongs here, not duplicated per app:

- **Design tokens & UI primitives** — so all three sites are visibly one product
- **Filter predicate model + natural-language renderer** — the positions console *writes* filters, the profile app *reads and renders* them; they must be the same code, not two implementations that can drift
- **RPC client base** — the grpc-web bridge (§2.8), error handling, and the two-token header injection (§2.7), shared between each site's `/api` route handlers. All three sites talk to the same four hosts with the same auth contract; this is the single largest duplication risk in the repo.

---

## 6. Backend surface (resolved 2026-07-22)

The backend is deployed and the full **issue → post → discover → match** loop is proven end-to-end against it (see `docs/diagonals/position-eligibility` — the diagonal test is, in effect, a script of the RPC traffic these three consoles must produce). Every item this section previously listed as pending is answered below.

### 6.1 Formerly open items

| Item | Resolution |
|---|---|
| Token exchange endpoint | `<AUTH_HOST>/token`. users-v1 *is* the identity provider — `/authorize`, `/signup`, `/token` and its gRPC API share one origin. Register the app via `GET <AUTH_HOST>/apps/new` to obtain `AUTH_CLIENT_ID`/`SECRET`; the client-id-less fallback cannot carry `state`, so registration is the supported path. |
| RPC host(s) | Per-neuron, not unified — four hosts (§2.6). |
| `GET current organisation for user` | `OrganisationsService.ListMyOrganisations` — returns the organisations the calling user owns/administers/is a member of. This is the §2.3 mechanism: both org-facing consoles call it independently and arrive at the same answer. |
| Positions browse: public or authenticated? | **The site can serve it signed-out; the backend never sees an anonymous caller.** `roles/open` means *any authenticated user*, but the SA token that satisfies it is supplied by the route handler, not the visitor — and `ListPositions` is identity-independent (every position, every organisation), so answering as the deployment SA returns identical data. Verified against the deployed service with an SA token and no user JWT. To serve it publicly: don't gate the route, and let the handler omit `x-alis-forwarded-authorization` when there is no session. **Do not extend this to `SearchProfiles` or `ListCredentials`** — both are equally identity-independent, which is exactly why public exposure would leak (the former enumerates every profile's eligibility; the latter reads any account). And note an ungated route is an SA-backed open proxy: scope it to that one method and rate-limit it. |
| Browser-direct (CORS) or proxied? | **Proxied — mandatory**, not a preference. The services admit only the deployment SA (§2.7) and speak native gRPC (§2.8). A browser cannot call them. |
| Fixed test identity for Phase 2 | Not needed and not provided. With §2.7 in place, calls carrying only the SA token already succeed and answer *as the deployment SA* — that is the Phase 2 read path. Treat those results as the SA's view, not a user's, and do not write with it. |

### 6.2 RPC surface per console

All gRPC unless noted. Package `interface.ti.<neuron>.v1`.

**Profile app** (candidate)
- `MirrorService.ListCredentials(account_id)` → the user's held credentials with `type`, `issuer`, `title`, `issue_time`. This is the "my credentials" screen, and the "why did I match" explanation.
- `MirrorService.ListPositions()` → every position across all organisations — the job feed.
- `MirrorService.SearchProfiles(position)` → per-profile boolean eligibility for a position; find the signed-in user's entry to render qualify / don't-qualify.
- `MirrorService.GetHederaAccount` / `ListTokenHoldings` / `GetToken` → raw on-chain detail, if the profile shows it.

**Issuer console** (organisation)
- `OrganisationsService.CreateOrganisation` → provisions the org's Hedera account and returns its keys.
- `OrganisationsService.ListMyOrganisations` / `GetOrganisation`.
- Issuance is **`issue-v1`, plain HTTP/JSON, two legs** — not gRPC:
  1. `POST /v1/credentials:prepare` `{type, issuer, subject, subjectPublicKey, title}` → `{payload}` (base64). `type` is `xp_credential` or `reputation_credential`.
  2. Sign those **exact bytes** with the organisation's private key (ECDSA secp256k1).
  3. `POST /v1/credentials:submit` `{payload, signature}` → `{topicId, sequenceNumber, contentHash, tokenId, serial}`.
  The server verifies the signature against the issuer's mirror-resolved account key — **the signature is the only authorization on this call.** Do not re-marshal the payload between prepare and submit; sign the bytes as returned.

**Positions console** (organisation)
- `PositionsService.CreatePosition(parent=organisations/*)`, `GetPosition`, `UpdatePosition`, `RevokePosition`, `FulfillPosition`.
- `PositionsService.ListPositions(parent)` — parent-scoped. Use `parent=organisations/-` for the unscoped list, or `MirrorService.ListPositions` which wraps it.
- `PositionsService.SearchProfiles` is **not implemented** (returns `Unimplemented`) — the working matcher is `MirrorService.SearchProfiles` in profiles-v1. Call that one.

### 6.3 Signing key custody

Issuance requires the organisation's private key client-side (§6.2). Today that key is returned **once**, in the `CreateOrganisation` response, and never again — which would force the issuer console to capture and store it at org creation.

A pending brief (`docs/verticals/users/briefs/2026-07-22_persist-private-keys.md`) changes this for the POC: keys become persisted and readable on `User` and `Organisation`, so the console fetches the org's key at signing time via `GetOrganisation` and needs **no key-capture UX and no client-side key storage**. Build against that model. Until it lands, `CreateOrganisation`'s response is the only source of the key.

### 6.4 Propagation lag is real

Credentials land on Hedera, and the mirror node trails consensus by a few seconds. After issuing, `ListCredentials` and `SearchProfiles` will not reflect the new credential immediately. Any screen that reads straight after a write must poll with a bounded timeout (the backend tests use 90–120s ceilings) and show a pending state — not an empty state, and not a stale cached answer.

---

## 7. Non-goals for this pass

- No validation or business logic duplicated client-side beyond basic form field checks
- No persistence beyond the session cookie — nothing else survives a page reload independent of the backend
- No mock data left in a production build past Phase 2
