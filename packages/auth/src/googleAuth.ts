import { GoogleAuth } from "google-auth-library";

/**
 * Google ID tokens for calling the backend Cloud Run services.
 *
 * The alis services use two auth headers, and they are not interchangeable:
 *
 *   authorization                    Google ID token identifying the *calling
 *                                    service*. The users service's gRPC unary
 *                                    interceptor runs idtoken.Validate on it
 *                                    and requires the email claim to equal
 *                                    alis-build@{ALIS_OS_PROJECT}.iam.gserviceaccount.com
 *                                    (interceptors.go:38-46).
 *   x-alis-forwarded-authorization   The end user's JWT from our session
 *                                    cookie. This is what go.alis.build/iam
 *                                    resolves the caller identity from.
 *
 * Putting the user's token in `authorization` fails idtoken.Validate and the
 * service answers Unauthenticated "invalid or expired token" — regardless of
 * how fresh the user's token is.
 *
 * GCP_CREDENTIALS_JSON holds either a service-account key or an external
 * account (Workload Identity Federation) config; GoogleAuth accepts both, so
 * moving from a key to keyless federation is a config change, not a code one.
 */

/** Read lazily: a module-scope read is captured before the runtime env exists. */
function credentialsJson(): string {
  return process.env.GCP_CREDENTIALS_JSON ?? "";
}

export type IdTokenResult = { token: string } | { error: string };

let cachedAuth: GoogleAuth | null = null;

/**
 * Returns the auth client, or a description of why it can't be built. Every
 * failure names the actual defect — absent, empty, unparseable, wrong identity
 * — so a misconfigured deployment doesn't masquerade as an unset one.
 */
function googleAuth(): { auth: GoogleAuth } | { error: string } {
  if (cachedAuth) return { auth: cachedAuth };

  const raw = credentialsJson();
  if (!raw) {
    return { error: "GCP_CREDENTIALS_JSON is not set on this deployment" };
  }

  // A value pasted with the .env single quotes still attached is valid text but
  // invalid JSON; strip them rather than failing on a cosmetic mistake.
  const trimmed = raw.trim().replace(/^'(.*)'$/s, "$1");

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(trimmed) as Record<string, unknown>;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      error: `GCP_CREDENTIALS_JSON is set (${trimmed.length} chars) but is not valid JSON: ${detail}`,
    };
  }

  if (typeof credentials.client_email !== "string") {
    return { error: "GCP_CREDENTIALS_JSON parsed but has no client_email" };
  }

  // No `scopes` here: the token endpoint rejects a JWT carrying both a scope
  // and a target_audience ("cannot specify both scope and target audience in
  // jwt"). ID tokens are audience-scoped, so scopes are meaningless for them.
  cachedAuth = new GoogleAuth({ credentials });
  return { auth: cachedAuth };
}

/** Cached per audience — minting is a network round trip. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * ID token for `audience` (the target Cloud Run URL). Tokens live an hour;
 * re-mint 5 minutes early.
 */
export async function serviceIdToken(audience: string): Promise<IdTokenResult> {
  const cached = tokenCache.get(audience);
  if (cached && cached.expiresAt > Date.now()) return { token: cached.token };

  const result = googleAuth();
  if ("error" in result) {
    console.error(`[auth] ${result.error}`);
    return result;
  }

  try {
    const client = await result.auth.getIdTokenClient(audience);
    const token = await client.idTokenProvider.fetchIdToken(audience);
    tokenCache.set(audience, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
    return { token };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[auth] minting service ID token for ${audience} failed:`, err);
    return { error: `could not mint service ID token: ${detail}` };
  }
}
