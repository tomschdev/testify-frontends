"use client";

import { useEffect, useState } from "react";

import {
  RetrieveMyUserRequest,
  User,
} from "@internal.ti.alis.build/protobuf/interface/ti/users/v1/user_pb";

import { errorMessage, usersClient } from "@/lib/clients";

export type MyUserState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; user: User.AsObject };

/**
 * Fetches the signed-in user's record once. Everything user-scoped in this
 * console keys off `user.hederaAccountAddress` (user.proto
 * `hedera_account_address`): it is the account_id for `ListCredentials` /
 * `ListTokenHoldings`, and the key for locating the user's own row in
 * `SearchProfiles` results.
 */
export function useMyUser(enabled = true): MyUserState {
  const [state, setState] = useState<MyUserState>({ phase: "loading" });

  useEffect(() => {
    if (!enabled) return;
    usersClient
      .retrieveMyUser(new RetrieveMyUserRequest(), {})
      .then((user) => setState({ phase: "ready", user: user.toObject() }))
      .catch((err: unknown) => setState({ phase: "error", message: errorMessage(err) }));
  }, [enabled]);

  return state;
}
