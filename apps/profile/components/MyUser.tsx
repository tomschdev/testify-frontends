"use client";

import { useEffect, useState } from "react";

import { RetrieveMyUserRequest, User } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/user_pb";
import { UsersServicePromiseClient } from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/user_grpc_web_pb";

// Same pattern as the alis console apps: grpc-web PromiseClient pointed at the
// site's own origin; the session token stays server-side (httpOnly cookie) and
// is attached by the /api/grpc proxy route.
const usersClient = new UsersServicePromiseClient("/api/grpc");

type State =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; user: User.AsObject };

export function MyUser(): React.ReactNode {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    usersClient
      .retrieveMyUser(new RetrieveMyUserRequest(), {})
      .then((user) => setState({ phase: "ready", user: user.toObject() }))
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setState({ phase: "error", message });
      });
  }, []);

  if (state.phase === "loading") {
    return <p style={{ opacity: 0.7 }}>Loading your user record…</p>;
  }
  if (state.phase === "error") {
    return (
      <p style={{ color: "#fca5a5" }}>
        Could not fetch your user record from the users service: {state.message}
      </p>
    );
  }

  const { user } = state;
  return (
    <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", margin: 0 }}>
      <dt style={{ opacity: 0.6 }}>Resource</dt>
      <dd style={{ margin: 0, fontFamily: "monospace" }}>{user.name}</dd>
      <dt style={{ opacity: 0.6 }}>Email</dt>
      <dd style={{ margin: 0 }}>{user.email}</dd>
      <dt style={{ opacity: 0.6 }}>Name</dt>
      <dd style={{ margin: 0 }}>
        {user.givenName} {user.familyName}
      </dd>
    </dl>
  );
}
