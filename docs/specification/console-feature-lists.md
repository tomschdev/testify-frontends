# Console Feature Lists — POC (48-Hour Build)

Grounded in the operational context doc: the core loop is **issue → post → discover → match**, working live, end to end. Feature lists below have been refined and corrected turn by turn since the first pass — where something here overrides an earlier simplification or an assumption in the operational-context doc, that's called out explicitly rather than silently changed.

---

## 1. Organization Console

Build in this order (matches doc §4, steps 1–5):

1. **Sign up** — Org User creates an account via the auth host. Already implemented; no change.
2. **Sign in** — Same auth host, returning session. Already implemented.
3. **Create organisation** — Form: org name. Calls the create-organisation RPC, which returns the org's public key/identity and sets the creating user's role to **owner**. This is the identity everything downstream signs as.
4. **Organisation state** — Show the organisations this user has access to, each with their role (owner/admin/member); show the create-organisation form when the list is empty. Already built for the single-org case — the underlying shape is a list, even though the POC demo only ever populates one.
5. **Issue XP Credential** — Form: recipient **public key**, course/credential title, grade (optional). Calls issue-XP-credential RPC, signed by the org key, self-contained payload.
6. **Issue Reputation Credential** — Form: recipient **public key**, endorsement message. Calls issue-reputation-credential RPC.
7. **(Optional, build last) Create XP Token** — Form: name + symbol *only*. No reward multiplier, no expiry — those belong to Reward Tokens, which are explicitly out of scope for this POC.
8. **(Optional, build last) Issue XP Token** — Form: recipient, amount. Calls mint/issue-XP RPC.
9. **Recently issued list** — Shows credentials issued by this org so far, for visual confirmation during the live demo. Already built, keep as is.

**Explicitly not in scope here:** reward token configuration, Impact Certificates, employment events, revocation, DAO governance, key registry management beyond "the org's key exists and is resolvable."

---

## 2. Job Console

**Filters are configurable for this console** — an earlier pass had simplified position requirements down to one fixed, non-editable predicate pair; that's superseded. Minimal feature set:

1. **Sign in and view accessible organisations** — Lists the organisations this user has access to, each with a role (**owner**, **admin**, or **member**), resolved via the shared "organisations for user" RPC (see §4). For the POC demo the org user will have exactly one, so this reduces to showing that one org — but built against the list-with-role shape, not a singular "current org" assumption.
2. **Create position** — title (+ location), posted under the selected organisation from step 1. Includes at least one requirement filter, filled in at creation time.
3. **Update position** — edit title/location, and add, remove, or edit filters on an existing position.
4. **List positions for this org** — already built, keep.
5. **Open a position → view eligible profiles** — new. Given a position's *active* filters, list the profiles that satisfy them. This is the org-side mirror of the Profile Console's qualify check (§3.8): same underlying evaluation, opposite direction — org asks "who qualifies," candidate asks "do I qualify." Needs a backend capability to enumerate/query profiles against a filter, not just evaluate one known profile at a time — this is a new dependency, flagged in §4.
   - Each eligible profile listed shows an **"Invite for interview"** button. No functionality behind it for this POC — it renders, it's clickable, it does nothing. Don't wire it to a real invite/notification flow; that's out of scope here.
6. **Activate / deactivate filters** — each filter on a position toggles on or off independently of its configuration. Only active filters count toward eligibility in step 5 and toward the Profile Console's qualify check (§3.8).
7. **Fill in filters** — configure each filter's parameters (issuer, credential type, threshold where applicable). This is the general filter-builder UI from the original build — restoring it here, not building it new. The underlying `FilterNode` model and renderer already support this; the earlier "fixed pair, no builder" version was the simplification, not the other way around.

**Open question:** does "fill in filters" mean the full general model (XP thresholds, arbitrary credential titles, AND/OR grouping) as originally built, or a narrower set — e.g. presence checks only, but for any credential type/issuer rather than fixed to "this org's XP + Reputation credential"? Assuming the full general model until told otherwise, since that's what "fill in" and "activate/deactivate" as independent, per-filter operations implies.

**Explicitly not in scope, still:** free-text requirements, and any real invite/interview-scheduling flow behind the button above. A filter remains scoped to one issuer at a time, per the original model.

---

## 3. Profile Console

