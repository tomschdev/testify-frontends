import { NextRequest, NextResponse } from "next/server";

import { POSITIONS_SERVICE, PROFILES_SERVICE, USERS_SERVICE } from "@/lib/config";
import { serviceIdToken } from "@/lib/googleAuth";
import { forwardUnary, statusOnlyBody } from "@/lib/grpcProxy";
import { getValidAccessToken } from "@/lib/session";

export const dynamic = "force-dynamic";

const GRPC_WEB_TEXT = "application/grpc-web-text";

/** Reachable services and the backend host each one lives on. */
const SERVICE_HOSTS: Record<string, string> = {
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

/**
 * grpc-web endpoint: the browser PromiseClients are constructed with
 * baseUrl '/api/grpc', so calls arrive as
 * POST /api/grpc/{package.Service}/{Method} with a grpc-web-text body.
 * The user's token never reaches the browser: it is read from the httpOnly
 * session cookie here and sent as `x-alis-forwarded-authorization`, the alis
 * convention for end-user identity on service-to-service hops.
 *
 * `authorization` is a separate concern — it identifies *this caller* to the
 * service and must be a Google ID token for the deployment service account
 * (see lib/googleAuth.ts). The two are not interchangeable.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ method: string[] }> },
): Promise<NextResponse> {
  const segments = (await params).method;
  const host = segments.length === 2 ? SERVICE_HOSTS[segments[0]] : undefined;
  if (!host) {
    return grpcWebResponse(statusOnlyBody(12, `unknown method ${segments.join("/")}`));
  }
  const [service, method] = segments;

  const token = await getValidAccessToken();
  if (!token) {
    return grpcWebResponse(statusOnlyBody(16, "no session - sign in at /auth/signin"));
  }

  const idToken = await serviceIdToken(host);
  if (!idToken) {
    return grpcWebResponse(
      statusOnlyBody(16, "service credentials not configured - set GCP_CREDENTIALS_JSON"),
    );
  }

  const raw = Buffer.from(await req.arrayBuffer());
  const contentType = req.headers.get("content-type") ?? "";
  const frames = contentType.startsWith(GRPC_WEB_TEXT)
    ? Buffer.from(raw.toString("utf8"), "base64")
    : raw;

  try {
    const result = await forwardUnary(host, `/${service}/${method}`, frames, {
      authorization: `Bearer ${idToken}`,
      "x-alis-forwarded-authorization": token,
    });
    return grpcWebResponse(result.bodyBase64);
  } catch (err) {
    console.error(`[grpc-proxy] ${service}/${method} failed:`, err);
    return grpcWebResponse(statusOnlyBody(14, "upstream unavailable"));
  }
}
