/**
 * Identity + backend host configuration.
 *
 * AUTH_HOST doubles as the gRPC host for the users domain: the users-v1
 * service serves its OAuth endpoints (/authorize, /token) and its native
 * gRPC API on the same origin. Env vars override the defaults per spec §2.6.
 */
export const AUTH_HOST =
  process.env.AUTH_HOST ?? "https://users-v1-75542456563.europe-west1.run.app";

export const USERS_GRPC_HOST = process.env.USERS_GRPC_HOST ?? AUTH_HOST;

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";
export const STATE_COOKIE = "auth_state";

/** Refresh-token lifetime on the identity service is 7 days. */
export const REFRESH_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
