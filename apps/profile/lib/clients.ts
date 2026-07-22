import { MirrorServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_grpc_web_pb";
import { UsersServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/user_grpc_web_pb";

// Same pattern as the alis console apps: grpc-web PromiseClients pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route. One instance per service, shared
// across the client components that call it.
export const usersClient = new UsersServicePromiseClient("/api/grpc");
export const mirrorClient = new MirrorServicePromiseClient("/api/grpc");

/**
 * The proxy answers status 16 with this message when the session cookie is
 * missing or unusable, and clears the cookie on that same response — so a
 * reload lands on the signed-out page.
 */
export function isSessionError(message: string): boolean {
  return message.includes("no session");
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
