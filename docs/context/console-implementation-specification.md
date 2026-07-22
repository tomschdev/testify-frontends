# Project Attestant — Console Implementation Specification (v1)

## 1. Scope

Three sites, each a thin client over backend RPC services:

| Site | Audience | Primary job |
|---|---|---|
| **Profile app** | Candidates | View credentials, sign what needs signing, browse positions |
| **Issuer console** | Organisations | Create org, mint XP tokens, issue XP credentials, issue reputation credentials |
| **Positions console** | Organisations | Create positions as chained credential filters |

None of the three own any domain logic. No credential state, org state, or filter-evaluation logic lives in a site — every fact displayed is fetched from a backend RPC, and every write is a pass-through call to one. A site's only jobs are: render, collect input, redirect to auth, call RPCs, display the response.

This spec fixes the **build order** and the **integration seams**. RPC payload shapes are placeholders (§7) until the backend spec lands; nothing here should need restructuring when they do — only filling in.

---

## 2. Architecture decisions made now

**2.1 Repo/deploy shape.** One git repo, three app directories (`apps/profile`, `apps/issuer`, `apps/positions`), three separate Vercel Projects — each with its **Root Directory** pointed at its own app folder. This gives three independently deployable sites with three separate domains (what's needed) while sharing one `packages/` for code that must be byte-identical across sites (§6). If a monorepo turns out to be friction, splitting into three repos later is a smaller job than merging three repos would be now — so start shared.

**2.2 SSO across independently deployed sites.** The three sites do **not** share a session directly — they can't, they're different origins. Each site runs its own redirect to the auth host and its own callback. "Single sign-on" is delivered by the **identity provider's own session**: if the user already has an active session at the auth host, a redirect from any site's `/authorize` resolves silently and bounces straight back with a fresh code — no login screen shown twice. This is standard OIDC-style SSO and needs no custom work beyond each site correctly performing its own redirect/callback.

**2.3 Organisation continuity.** The requirement that "your organisation is visible in both the issuer console and positions console" is **not** a frontend state-sharing problem. Organisation is a backend entity keyed to the authenticated user. Both sites independently authenticate the user and independently call the same `GET current organisation` RPC. They arrive at the same answer because they're asking the same backend the same question — nothing is passed between the sites. Don't build a cross-site sync mechanism; it isn't needed.

**2.4 Session storage.** Each site sets its own `httpOnly`, `SameSite=Lax` cookie on its own domain, holding the access token (and refresh token if the auth host issues one). No token in `localStorage`, no token in the URL past the initial callback.

**2.5 RPC calls are proxied, not direct-from-browser.** Each site's own Next.js route handlers (`/api/...`) call the backend RPC hosts server-side, attaching the token from the session cookie. The browser never holds the token and never calls the RPC hosts directly. This sidesteps CORS entirely and keeps tokens off the client. Revisit only if the backend spec mandates browser-direct calls for a specific reason.

**2.6 Config.** Per Vercel Project environment variables:

```
AUTH_HOST=https://users-v1-75542456563.europe-west1.run.app
AUTH_TOKEN_URL=            # pending — blocks Phase 3
AUTH_CLIENT_ID=            # pending, if applicable
API_HOST=                  # pending — blocks Phase 2
```

Same variable names across all three Vercel Projects; values may differ (e.g. if RPC hosts turn out to be per-domain rather than unified — see §7).

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

- `API_HOST` supplied → wire read-only calls through the site's own `/api` route handlers
- All RPC calls go through one typed client module per site (`lib/api.ts`) — no component constructs a fetch call directly
- Where a real read is inherently user-scoped (see §5 — issuer/positions org lookups), use a fixed test identity supplied by the backend team rather than inventing one; mark it clearly as temporary
- No mock or fixture data ships past this phase — if the real RPC isn't ready for a given read, the screen shows an honest empty/error state, not fabricated data

**Exit criterion:** real backend data (not mock) renders on the deployed site for at least the site's primary read.

### Phase 3 — Auth redirect

Lock the app behind real identity once the read path is already proven to work.

- Redirect to `AUTH_HOST/authorize?redirect_uri=<site>/auth/callback` on protected routes
- Callback handler exchanges the code via `AUTH_TOKEN_URL` (endpoint contract pending, §7) and sets the session cookie
- RPC calls from Phase 2 now carry the real token instead of the fixed test identity
- Sign-out clears the cookie

**Exit criterion:** an unauthenticated visit redirects to the auth host; after signing in, the user lands back on the site seeing their own data, not the Phase 2 test identity's.

---

## 4. Per-site sequencing notes

### 4.1 Profile app
- Phase 2 candidates: credentials list, positions browse. Positions browse is plausibly a **public** read (candidates browse before signing in) — flag to product/backend to confirm before Phase 3 gates it.
- Phase 3: credentials list must be gated (it's the user's own data); confirm whether positions browse stays public post-auth or not.

### 4.2 Issuer console
- Every meaningful read here is org-scoped (organisations, XP tokens, issued credentials), so a "real" Phase 2 is limited without at least a stand-in identity — use the fixed test identity per §3 to demo the read path, then swap to the real token in Phase 3.
- Org creation is a write and should stay disabled/hidden until Phase 3, since a write with a fake identity would pollute backend state.

### 4.3 Positions console
- Same shape as 4.2: position list and creation are org-scoped writes/reads. Demo the list view in Phase 2 with the fixed test identity; gate creation until Phase 3.

---

## 5. Shared package (`packages/`)

Code that must produce identical output on more than one site belongs here, not duplicated per app:

- **Design tokens & UI primitives** — so all three sites are visibly one product
- **Filter predicate model + natural-language renderer** — the positions console *writes* filters, the profile app *reads and renders* them; they must be the same code, not two implementations that can drift
- **RPC client base** — fetch wrapper, error handling, token-header injection, shared between each site's `/api` route handlers

---

## 6. Open items pending backend spec

These block the phase noted and should be the first things filled in when the backend spec is enriched into this document:

| Item | Blocks | Status |
|---|---|---|
| Token exchange endpoint (`AUTH_TOKEN_URL`) + request/response shape | Phase 3 | Not yet provided |
| RPC host(s) — one unified `API_HOST` or per-domain hosts (credentials/tokens, positions, profile) | Phase 2 | Not yet provided |
| `GET current organisation for user` — response shape | Phase 2 (issuer/positions), §2.3 | Not yet provided |
| Whether positions browse is a public or authenticated read | Phase 3 gating (§4.1) | Not yet decided |
| Whether RPC hosts allow browser-direct calls (CORS) or require proxying (§2.5 assumes proxying) | Phase 2 | Assumption pending confirmation |
| Fixed test identity for Phase 2 org-scoped demos (§3, §4.2, §4.3) | Phase 2 | Needed from backend team |

---

## 7. Non-goals for this pass

- No validation or business logic duplicated client-side beyond basic form field checks
- No persistence beyond the session cookie — nothing else survives a page reload independent of the backend
- No mock data left in a production build past Phase 2
