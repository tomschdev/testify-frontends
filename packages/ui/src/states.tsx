import type { ReactNode } from "react";

import { tokens } from "./tokens";

/**
 * The gRPC proxy answers status 16 with this message when the session cookie
 * is missing or unusable, and clears the cookie on that same response — so a
 * reload lands on the signed-out page. Previously duplicated in
 * Organisations.tsx, PositionsConsole.tsx and PositionsList.tsx.
 */
export function isSessionError(message: string): boolean {
  return message.includes("no session");
}

export interface EmptyStateProps {
  children?: ReactNode;
}

/** Honest empty state — never fabricated data (impl spec §3 phase 2). */
export function EmptyState({ children }: EmptyStateProps): ReactNode {
  return <p style={{ opacity: 0.7, margin: 0 }}>{children}</p>;
}

export interface ErrorStateProps {
  /**
   * What was being attempted, e.g. "Could not fetch your organisations from
   * the users service". Rendered as `{context}: {message}`.
   */
  context: string;
  message: string;
  /** Where the session-invalid variant sends the user. */
  signInHref?: string;
}

/**
 * Error display with the session-invalid variant built in: when `message` is
 * the proxy's no-session answer, renders a sign-in prompt instead of the raw
 * error.
 */
export function ErrorState({
  context,
  message,
  signInHref = "/auth/signin",
}: ErrorStateProps): ReactNode {
  if (isSessionError(message)) {
    return (
      <p style={{ color: tokens.color.danger, margin: 0 }}>
        Your session is not valid for this app.{" "}
        <a href={signInHref} style={{ color: "inherit" }}>
          Sign in again
        </a>
        .
      </p>
    );
  }
  return (
    <p style={{ color: tokens.color.danger, margin: 0 }}>
      {context}: {message}
    </p>
  );
}
