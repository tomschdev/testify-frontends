"use client";

/**
 * Client-side custody of the org's XP token id.
 *
 * `/v1/xp-tokens:submit` returns a `tokenId` and nothing on the backend
 * remembers it — there is no lookup RPC (deliberately deferred). So the
 * console keeps it in localStorage, keyed by the organisation, and always
 * displays it so it can be written down.
 *
 * If it is lost anyway the token is still on-chain: it is the token whose
 * memo is `xp:<issuer account>`, findable on HashScan. That is why the UI
 * also accepts a pasted token id — recovery by hand, no mirror-walk needed.
 */

const KEY_PREFIX = "attestant.issuer.xpToken.";

export interface StoredXpToken {
  /** Hedera token id, `0.0.<n>`. */
  tokenId: string;
  tokenName: string;
  tokenSymbol: string;
  /** The issuing org's Hedera account id — the token's memo is `xp:<issuer>`. */
  issuer: string;
  /** When this console recorded it (creation, or a manual restore). */
  recordedAtMs: number;
}

/** Keyed by organisation resource name, `organisations/{id}`. */
function storageKey(organisation: string): string {
  return `${KEY_PREFIX}${organisation}`;
}

export function readXpToken(organisation: string): StoredXpToken | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(organisation));
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredXpToken>;
    if (typeof parsed.tokenId !== "string" || parsed.tokenId === "") return null;
    return {
      tokenId: parsed.tokenId,
      tokenName: typeof parsed.tokenName === "string" ? parsed.tokenName : "",
      tokenSymbol: typeof parsed.tokenSymbol === "string" ? parsed.tokenSymbol : "",
      issuer: typeof parsed.issuer === "string" ? parsed.issuer : "",
      recordedAtMs: typeof parsed.recordedAtMs === "number" ? parsed.recordedAtMs : 0,
    };
  } catch {
    // Corrupt entry — treat as absent rather than blocking the console. The
    // create gate then reopens, which is why the create form warns first.
    return null;
  }
}

export function writeXpToken(organisation: string, token: StoredXpToken): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(organisation), JSON.stringify(token));
}

export function clearXpToken(organisation: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(organisation));
}
