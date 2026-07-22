/**
 * Proves the minted ID token satisfies the gRPC unary interceptor.
 *
 * Sends RetrieveMyUser with ONLY the service `authorization` header and no
 * forwarded user JWT. Expected outcome is PermissionDenied "service accounts
 * cannot retrieve their own user" (users.go:1519) — an error that is only
 * reachable *after* idtoken.Validate passes. Getting it means the interceptor
 * accepted us; Unauthenticated would mean it did not.
 *
 * Run from any app dir: node --env-file=.env.local ../../packages/auth/scripts/verify-grpc-reachable.mjs
 * or via the app's package.json script:  pnpm verify:grpc
 */
import http2 from "node:http2";
import { GoogleAuth } from "google-auth-library";

const HOST = process.env.USERS_SERVICE ?? "https://users-v1-75542456563.europe-west1.run.app";
const PATH = "/interface.ti.users.v1.UsersService/RetrieveMyUser";

const auth = new GoogleAuth({ credentials: JSON.parse(process.env.GCP_CREDENTIALS_JSON) });
const client = await auth.getIdTokenClient(HOST);
const idToken = await client.idTokenProvider.fetchIdToken(HOST);

// RetrieveMyUserRequest has no fields: a 5-byte header framing a 0-byte body.
const frame = Buffer.alloc(5);

const session = http2.connect(HOST);
const stream = session.request({
  ":method": "POST",
  ":path": PATH,
  "content-type": "application/grpc+proto",
  te: "trailers",
  authorization: `Bearer ${idToken}`,
});

let headers = {};
let trailers = {};
stream.on("response", (h) => (headers = h));
stream.on("trailers", (t) => (trailers = t));
stream.on("data", () => {});
stream.on("end", () => {
  session.close();
  const status = trailers["grpc-status"] ?? headers["grpc-status"] ?? "?";
  const message = decodeURIComponent(trailers["grpc-message"] ?? headers["grpc-message"] ?? "");
  console.log(`grpc-status:  ${status}`);
  console.log(`grpc-message: ${message}\n`);

  if (status === "7") {
    console.log("PASS  interceptor accepted the service token (status 7 = PermissionDenied,");
    console.log("      reached the handler's service-account guard). Forwarding a user JWT");
    console.log("      as x-alis-forwarded-authorization will resolve to that user.");
  } else if (status === "16") {
    console.log("FAIL  Unauthenticated - the interceptor rejected the token.");
  } else {
    console.log(`note  unexpected status ${status}`);
  }
});
stream.end(frame);
