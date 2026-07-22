# THIS IS A LEGACY SYSTEM - OUR STACK HAS CHANGED SINCE THIS.
# THIS IS JUST FOR HISTORICAL CONTEXT PURPOSE 
# DISCLAIMER: IF A DETAIL IN THIS DOCUMENT IS CONTRADICTORY TO OTHER SOURCES, PREFER OTHER SOURCES.


# Testify — technical reference

A complete technical inventory of what's in this codebase: stack, files, API
surface, data model, and the Hedera-specific mechanisms it relies on. For
the narrative "how to run it / what's real vs. mock" writeup, see
[`README.md`](./README.md).

## Stack & architecture

- **Runtime**: Node.js, no framework — plain `http` module with a small
  custom router (regex path matching, method dispatch) in `server.js`.
- **Blockchain**: Hedera testnet via `@hiero-ledger/sdk` (writes) + the
  public mirror node REST API
  (`https://testnet.mirrornode.hedera.com/api/v1`, reads).
- **Storage**: none. No database anywhere. State lives entirely on Hedera
  (HTS token balances/NFTs, HCS topic messages) and is read fresh from the
  mirror node on every request.
- **Frontend**: single static `ui.html` — vanilla JS, no build step, no
  framework. Served by `server.js`.
- **Auth**: none in the traditional sense — a Hedera account ID is the
  identity. One exception: a browser-generated ECDSA P-256 keypair (Web
  Crypto, private key in `localStorage`) used for one specific signature
  (employment-event confirmation).
- **Env config**: `.env` (parent dir) — `HEDERA_ACCOUNT_ID`,
  `HEDERA_PRIVATE_KEY`, `TOPIC_ID`, `CREDENTIAL_TOKEN_ID`, `XP_TOKEN_ID`,
  `REWARD_TOKEN_ID`, `CANDIDATE_ACCOUNT_ID`.

## File inventory

**Server + routing**
- `server.js` — HTTP server, static file serving, ~30 route definitions,
  error handling (`HttpError` class, try/catch → JSON).

**Shared infra**
- `hedera-client.js` — `getClient()`, builds the Operator `Client` from env.
- `hcs-registry.js` — `publishRecord(client, topicId, type, data)`,
  `queryRecords(topicId, type, filterFn)`.
- `mirror.js` — `mirrorGet(path)`, fetch wrapper over the mirror node REST
  API.

**Domain modules**
- `signup.js` — `createAccount()`.
- `profile.js` — `buildProfile(accountId)`.
- `verify-credential.js` — `verifyCredential(tokenId, serial)`,
  `getCredentialsFor(accountId, tokenId)`.
- `issue-credential.js` — `issueCredential(client, {topicId,
  credentialTokenId, issuerId, subjectId, recipientId, title, type,
  soulbound})`.
- `outreach.js` — `logOutreach()`, `getOutreachFor()`.
- `mint-xp.js` — `mintXp(client, {tokenId, amount, recipientId,
  treasuryId})`.
- `mint-reward.js` — `mintReward(client, {tokenId, amount, recipientId,
  treasuryId})`.
- `create-xp-token.js`, `create-reward-token.js`,
  `create-credential-collection.js`, `create-account.js`,
  `create-candidate-account.js` — one-time token/account creation scripts.
- `register-issuer-key.js` / `resolve-issuer-key.js` — issuer key registry.
- `signing-keys.js` — `registerSigningKey()`, `resolveSigningKey()`,
  `canonicalConfirmationPayload()`, `verifySignature()`.
- `courses.js` — `getCatalog()`, `getCourse(id)` (static data, no I/O).
- `jobs.js` — `postJob()`, `getJobs()`.
- `search.js` — `searchCandidates()`, `getVisibleAccounts()`.
- `governance.js` — `createProposal()`, `castVote()`, `getGovernance()`.
- `employment.js` — `proposeEvent()`, `confirmEvent()`, `getEvents()`.
- `wallet.js` — `redeemReward(client, {tokenId, accountId, amount})`.
- `org-stats.js` — `getOrgOverview()`.
- `pool.js` — `getPoolStats()`, `getReserveFunded()`,
  `assertReserveCapacity()`.
- `listener.js`, `submit-message.js` — standalone CLI demo scripts, not
  used by the server.

## API endpoints

