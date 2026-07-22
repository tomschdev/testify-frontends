import { MirrorServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/profiles/v1/mirror_grpc_web_pb";
import { PositionsServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/positions/v1/positions_grpc_web_pb";
import { OrganisationsServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/organisation_grpc_web_pb";
import { UsersServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/user_grpc_web_pb";

// Same pattern as the alis console apps: grpc-web PromiseClients pointed at
// the site's own origin; the session token stays server-side (httpOnly
// cookie) and is attached by the /api/grpc proxy route. One instance per
// service, shared by every component.
export const positionsClient = new PositionsServicePromiseClient("/api/grpc");
export const orgsClient = new OrganisationsServicePromiseClient("/api/grpc");
export const usersClient = new UsersServicePromiseClient("/api/grpc");
export const mirrorClient = new MirrorServicePromiseClient("/api/grpc");
