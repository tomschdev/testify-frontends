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
const CREDENTIALS_JSON = process.env.GCP_CREDENTIALS_JSON ?? "";

let cachedAuth: GoogleAuth | null = null;

function googleAuth(): GoogleAuth | null {
  if (!CREDENTIALS_JSON) return null;
  if (!cachedAuth) {
    const credentials: unknown = JSON.parse(CREDENTIALS_JSON);
    cachedAuth = new GoogleAuth({
      credentials: credentials as Record<string, unknown>,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
  }
  return cachedAuth;
}

/** Cached per audience — minting is a network round trip. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * ID token for `audience` (the target Cloud Run URL), or null when no
 * credentials are configured. Tokens live an hour; re-mint 5 minutes early.
 */
export async function serviceIdToken(audience: string): Promise<string | null> {
  const auth = googleAuth();
  if (!auth) return null;

  const cached = tokenCache.get(audience);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  try {
    const client = await auth.getIdTokenClient(audience);
    const token = await client.idTokenProvider.fetchIdToken(audience);
    tokenCache.set(audience, { token, expiresAt: Date.now() + 55 * 60 * 1000 });
    return token;
  } catch (err) {
    console.error(`[auth] minting service ID token for ${audience} failed:`, err);
    return null;
  }
}
