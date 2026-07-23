import type { CSSProperties, ReactNode } from "react";

import { tokens, type SiteKey } from "./tokens";

/**
 * The product banner that sits above every console: the TESTIFY wordmark on a
 * black bar, the "know and be known" slogan chip beside it, and the three
 * console links on the right (VAULT / LEDGER / MATCHER).
 *
 * It is the one piece of chrome shared verbatim by all three apps, so it reads
 * as one product regardless of which console you are in. It scrolls away — the
 * per-console `AppBar` / `MobileShell` header below it is the sticky one.
 */

/** Console links, in banner order. `site` marks which app each one points at. */
const CONSOLES: { site: SiteKey; label: string; env: string; fallback: string }[] = [
  { site: "profile", label: "Vault", env: "NEXT_PUBLIC_URL_PROFILE", fallback: "http://localhost:3001" },
  { site: "issuer", label: "Ledger", env: "NEXT_PUBLIC_URL_ISSUER", fallback: "http://localhost:3000" },
  { site: "positions", label: "Matcher", env: "NEXT_PUBLIC_URL_POSITIONS", fallback: "http://localhost:3002" },
];

/**
 * Deployed URLs differ per environment, so each console's origin comes from a
 * `NEXT_PUBLIC_URL_*` env var, falling back to its local dev port. The lookups
 * are written out literally because Next.js inlines `process.env.NEXT_PUBLIC_*`
 * at build time only for statically-analysable member expressions.
 */
const CONSOLE_URLS: Record<string, string | undefined> = {
  NEXT_PUBLIC_URL_PROFILE: process.env.NEXT_PUBLIC_URL_PROFILE,
  NEXT_PUBLIC_URL_ISSUER: process.env.NEXT_PUBLIC_URL_ISSUER,
  NEXT_PUBLIC_URL_POSITIONS: process.env.NEXT_PUBLIC_URL_POSITIONS,
};

const styles: Record<string, CSSProperties> = {
  banner: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "10px 20px",
    background: tokens.color.ink,
    color: tokens.color.surface,
    fontFamily: tokens.font.sans,
  },
  wordmark: {
    fontSize: "22px",
    fontWeight: 800,
    letterSpacing: "0.06em",
    lineHeight: 1,
    textTransform: "uppercase",
    color: tokens.color.surface,
    textDecoration: "none",
    flex: "none",
  },
  slogan: {
    flex: "none",
    display: "inline-block",
    padding: "4px 9px",
    background: tokens.color.surface,
    color: tokens.color.ink,
    border: `${tokens.border.default} solid ${tokens.color.ink}`,
    borderRadius: tokens.radius.sm,
    // The chip is white-on-black, so its ink shadow would vanish; a second
    // black-bordered box offset behind it keeps the stacked-card look.
    boxShadow: `3px 3px 0 0 ${tokens.color.ink}, 3px 3px 0 2px ${tokens.color.surface}`,
    fontSize: "10px",
    fontWeight: 800,
    letterSpacing: "0.08em",
    lineHeight: 1.1,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  },
  nav: {
    marginLeft: "auto",
    display: "flex",
    alignItems: "center",
    gap: "22px",
  },
};

function linkStyle(active: boolean): CSSProperties {
  return {
    fontFamily: tokens.font.mono,
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    textDecoration: "none",
    color: tokens.color.surface,
    // The console you are in is underlined rather than recoloured, so the bar
    // stays monochrome whatever the site accent is.
    borderBottom: active ? `${tokens.border.default} solid ${tokens.color.surface}` : "none",
    paddingBottom: active ? "2px" : "0",
    opacity: active ? 1 : 0.75,
    whiteSpace: "nowrap",
  };
}

export interface TopBannerProps {
  /** Which console is rendering the banner; its link is marked current. */
  site: SiteKey;
}

export function TopBanner({ site }: TopBannerProps): ReactNode {
  return (
    <div className="testify-banner" style={styles.banner}>
      <a href="/" style={styles.wordmark}>
        Testify
      </a>
      <span className="testify-banner-slogan" style={styles.slogan}>
        Know and be known.
      </span>
      <nav style={styles.nav}>
        {CONSOLES.map((console) => {
          const active = console.site === site;
          return (
            <a
              key={console.site}
              href={active ? "/" : CONSOLE_URLS[console.env] ?? console.fallback}
              aria-current={active ? "page" : undefined}
              style={linkStyle(active)}
            >
              {console.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