Three main menus, plus sign-in/sign-up. Build order: sign-in & sign-up → Credentials (already built) → Jobs → Wallet (Wallet is cosmetic and lowest priority — see below).

1. **Sign in and sign up** — Both are in scope. The operational-context doc's assumption that the Profile User's account is pre-provisioned and only needs sign-in doesn't hold — build the full auth entry point here, same as the Organization Console (§1.1–1.2).

**Wallet**

2. **Reward Token balances** — **Hardcoded for this POC.** No real backend integration, no redemption flow, no reserve pool — Reward Tokens remain out of scope as actual functionality (operational-context doc §6). This menu exists purely so the three-menu structure isn't missing a piece; the numbers shown are fixture data, not a real balance.

**Credentials**

3. **XP Credentials** — List of held XP Credentials, scoped to the authenticated identity. Already built.
4. **XP Tokens** — List/balance of held XP Tokens. Depends on the optional Organization Console step (§1.7–1.8) actually having issued some — show an empty state if that step got cut for time.
5. **Reputation Credentials** — Already built.

**Jobs**

6. **Job feed** — List of posted positions. Already built — this is the discovery step (doc §4.7). **All jobs are public** — no auth gate on browsing. (This resolves the open question flagged in the implementation spec about whether positions browse needs to sit behind auth: it doesn't.)
7. **"Jobs I qualify for" filter** — Toggles the feed to only positions where the qualify check (below) returns true.
8. **Qualification check** — For each position: evaluate the position's active filters (§2.7) against this profile's held credentials. Boolean result, shown clearly (qualify / don't qualify) — this is what step 7 filters on.
9. **(Nice to have) Match explanation** — Name which specific filters were satisfied, e.g. "Qualified via: XP Credential 'Data Science Bootcamp' and a Reputation Credential, both from UZH DDIB." Non-blocking — cut first if time is short.
10. **Apply button** — Each position in the feed shows an **Apply** button. Assuming this is a dummy button with no functionality, symmetric to "Invite for interview" on the Job Console (§2.5) — nothing in scope so far describes an application-submission flow or backend endpoint for it. Flag if that assumption's wrong.

**Explicitly not in scope here:** wallet *association* flow (the HTS token-account association step from Q1 in open-questions.md — distinct from the Wallet *menu* above), real reward-token redemption or backend wiring, selective disclosure controls.

---

## 4. Cross-cutting notes

- **Where matching happens.** The check in §3.8 (does this one profile qualify) is simple enough to do client-side against already-fetched data. §2.5 (which profiles qualify, across all profiles) is a different shape — it needs either a backend RPC that takes a filter and returns matching profiles, or a full profile listing the client can filter against. Given privacy is explicitly out of scope for this POC (full disclosure to the querying party is accepted, per the operational-context doc §6), a full listing is workable, but a dedicated matching RPC is the better long-term shape and should be requested from backend rather than assumed.
- **Shared dependency.** Both the Organization Console and Job Console depend on the same "organisations for user" RPC — returning a list of `{organisation, role}` pairs, not a single org — flagged as an open item in the implementation spec. This is the one thing both consoles' core loops are still waiting on.
- **Open question: does role gate anything in this build?** Owner/admin/member is confirmed as the access model, but nothing so far says whether a member (vs. owner/admin) is allowed to issue credentials or create positions in this POC, or whether role is purely informational for now. Worth a quick answer — it's a one-line permission check either way, but it changes what "signed in" is allowed to do on both consoles.
- **Recipient identification: resolved.** Org User identifies the Profile User recipient by **public key** for this POC — a raw pubkey field on the issuance forms (steps 1.5 and 1.6). Email-to-public-key lookup is a deliberate later addition, not part of this build: it implies a directory/resolution service that doesn't exist yet and isn't needed while accounts are pre-provisioned and known ahead of time.
- **Build order across all three consoles**, mirroring doc §4 with the sign-up correction above: org sign-up/in and profile sign-up/in → org creation → issue XP credential → issue reputation credential → (optional) XP token → post position with filters → profile discovery → qualify check. The Organization Console's optional XP Token step and the Profile Console's Wallet menu (hardcoded reward tokens, purely cosmetic) are the two things to cut first if time runs short — neither blocks the core issue → post → discover → match loop.
