# Project Attestant — POC Operational Context (48-Hour Build)

**Status: single source of truth for implementation.** If a task isn't in the flow below, it's out of scope. Don't build toward Reward Tokens, Impact Certificates, redemption, DAO governance, reserve pools, privacy/selective disclosure, or revocation for this POC — those are V1/V2 concerns per the requirements spec and open questions doc, not this demo.

---

## 1. Goal

Demonstrate the full loop — **issue → post → discover → match** — end to end, live, in one sitting. Everything else is noise until this works.

---

## 2. Actors & Preconditions

| Actor | State at start |
|---|---|
| **Profile User** | **Already exists.** Has an account/keypair before the demo starts. Not a signup step in the demo script. |
| **Org User** | Does not yet exist. Signs up during the demo. |

Do not build onboarding flows for the Profile User. Assume that account is provisioned ahead of time (seed data / pre-created account is fine).

---

## 3. Surfaces

Three consoles, per existing terminology:

1. **Organization Console** — org signup, org creation, credential issuance, (optional) XP token creation/issuance.
2. **Job Console** — org user authenticates *as the organization* and posts a position with credential requirements. (May be a tab inside the Org Console rather than a fully separate app — implementation's choice, but functionally distinct from Profile Console.)
3. **Profile Console** — where the Profile User views their held credentials, sees job postings, and sees whether they qualify.

---

## 4. Step-by-Step Flow (build in this order)

1. **Org signup.** Org User signs up on the Organization Console.
2. **Org creation.** Org User creates an Organisation. This produces the org's public key / identity, per which the org will sign everything downstream.
3. **Issue XP Credential.** Org User, acting as the org, issues an XP Credential to the (pre-existing) Profile User. Signed with the org's key. Self-contained payload (no external references) per the credential design.
4. **Issue Reputation Credential.** Org User issues a Reputation Credential to the same Profile User. Same signing pattern.
5. **(Optional) XP Token.** Org User creates an XP Token and issues an amount of it to the Profile User. Build this last — it's explicitly optional and can be cut if time runs short.
6. **Post a position.** Org User goes to the Job Console (signed in as the organization) and creates a position. The requirement filter for this position is exactly: *holds an XP Credential issued by this org* AND *holds a Reputation Credential issued by this org*. No thresholds, no multi-org logic, no free-text requirements — just presence of those two specific credential types from that specific issuer.
7. **Discovery.** Profile User opens the Profile Console, sees the posted position in a job feed/list.
8. **Match.** Profile Console evaluates the Profile User's held credentials against the position's requirement predicate and shows a clear qualify/don't-qualify result (boolean). Profile User should see *that* they match and *why* (i.e., which credentials satisfied the requirement) — but this explanation is a nice-to-have, not blocking.

---

## 5. What "match" means for this POC

A job posting is a predicate over credentials, not prose:

```
requires:
  - credentialType: XPCredential, issuer: <org public key>
  - credentialType: ReputationCredential, issuer: <org public key>
```

Matching = check the Profile User's credential set for entries satisfying both lines. Return true/false. No XP thresholds, no cross-issuer aggregation, no scoring — that's Q9/Q12 territory and explicitly deferred.

---

## 6. Explicit non-goals for this build

Do **not** spend POC time on any of the following, even if they're tempting to bolt on:

- Reward Tokens, redemption, vendor/QR flow, fiat settlement
- Impact Certificates, employment events, funder flows
- Reserve pools, FX/denomination handling
- DAO governance, voting
- Key registry infrastructure beyond "the org's public key is resolvable by the app"
- Selective disclosure / privacy / ZK — full disclosure to the querying party is fine for the POC
- Revocation / wipe flows
- Profile User onboarding (self-serve wallet, association flow, etc.) — assume pre-provisioned

---

## 7. Grounding in existing design docs

Use these as implementation vocabulary, not as scope expansion:

- **Credentials** — signed, self-contained payloads bound to a holder (per `requirements-specification.md` §3.2, §5.5). SDK shape to follow: `createXPCredential(fields)`, `createReputationCredential(fields)`, `submit(signedBytes)`.
- **XP Token (optional step)** — per-issuer HTS fungible token, soulbound via freeze-after-mint. SDK shape: `createXPToken(config)`, `mintXP(tokenId, recipient, amount)`.
- **Organisation / Profile** — both are just public keys with different roles (`Terminnology`, `requirements-specification.md` §2). No separate account "types" needed at the data layer.
- **Job Posting** — requirement predicates, not free text (`Analogy`: KYCC/KYJR framing).

Reference: [Hedera docs](https://docs.hedera.com/) for HCS (credential publishing) and HTS (token minting) mechanics as needed.

---

## 8. One open call for the team

The transcript describing this flow was ambiguous on whether the **Job Console** is a fully separate application or a mode/tab within the Organization Console. Functionally it doesn't matter for the demo — pick whichever is faster to build — but the Org User must be clearly acting *as the organization* (i.e., authenticated with the org's identity) when posting a position, not as an anonymous or profile identity.