| Method | Path | Module |
|---|---|---|
| POST | `/api/signup` | signup.js |
| GET | `/api/profile` | profile.js |
| GET | `/api/credential` | verify-credential.js |
| GET | `/api/credentials` | verify-credential.js |
| GET, POST | `/api/outreach` | outreach.js |
| POST | `/api/credentials/issue` | issue-credential.js |
| POST | `/api/xp/mint` | mint-xp.js |
| POST | `/api/reward/mint` | mint-reward.js + pool.js (capacity check) |
| GET, POST | `/api/issuer-key` | register/resolve-issuer-key.js |
| GET | `/api/courses` | courses.js |
| POST | `/api/courses/:id/complete` | mint-xp.js + issue-credential.js |
| GET, POST | `/api/jobs` | jobs.js |
| GET | `/api/search-candidates` | search.js |
| GET, POST | `/api/employment-events` | employment.js |
| POST | `/api/employment-events/confirm` | employment.js + signing-keys.js |
| GET, POST | `/api/governance`, `/api/governance/proposals`, `/api/governance/vote` | governance.js |
| GET, POST | `/api/endorsements` | issue-credential.js (type: reputation_credential) |
| GET, POST | `/api/settings/visibility` | hcs-registry.js |
| GET | `/api/wallet/activity` | hcs-registry.js |
| POST | `/api/wallet/redeem` | wallet.js |
| GET | `/api/org-overview` | org-stats.js |
| GET, POST | `/api/pool`, `/api/pool/fund` | pool.js |
| GET, POST | `/api/signing-key` | signing-keys.js |

## Data model — HCS record types (one topic, `type`-discriminated)

| `type` | Fields |
|---|---|
| `course_credential` | schemaVersion, type, issuer, subject, title, issuedAt |
| `reputation_credential` | same shape as course_credential |
| `impact_certificate` | same shape as course_credential |
| `outreach_record` | organisation, candidate, postingRef, timestamp |
| `issuer_key_registration` | issuerId, publicKey, validFrom |
| `signing_key_registration` | accountId, publicKey |
| `job_posting` | organisation, title, requirements[] |
| `course_completion` | courseId, candidate, xpAwarded, title |
| `employment_event_proposed` | organisation, candidate, role, expiresAt |
| `employment_event_confirmed` | organisation, candidate, role, proposalSeq, candidateSignature, candidatePublicKey |
| `governance_proposal` | issuerId, title |
| `governance_vote` | proposalSeq, issuerId, voter, choice, weight |
| `profile_visibility` | accountId, visible |
| `redemption` | accountId, amount, vendor |
| `pool_funded` | issuerId, amount |

All records carry `schemaVersion` and `timestamp` (write time) plus, on
read, `sequenceNumber`/`consensusTimestamp` from the mirror node.

## Hedera assets (HTS)

| Asset | Token type | Keys set | freezeDefault |
|---|---|---|---|
| Credential collection (`TESTIFY-CRED`) | NonFungibleUnique | Supply, Freeze, Wipe | false |
| XP Token (`FSXP`) | FungibleCommon | Supply, Freeze | false (recreated from `true` — see README) |
| Reward Token (`FSRWD`) | FungibleCommon | Supply, Freeze, Wipe | false |

**Mint delivery pattern** (XP, credentials): mint to treasury →
`TokenUnfreezeTransaction` (try/catch, swallow
`TOKEN_NOT_ASSOCIATED_TO_ACCOUNT` for first-timers) →
`TransferTransaction` → `TokenFreezeTransaction` if soulbound. Impact
Certificates skip the freeze step.

**Reward redemption**: `TokenWipeTransaction` (burns from the holder's
balance directly, no transfer needed).

## Auth/crypto mechanism (employment-event confirmation only)

- Client: `crypto.subtle.generateKey({name:'ECDSA', namedCurve:'P-256'},
  true, ['sign','verify'])`, private key exported as JWK to
  `localStorage`, public key exported SPKI → base64 → registered on-chain.
- Sign: `crypto.subtle.sign({name:'ECDSA', hash:'SHA-256'}, privateKey,
  payloadBytes)` → raw 64-byte `r‖s` signature, base64-encoded.
- Verify (server, Node `crypto`): `crypto.verify('sha256', payload,
  {key: publicKeyObject, dsaEncoding:'ieee-p1363'}, signature)`.
- Canonical payload: `JSON.stringify({action:"confirm_employment_event",
  proposalSeq, candidate})` — must match byte-for-byte on both sides.
