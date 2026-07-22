import { createGrpcProxyHandler } from "@attestant/auth/grpc";

export const dynamic = "force-dynamic";

/**
 * Services this app is allowed to reach. Anything not listed answers
 * `unknown method`; add the service here (and to SERVICE_HOSTS in
 * @attestant/auth/grpc if it is new) to open it up.
 *
 * The issue service is deliberately absent: the vendored protobuf bundle ships
 * no generated client for it, so credential issuance cannot be called yet.
 */
export const POST = createGrpcProxyHandler([
  "interface.ti.users.v1.UsersService",
  "interface.ti.users.v1.OrganisationsService",
]);
