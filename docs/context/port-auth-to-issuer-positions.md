# Prompt: implement sign-in/up and data fetching for the issuer and positions apps

Implement OAuth sign-in/sign-up and authenticated gRPC data fetching for
`apps/issuer` and `apps/positions`, matching the working implementation in
`apps/profile`. Read `apps/profile` first — it is the reference, and it took
several non-obvious fixes to get right. The notes below record what those were
so you don't rediscover them by trial and error.

## Reference implementation (apps/profile)

| File | Role |
|---|---|
| `lib/config.ts` | Service hosts, `AUTH_CLIENT_ID`/`AUTH_CLIENT_SECRET`, cookie names |
| `lib/session.ts` | Token exchange + refresh, httpOnly cookie handling, `jwtExpiry` |
| `lib/googleAuth.ts` | Mints Google ID tokens for the backend Cloud Run services |
| `lib/grpcProxy.ts` | grpc-web-text ↔ native gRPC bridge for unary calls |
| `app/auth/signin/route.ts` | Starts the redirect to the identity service |
| `app/auth/callback/route.ts` | Exchanges the auth code, sets session cookies |
| `app/auth/signout/route.ts` | Clears cookies |
| `app/api/grpc/[...method]/route.ts` | Server-side proxy; attaches both auth headers |
| `components/MyUser.tsx` | Example client component calling a PromiseClient |
| `scripts/verify-gcp-creds.mjs` | Checks credentials mint a valid ID token |
| `scripts/verify-grpc-reachable.mjs` | Checks the interceptor accepts that token |

Backend source of truth (read it, don't infer):
`/Users/thomasscholtz/alis.build/interface/build/ti/users/v1/`

## Four invariants that will silently break things

**1. Two auth headers, not interchangeable.** `authorization` must be a Google
ID token identifying the *calling service*; the signed-in user's JWT goes in
`x-alis-forwarded-authorization`. The gRPC interceptor runs `idtoken.Validate`
on `authorization` and requires the email claim to equal
`alis-build@interface-ti-dev-nbb.iam.gserviceaccount.com`
(`internal/services/interceptors.go:38-46`). Putting the user's token there
yields `Unauthenticated: invalid or expired token` no matter how fresh it is.

The user identity still resolves: when the `authorization` principal is the
deployment service account, `go.alis.build/iam/v2` *replaces* it with the
identity from the forwarding header (`identity.go:223-235`). This only works
because it is that specific SA — a narrower service account would authenticate
but never trigger the swap.

**2. Never pass `scopes` to `GoogleAuth` when minting ID tokens.** Google's
token endpoint rejects an assertion carrying both a scope and a
`target_audience`: `invalid_request: cannot specify both scope and target
audience in jwt`. Construct it as `new GoogleAuth({ credentials })`.

**3. Always send `client_id` on the authorize/signup redirect.** The identity
service encodes upstream-provider state as the comma-joined triple
`redirect_uri,client_id,state`, but *omits* the client_id field rather than
leaving it empty when there is no client (`internal/handlers/main.go:622-628`).
Its callback reads field 1 as the client_id unconditionally (`main.go:786`), so
a client-id-less flow that also sends `state` puts the CSRF nonce in the
client_id slot and 404s with `no app with this client_id`.

**4. Every redirect_uri must be registered on the app.** Matching is exact, or
prefix-based when the registered value ends in `*` (`main.go:1704-1716`).
Register the production URL *and* a `https://attestant-<app>-*` wildcard, or
preview deploys fail with `invalid redirect_uri`.

## Per-app setup

Each app needs its own registered OAuth app. While signed in to the identity
service in a browser:

```
https://users-v1-75542456563.europe-west1.run.app/apps/new
  ?display_name=Attestant%20Issuer
  &redirect_uris=http://localhost:3000/auth/callback,https://attestant-issuer.vercel.app/auth/callback,https://attestant-issuer-*
```

The resulting page shows the client_id and client_secret **once**. Then set, per
Vercel project (Production, Preview, and Development):

- `AUTH_CLIENT_ID`
- `AUTH_CLIENT_SECRET`
- `GCP_CREDENTIALS_JSON` — full service account key JSON for
  `alis-build@interface-ti-dev-nbb`, same value already on `attestant-profile`

Note `/token` rejects a `client_id` sent without a matching `client_secret`
(`main.go:1033`), so `lib/config.ts` fails fast if only one is set. Keep that.

## Known blocker: the issuer app has no gRPC client

The vendored bundle `vendor/internal.ti.alis.build-protobuf-1.0.11.tgz` contains
generated clients for `users`, `profiles`, and `positions` **only** — there is no
`issue`/`issuer` package. Confirm this before starting:

```
tar tzf vendor/internal.ti.alis.build-protobuf-1.0.11.tgz | grep grpc_web_pb
```

So for the issuer app, implement auth in full (it is self-contained), and stop
before data fetching — a newer protobuf bundle including the issue service is
needed. Do not invent a client or hand-roll stubs. Report this rather than
working around it.

Positions is unblocked: `PositionsServicePromiseClient` from
`@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_grpc_web_pb`,
with `listPositions`, `getPosition`, `searchProfiles` and others. Add the
`@internal.ti.alis.build/protobuf`, `google-protobuf`, `grpc-web` and
`google-auth-library` dependencies to each app that needs them — currently only
`apps/profile` has them.

Register each reachable service in the proxy's `SERVICE_HOSTS` map; anything
absent returns `unknown method` by design.

## Preferred approach: extract, don't triplicate

`lib/config.ts`, `lib/session.ts`, `lib/googleAuth.ts`, `lib/grpcProxy.ts` and
the three `app/auth/*` routes are app-agnostic apart from env values. Prefer
extracting them into a shared workspace package (e.g. `packages/auth`,
alongside the existing `packages/ui`) and having all three apps consume it,
rather than copying three times. The route files must still exist per app —
Next.js requires them — but they should be thin re-exports. If you find a
genuine reason this doesn't work, say so and copy instead.

## Verification — do not rely on the browser alone

Both scripts are in `apps/profile/scripts/` and are worth reusing per app:

```
node --env-file=.env.local scripts/verify-gcp-creds.mjs
node --env-file=.env.local scripts/verify-grpc-reachable.mjs
```

The second is the useful one: it calls `RetrieveMyUser` with only the service
token and expects `grpc-status: 7`, `service accounts cannot retrieve their own
user`. That guard (`internal/services/users.go:1519`) sits *after*
`idtoken.Validate`, so reaching it proves the interceptor accepted the token.
`grpc-status: 16` means it did not.

For the sign-in redirect, check the state triple has three fields:

```
curl -s -o /dev/null -D - http://localhost:3000/auth/signin | grep -i location
```

Also note grpc-web always returns **HTTP 200**; the real status is in the
trailers. A 200 in the network tab means nothing on its own.

Kill and restart any dev server started before your changes — a stale server
serving old code caused a long false diagnosis on the profile app.

## Conventions

Follow `apps/profile` and the repo rules: TypeScript strict, no `any`, explicit
return types on exported functions, named exports except Next.js special files
(`page`/`layout`/`route`/`error`/`loading`/`not-found`), Server Components by
default with narrow `"use client"` boundaries, `@/` path alias. Secrets go in
`.env.local` (gitignored via `.env*.local`) and Vercel env vars — never in
source, and never in `.env.example`.

Run `npx tsc --noEmit` per app before committing.
