/**
 * Shared OAuth session handling for the Attestant apps.
 *
 * Server-only: everything here reads env vars or httpOnly cookies. The gRPC
 * proxy lives behind the `@attestant/auth/grpc` subpath so that pages importing
 * cookie names don't pull google-auth-library into their module graph.
 */
export {
  ACCESS_TOKEN_COOKIE,
  AUTH_CLIENT_ID,
  AUTH_CLIENT_SECRET,
  AUTH_HOST,
  ISSUE_SERVICE,
  POSITIONS_SERVICE,
  PROFILES_SERVICE,
  REFRESH_COOKIE_MAX_AGE_SECONDS,
  REFRESH_TOKEN_COOKIE,
  STATE_COOKIE,
  USERS_SERVICE,
} from "./config";

export {
  clearSessionCookies,
  getValidAccessToken,
  jwtExpiry,
  requestTokens,
  setSessionCookies,
  type TokenResponse,
} from "./session";

export { callbackHandler, signinHandler, signoutHandler } from "./handlers";
