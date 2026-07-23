# Brief — Structured filter predicates (frontend side)

The backend decision of 2026-07-23 moves filter structure **into the proto**:
`positions.v1.Filter` gains a `PredicateType` enum selecting a per-type
predicate submessage, and `natural_language_criteria` demotes to a display
label rendered *from* the structure, never parsed. Plan of record:
`/Users/thomasscholtz/alis.build/interface/build/ti/docs/horizontals/filtering/briefs/2026-07-23_structured-filter-predicates.md`.

**This supersedes "The filter model — read before building anything" in
`positions-console-brief.md`.** The string round-trip (canonical renderer +
parser, opaque strings, tri-state evaluation) is retired as the authoring and
evaluation model. Grammar v1 survives backend-side only, as a one-time
migration of already-stored strings.

## The new model

Two predicate types, mirroring the proto exactly:

| `predicate_type` | Submessage | Fields | Evaluated against |
|---|---|---|---|
| `CREDENTIAL_COUNT` | `credential_count` | credential type (XP \| Reputation), issuer, min count | credential HCS topic |
| `XP_BALANCE` | `xp_balance` | issuer, min amount | per-issuer XP token balance (`ListTokenHoldings`) |

Semantics that carry over unchanged:

- **AND-only.** `Requirements` has no OR grouping; build no OR UI.
- **No filter ids.** Filters are unique by content; any add/remove/edit/toggle
  sends the full `Requirements` list via `UpdatePosition`.
- **`active` toggling** flips the bool, predicate untouched.

New rules:

- **Issuer fields carry a Hedera account id** (`0.0.123`) — the canonical
  on-chain identity. The console resolves organisation → account id at
  authoring time (`Organisation.hedera_account_address`); no more injectable
  `IssuerMatcher`, no org-resource-name or public-key issuer forms.
- **The label is derived state.** Render it from the predicate on every write;
  never accept or parse free text. Keep grammar v1's canonical phrasing for
  the credential-count forms (`Holds an XP Credential issued by …` /
  `Holds at least {n} … Credentials issued by …`) so migrated filters read
  unchanged; XP balance renders as `Has at least {n} XP from {issuer}`.
- **Legacy filters** (`PREDICATE_TYPE_UNSPECIFIED`, stored before migration)
  display their label as read-only raw text, cannot be edited structurally,
  and should surface a "legacy — not enforceable" hint: the backend fails
  `SearchProfiles` loudly (`FAILED_PRECONDITION`) if one is active.

## Work items

### 1. `packages/filter-spec` — model rework

- `model.ts`: `FilterSpec` becomes a discriminated union on predicate type —
  `{ kind: "credentialCount", credentialType, issuer, minCount }` |
  `{ kind: "xpBalance", issuer, minAmount }`. Conversion helpers to/from the
  proto `Filter` shape (enum + submessage) live here so both apps share one
  mapping.
- `canonical.ts`: renderer stays (extended with the XP-balance phrasing);
  **parser is deleted from the public surface** — nothing in the apps may
  parse a label.
- `evaluate.ts`: switch on `kind`. Credential-count keeps the existing
  count-over-credentials logic with plain issuer equality (account ids both
  sides). XP-balance takes the subject's token holdings plus an
  issuer → XP-token-id resolution and compares the balance. The
  `satisfied: boolean | null` tri-state narrows: `null` remains only for
  legacy `UNSPECIFIED` filters.

### 2. `apps/positions` — filter builder authors structure

`FilterBuilder.tsx`: a predicate-type selector with one form per type —
credential count (type, issuer, min count) and XP balance (issuer,
min amount). Issuer input is an org picker resolving to the account id, with
a raw account-id fallback. Thresholds are integers >= 1 (the backend rejects
less). The rendered label previews live as the form changes. Update/toggle
flows (`PositionCard.tsx`) are unchanged beyond the new types.

### 3. `apps/profile` — evaluation and explanation

`JobsPanel.tsx` match explanation evaluates per-predicate with the reworked
`evaluate.ts`: credential-count from the already-fetched credentials,
XP-balance from the wallet's token holdings. Per-filter explanation lines
render from the structure ("You hold 2 of 3 required…", "Your XP balance
from X is 4200 of 5000 required").

### 4. Remove the standard-predicate caveat

The "evaluated against the standard XP + Reputation predicate" note
(positions-console-brief.md item 4) comes out once the backend evaluator
ships — eligible-profiles and qualify-badge answers then reflect authored
filters exactly.

## Not in scope

- OR grouping, filter ids — proto has neither.
- Migration of stored strings — backend-owned (item 3 of the backend brief).
- Reward/endorsement predicate types — add a predicate type when the backend
  defines one.

## Sequencing

Blocked on the backend define pass publishing the new proto types (bump the
`internal.ti.alis.build-protobuf` vendor package). Then items 1–3 can proceed
against the types immediately — evaluation semantics need no backend — and
item 4 waits for the backend evaluator to deploy.
