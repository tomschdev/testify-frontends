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

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const STATE_COOKIE = "auth_state";

/** Refresh-token lifetime on the identity service is 7 days. */
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
