import { createGrpcProxyHandler } from "@attestant/auth/grpc";

export const dynamic = "force-dynamic";

/**
 * Services this app is allowed to reach. Anything not listed answers
 * `unknown method`; add the service here (and to SERVICE_HOSTS in
 * @attestant/auth/grpc if it is new) to open it up.
 *
 * MirrorService is here for recipient resolution (GetHederaAccount before
 * issuing) and issuance confirmation (ListCredentials polling). The issue
 * service itself is not gRPC — issuance goes through /api/issue, which calls
 * issue-v1's plain HTTP endpoints server-side.
 */
export const POST = createGrpcProxyHandler([
  "interface.ti.users.v1.UsersService",
  "interface.ti.users.v1.OrganisationsService",
  "interface.ti.profiles.v1.MirrorService",
]);
