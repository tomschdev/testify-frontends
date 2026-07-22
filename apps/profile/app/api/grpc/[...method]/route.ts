import { createGrpcProxyHandler } from "@attestant/auth/grpc";

export const dynamic = "force-dynamic";

/**
 * Services this app is allowed to reach. Anything not listed answers
 * `unknown method`; add the service here (and to SERVICE_HOSTS in
 * @attestant/auth/grpc if it is new) to open it up.
 */
export const POST = createGrpcProxyHandler(
  [
    "interface.ti.users.v1.UsersService",
    "interface.ti.users.v1.OrganisationsService",
    "interface.ti.positions.v1.PositionsService",
    "interface.ti.profiles.v1.MirrorService",
  ],
  {
    // The job feed is public (feature list §3.6): ListPositions is
    // identity-independent, so a signed-out call answers as the deployment SA
    // with identical data. Scoped to this one method — do not add
    // ListCredentials or SearchProfiles here (impl spec §6.1).
    publicMethods: ["interface.ti.profiles.v1.MirrorService/ListPositions"],
  },
);
