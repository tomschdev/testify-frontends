# DISCLAIMER: IF A DETAIL IN THIS DOCUMENT IS CONTRADICTORY TO OTHER SOURCES, PREFER OTHER SOURCES.
# Prompt: port Testify's credential/job features onto this project

You're being given two codebases (two "sides" of an app — likely a
frontend and a backend, or two halves built separately). Your job is
**not** to build a new app from scratch. It's to graft a specific, working
feature set — inspired by a real, already-built reference project called
**Testify** — onto whatever you're handed, adapting to that codebase's
existing stack and conventions rather than replacing them.

Everything below is context from the Testify build so you don't need to
guess at intent or re-derive lessons that were already learned the hard
way. Read all of it before touching the two codebases.

---

## Part 1 — What Testify is and the problem it solves

Job markets are opaque: candidates can't prove unwitnessed learning,
employers re-verify what's already been verified elsewhere, and funders
can't confirm their training spending produced jobs. The evidence exists —
it's just institutional and illegible from outside (information asymmetry
/ labour-market signalling failure).

Testify's answer: treat a credential as a **shared, first-class object** —
property to the candidate, requirement-vocabulary for employers, and
outcome-proof for funders, all drawn from the same underlying record. Job
postings become credential predicates; qualification is a boolean computed
against a public key, not a résumé keyword match.

**The one invariant every asset enforces: access cannot be bought, and
what's bought confers no access.** Concretely: everything that measures
merit (XP, credentials, reputation) is soulbound and unpriced; everything
that moves value (reward tokens, impact certificates) is priced but
confers no access on its own. Ownership of a token never substitutes for
ownership of the underlying achievement.

### The five assets

| Asset | Type | Transferable? | Purpose |
|---|---|---|---|
| **XP Token** | Fungible, soulbound | No | Granular learning/activity progress |
| **Course/XP Credential** | NFT, soulbound | No | Proof of a completed course or qualification |
| **Reputation Credential** | NFT, soulbound | No | Verified endorsement from an employer, instructor, or peer |
| **Reward Token** | Fungible, reserve-backed | Yes (spendable only, confers no access) | Temporary financial support, redeemable at approved vendors |
| **Impact Certificate** | NFT, tradeable | Yes | Held by the funding/hiring organisation, not the candidate — proof that funded training led to employment |

Build the same invariant here, using real tokens on whatever chain the
target project already uses (or Hedera, if it's greenfield) — stay
blockchain-based, real tokens and real NFTs, not simulated balances in a
database column. This was a deliberate decision made mid-build: it would
have been faster to fake it, but faking the exact claim ("cryptographically
verifiable," "fully collateralised," "co-signed") in a demo someone will
actually click through is worse than not building it, so it was built for
real instead.



## Part 3 — What to build here

### Step 0 — before writing anything

Explore both provided codebases first. Understand their stack, whether a
user/account/organisation concept already exists, whether there's already
a database or auth system, and what (if anything) already resembles a
profile, wallet, job board, or credential. This document tells you *what*
to build; you decide *how* it maps onto what's already there.

### Feature 1 — Profile

One profile screen per account, three sections:

- **Wallet** — real balances: XP Token, Reward Token, with a redeem
  action that genuinely reduces the on-chain balance.
- **Credentials** — every soulbound/tradeable asset the account actually
  holds (Course Credentials, Reputation Credentials, and — for
  organisation accounts — Impact Certificates), each showing its full
  content and independently verifiable, not a cached/trusted claim.
- **Jobs** — see Feature 2.

### Feature 2 — Job board, collapsed to one filter

No multi-criteria filter UI (credential-type dropdown + XP-threshold input
+ issuer dropdown, each configured separately). Collapse it to **one
primary, always-on view: "Jobs I qualify for."** Qualification is computed
live, per posting, against the signed-in candidate's actual current
holdings — never a stored boolean. A posting's requirements are still
structured data underneath (e.g. `{type: "credential", value: "..."}` /
`{type: "xp", value: N}`), you're just not exposing that structure as a
manual filter form on the candidate side — the qualify/don't-qualify
judgment *is* the filter.

Organisations post jobs with those structured requirements; nothing else
needs to be candidate-configurable.

### Feature 3 — Apply, invite, and status on everything

New relative to Testify (which only ever showed a qualify/don't-qualify
badge — no actual application flow). Build both directions:

- **Apply** — a candidate can apply to any job they qualify for. This
  must be a real, published record, not a client-side toggle or a private
  database row only one side can see.
- **Invite** — an organisation can invite a specific candidate to apply,
  independent of the candidate applying first. This is the formalized
  version of what Testify's "outreach" record does, but here it needs an
  actual status the candidate can respond to, not just a visible log
  entry.
- **Status, consistently, on both** — every application and every
  invitation carries an explicit status both sides can see, that changes
  over time (e.g. `applied → under review → invited to interview →
  accepted / declined → hired`). Apply the same "real record + explicit
  status + both sides can see it" pattern anywhere a similar
  request/response interaction exists — e.g. a Reputation Credential
  request-then-grant flow, if you build endorsements as a request rather
  than always-immediate.

### Open design decision: what is "the organisation" here?

In Testify, **one account is simultaneously employer, credential issuer,
and funder** — it posts jobs, issues XP/credentials, and ends up holding
the Impact Certificate proving its money produced a hire. That's a
simplification made deliberately for a single-issuer demo, not a design
claim worth preserving if it doesn't fit.

Check what the target codebase already has before deciding:
- Already has a single "organisation"/"employer" account type → keep
  Testify's merged model, one account does all three roles.
- Already distinguishes employer vs. training provider vs. funder as
  separate account types → don't force a merge. Employers post jobs and
  receive applications; issuers mint XP/credentials; whichever entity
  actually paid for training is who the Impact Certificate should be
  minted to (`recipientId`, per Part 2's delivery mechanism) — reconcile
  to whichever entity is real in *this* codebase.
- No organisation concept at all yet → default to Testify's single
  merged-role account, simplest correct starting point.

State which one you chose and why, briefly, once decided — don't silently
pick one.

### What NOT to build (avoid scope creep)

- Full multi-issuer sovereignty (separate key custody per issuer) unless
  the target codebase already has multiple issuer/organisation accounts
  and clearly needs it.
- A generic reserve-pool FX/redemption contract — funding + capped
  minting is enough; real fiat rails are out of scope.
- Full non-custodial candidate identity (the candidate's *account* key
  itself living client-side) — much larger than this feature set needs.
  The "real co-signing" pattern in Part 2 is deliberately scoped to
  specific actions, not full account custody. (Testify itself still has
  this as an open gap — every write except the one co-signed action is
  signed by a single operator/platform key, with the acting account only
  recorded in the payload. That's fine to carry over as-is unless the
  target codebase already solves it.)

### Done means

- A candidate can see a live, real Wallet + Credentials + qualifying-Jobs
  profile.
- A candidate can apply to a job they qualify for, and an organisation can
  invite one directly — both produce a real, independently-checkable
  record with a status that updates and is visible to both sides.
- All five assets are real tokens/NFTs on-chain, not simulated database
  rows, and the soulbound-vs-tradeable distinction is enforced the same
  way Part 2 describes, including tested delivery to a genuinely
  fresh second account (not just self-minting).
- You've explicitly stated what "organisation" ended up meaning in this
  codebase and why.
