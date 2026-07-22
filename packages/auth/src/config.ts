/**
 * Backend service hosts (Cloud Run). Overridable per environment via the
 * <NAME>_SERVICE env vars; defaults point at the deployed dev instances.
 *
 * The users service doubles as the identity provider: it serves the OAuth
 * endpoints (/authorize, /signup, /token) and its native gRPC API on the
 * same origin.
 */
export const USERS_SERVICE =
  process.env.USERS_SERVICE ?? "https://users-v1-75542456563.europe-west1.run.app";
export const POSITIONS_SERVICE =
  process.env.POSITIONS_SERVICE ?? "https://positions-v1-75542456563.europe-west1.run.app";
export const PROFILES_SERVICE =
  process.env.PROFILES_SERVICE ?? "https://profiles-v1-75542456563.europe-west1.run.app";
export const ISSUE_SERVICE =
  process.env.ISSUE_SERVICE ?? "https://issue-v1-75542456563.europe-west1.run.app";

export const AUTH_HOST = process.env.AUTH_HOST ?? USERS_SERVICE;

/**
 * OAuth app credentials, issued by the identity service when the app is
 * registered (`GET /apps/new` while signed in, or `POST /register`). The
 * client_id is the App resource id — `apps/{client_id}` must resolve on the
 * identity service or every endpoint returns "no app with this client_id".
 *
 * Both are optional: unset, we fall back to the client-id-less flow. That
 * fallback cannot carry a `state` value (see the signin route), so registering
 * an app is the supported path.
 */
export const AUTH_CLIENT_ID = process.env.AUTH_CLIENT_ID ?? "";
export const AUTH_CLIENT_SECRET = process.env.AUTH_CLIENT_SECRET ?? "";

if (AUTH_CLIENT_ID && !AUTH_CLIENT_SECRET) {
  throw new Error("AUTH_CLIENT_ID is set but AUTH_CLIENT_SECRET is missing; /token rejects one without the other");
}

/**
 * Cookie names are namespaced by client_id, because tokens are bound to the
 * OAuth app that minted them: /token rejects a refresh token whose ClientId is
 * not the caller's, with 412 "client_id mismatch" (main.go:1182), and likewise
 * an auth code (main.go:1144).
 *
 * In development all three apps run on localhost:3000 and therefore share one
 * cookie jar. With fixed names, signing into one app leaves the other two
 * reading a token they cannot use — their pages see a cookie and render the
 * signed-in UI, then every gRPC call fails. Keying the cookie by client_id
 * makes the jars disjoint, which also means a re-registered app's stale
 * cookies are simply ignored rather than half-working.
 */
const cookieSuffix = AUTH_CLIENT_ID ? `_${AUTH_CLIENT_ID.slice(0, 8)}` : "";

export const ACCESS_TOKEN_COOKIE = `access_token${cookieSuffix}`;
export const REFRESH_TOKEN_COOKIE = `refresh_token${cookieSuffix}`;
export const STATE_COOKIE = `auth_state${cookieSuffix}`;

/** Refresh-token lifetime on the identity service is 7 days. */
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
