import { NextRequest, NextResponse } from "next/server";

import { POSITIONS_SERVICE, PROFILES_SERVICE, USERS_SERVICE } from "./config";
import { serviceIdToken } from "./googleAuth";
import { forwardUnary, statusOnlyBody } from "./grpcProxy";
import { clearSessionCookies, getValidAccessToken } from "./session";

const GRPC_WEB_TEXT = "application/grpc-web-text";

/**
 * Every reachable service and the backend host it lives on. An app opts into a
 * subset by passing service names to `createGrpcProxyHandler`; anything not in
 * the resulting map returns `unknown method` by design.
 *
 * There is deliberately no `interface.ti.issue.v1.*` entry: the vendored
 * protobuf bundle ships no generated client for the issue service, so nothing
 * can call it yet.
 */
export const SERVICE_HOSTS: Record<string, string> = {
  "interface.ti.users.v1.UsersService": USERS_SERVICE,
  "interface.ti.users.v1.OrganisationsService": USERS_SERVICE,
  "interface.ti.positions.v1.PositionsService": POSITIONS_SERVICE,
  "interface.ti.profiles.v1.MirrorService": PROFILES_SERVICE,
};

function grpcWebResponse(bodyBase64: string, httpStatus = 200): NextResponse {
  return new NextResponse(bodyBase64, {
    status: httpStatus,
    headers: { "Content-Type": GRPC_WEB_TEXT },
  }) as NextResponse;
}

/** Narrows SERVICE_HOSTS to the services an app is allowed to reach. */
function hostsFor(services: readonly string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const service of services) {
    const host = SERVICE_HOSTS[service];
    if (!host) {
      throw new Error(`unknown gRPC service '${service}' — add it to SERVICE_HOSTS`);
    }
    map[service] = host;
  }
  return map;
}

export type GrpcProxyHandler = (
  req: NextRequest,
  ctx: { params: Promise<{ method: string[] }> },
) => Promise<NextResponse>;

/**
 * Builds the app's grpc-web endpoint: the browser PromiseClients are
 * constructed with baseUrl '/api/grpc', so calls arrive as
 * POST /api/grpc/{package.Service}/{Method} with a grpc-web-text body.
 * The user's token never reaches the browser: it is read from the httpOnly
 * session cookie here and sent as `x-alis-forwarded-authorization`, the alis
 * convention for end-user identity on service-to-service hops.
 *
 * `authorization` is a separate concern — it identifies *this caller* to the
 * service and must be a Google ID token for the deployment service account
 * (see googleAuth.ts). The two are not interchangeable.
 */
export function createGrpcProxyHandler(services: readonly string[]): GrpcProxyHandler {
  const hosts = hostsFor(services);

  return async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ method: string[] }> },
  ): Promise<NextResponse> {
    const segments = (await params).method;
    const host = segments.length === 2 ? hosts[segments[0]] : undefined;
    if (!host) {
      return grpcWebResponse(statusOnlyBody(12, `unknown method ${segments.join("/")}`));
    }
    const [service, method] = segments;

    const token = await getValidAccessToken();
    if (!token) {
      // Getting here with cookies present means they are unusable: expired
      // past refresh, or minted for a different client_id. Clear them, so the
      // page stops rendering a signed-in UI over a dead session.
      const res = grpcWebResponse(statusOnlyBody(16, "no session - sign in at /auth/signin"));
      clearSessionCookies(res.cookies);
      return res;
    }

    const idToken = await serviceIdToken(host);
    if ("error" in idToken) {
      return grpcWebResponse(statusOnlyBody(16, idToken.error));
    }

    const raw = Buffer.from(await req.arrayBuffer());
    const contentType = req.headers.get("content-type") ?? "";
    const frames = contentType.startsWith(GRPC_WEB_TEXT)
      ? Buffer.from(raw.toString("utf8"), "base64")
      : raw;

    try {
      const result = await forwardUnary(host, `/${service}/${method}`, frames, {
        authorization: `Bearer ${idToken.token}`,
        "x-alis-forwarded-authorization": token,
      });
      return grpcWebResponse(result.bodyBase64);
    } catch (err) {
      console.error(`[grpc-proxy] ${service}/${method} failed:`, err);
      return grpcWebResponse(statusOnlyBody(14, "upstream unavailable"));
    }
  };
}

export { forwardUnary, statusOnlyBody } from "./grpcProxy";
export { serviceIdToken, type IdTokenResult } from "./googleAuth";
