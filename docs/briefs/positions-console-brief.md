# Brief — Positions Console (`apps/positions`)

This is the **Job Console** of `docs/specification/console-feature-lists.md` §2.
Audience: organisations. Job: post positions as credential filters, manage those
filters, and see which profiles qualify.

Read first: `docs/specification/console-feature-lists.md` §2 and §4,
`docs/context/console-implementation-specification.md` §2, §4.3, §6.
Backend source of truth: `/Users/thomasscholtz/alis.build/interface/build/ti`
(protos: `.../define/interface/ti/positions/v1/positions.proto`,
`.../profiles/v1/mirror.proto`).

**The feature list supersedes the implementation spec on filters.** Impl spec
§4.3 said "fixed predicate, no filter-authoring UI" — feature-list §2 explicitly
reverses that: filters are configurable, per-filter activate/deactivate is in
scope, and the general filter-builder returns. The current
`CreatePosition.tsx` implements the superseded fixed-pair version.

## Current repo state (ground truth)

| Feature-list item | Actual state in this repo |
|---|---|
| §2.1 Sign in + accessible orgs | ✅ Auth built; org list fetched in `PositionsConsole.tsx` — **role display missing** |
| §2.2 Create position | ⚠️ Built with hardcoded fixed two-filter predicate (`CreatePosition.tsx:26-44`) — needs the filter builder |
| §2.3 Update position | ❌ Not built |
| §2.4 List positions for org | ✅ Built (`PositionsList.tsx`), keep |
| §2.5 Eligible profiles + Invite button | ❌ Not built |
| §2.6 Activate/deactivate filters | ❌ Not built |
| §2.7 Filter builder | ❌ Not built (this is the restore of the general model) |

## The filter model — read before building anything

Backend `Filter` is two fields only (`positions.proto:113-123`):
`natural_language_criteria` (string, also the filter's content-addressed
identity — no id field) and `active` (bool). `Requirements.filters` are
AND-combined. There is nowhere to store structured parameters.

So the filter builder must round-trip structure through the string:

- Define a shared **`FilterSpec`** model in `packages/` (per impl spec §5 — the
  positions console *writes* filters, the profile app *reads and evaluates*
  them; must be one implementation): credential type (`xp_credential` /
  `reputation_credential`), issuer (org resource name or issuer key), and
  threshold where applicable.
- A canonical **renderer** `FilterSpec → string` and a **parser**
  `string → FilterSpec | null`. Canonical strings are editable/evaluable;
  anything unparseable renders as raw text and is treated as opaque.
- Filters are unique by content within a position — editing a filter means
  replacing one string with another in the `Requirements` list via
  `UpdatePosition`.

Feature-list §2's open question (full general model vs. presence-only) is
assumed **full general model** until told otherwise — but keep AND-only
combination: `Requirements` has no OR grouping, so don't build OR UI the
backend can't represent.

## Features to build, in order

### 1. Accessible organisations with role (§2.1)

Same gap and same solution as the Issuer brief §1: `ListMyOrganisations`
carries no role; resolve via `OrganisationsService.GetIamPolicy` per org,
degrade to no-chip when denied. Build the org list + role chip as a shared
component in `packages/ui` — both consoles render exactly this.

### 2. Create position with configurable filters (§2.2)

Rework `CreatePosition.tsx`:
- Fields: title, location, posting org (selected from step 1), and **at least
  one filter** authored in the builder at creation time.
- **`Position` has no location field** (`positions.proto:52-83`: name, title,
  description, times, state, requirements). Put location in `description`
  with a clear label, note it in a comment, and flag a `location` field as a
  backend request. Do not invent a field.
- Replace `pocRequirementCriteria` with the shared FilterSpec renderer.

### 3. Update position (§2.3) + activate/deactivate (§2.6)

- `PositionsService.UpdatePosition` with `update_mask` (`title`, `description`,
  `requirements`). Send the full `Requirements` list on any filter change
  (add/remove/edit/toggle) — filters have no ids, the list is the unit of update.
- Toggling `active` is independent of the filter's configuration: flip the bool,
  keep the string.
- Terminal positions (REVOKED, FULFILLED) reject updates — disable editing in
  the UI for non-OPEN states rather than surfacing the backend error.
- Use `etag` for optimistic concurrency where the RPC accepts it.

### 4. Eligible profiles view (§2.5)

Open a position → list profiles satisfying its active filters.

- **Call `MirrorService.SearchProfiles(position)`** (profiles-v1).
  `PositionsService.SearchProfiles` returns `Unimplemented` — do not call it
  (impl spec §6.2). Register `PROFILES_SERVICE` in this app's proxy
  `SERVICE_HOSTS` map; it currently only carries users + positions.
- Response is `{user, hedera_account_address, eligible}` per profile; show the
  eligible ones, each with an **"Invite for interview" button that renders, is
  clickable, and does nothing** — no wiring, per feature-list §2.5.
- **Known semantic gap, surface it honestly:** the deployed matcher enforces
  the fixed predicate — XP Credential AND Reputation Credential from the
  position's org — *regardless of the configured filter text or active flags*
  (impl spec §4.3, mirror.proto:40-44). Configurable filters will render,
  persist, and toggle, but do not change this backend answer until a
  filter-compiling matcher lands (the `positions.proto` `SearchProfiles`
  comment describes that future). Per feature-list §4, a dedicated matching
  RPC should be **requested from backend, not assumed**. Until then, add a
  small caveat note in the UI near the results ("evaluated against the
  standard XP + Reputation predicate") rather than pretending arbitrary
  filters are enforced.

### 5. Polling after writes

Position create/update publishes to HCS; `PositionsList` already shows
`hcs_record`. After any write, refetch; where a downstream read trails (mirror
lag, impl spec §6.4), use the shared bounded-poll hook with a pending state.

## Shared foundations

Same as the Issuer brief: `packages/ui` primitives (Button, Input, Select,
Card, Badge, Toggle, EmptyState, ErrorState, SectionHeader), the org-list-with-
role component, the bounded-poll hook — plus, owned by *this* brief because
this console is the writer: the **FilterSpec model + renderer + parser +
evaluator** package. The Profile app consumes the evaluator for its match
explanation; do not let two implementations exist.

## Conventions & verification

Identical to the Issuer brief: TS strict / no `any` / explicit return types /
named exports / narrow `"use client"`; two-token proxy already in
`packages/auth`; grpc-web returns HTTP 200 with status in trailers;
`npx tsc --noEmit` before committing; kill stale dev servers before verifying.

## Explicitly out of scope

Free-text requirements; a real invite/interview flow; multi-issuer filters
(a filter stays scoped to one issuer); OR-grouping in the builder;
Revoke/Fulfill UI (RPCs exist but the feature list doesn't ask — skip unless
trivially cheap); role-based permission gating pending the §4 open question.
