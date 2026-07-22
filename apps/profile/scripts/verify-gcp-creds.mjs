/**
 * Checks GCP_CREDENTIALS_JSON can mint an ID token for the users service and
 * that the token's email claim is the one the gRPC interceptor demands.
 *
 * Run from apps/profile:  node --env-file=.env.local scripts/verify-gcp-creds.mjs
 */
import { GoogleAuth } from "google-auth-library";

const AUDIENCE =
  process.env.USERS_SERVICE ?? "https://users-v1-75542456563.europe-west1.run.app";
const EXPECTED_EMAIL = "alis-build@interface-ti-dev-nbb.iam.gserviceaccount.com";

const raw = process.env.GCP_CREDENTIALS_JSON ?? "";
if (!raw) {
  console.error("FAIL  GCP_CREDENTIALS_JSON is empty");
  process.exit(1);
}

let credentials;
try {
  credentials = JSON.parse(raw);
} catch (err) {
  console.error(`FAIL  not valid JSON — did it get pasted across multiple lines? ${err.message}`);
  process.exit(1);
}

console.log(`ok    parsed as JSON (type: ${credentials.type})`);
console.log(`ok    client_email: ${credentials.client_email}`);
if (credentials.client_email !== EXPECTED_EMAIL) {
  console.error(`FAIL  expected ${EXPECTED_EMAIL} — the interceptor accepts no other identity`);
  process.exit(1);
}

// No `scopes`: the token endpoint rejects a JWT with both scope and
// target_audience. ID tokens are audience-scoped already.
const auth = new GoogleAuth({ credentials });

const client = await auth.getIdTokenClient(AUDIENCE);
const token = await client.idTokenProvider.fetchIdToken(AUDIENCE);
const claims = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));

console.log(`ok    minted ID token for ${AUDIENCE}`);
console.log(`ok    token email claim: ${claims.email}`);
console.log(`ok    expires: ${new Date(claims.exp * 1000).toISOString()}`);

if (claims.email !== EXPECTED_EMAIL) {
  console.error(`FAIL  token email claim is ${claims.email}, not ${EXPECTED_EMAIL}`);
  process.exit(1);
}
console.log("\nPASS  credentials satisfy the gRPC interceptor");
