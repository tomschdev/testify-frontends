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
