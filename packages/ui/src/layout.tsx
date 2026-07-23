import type { CSSProperties, ReactNode } from "react";

import { siteThemes, tokens, type SiteKey } from "./tokens";

/**
 * Shared layout scaffolding for the three consoles — the single source for
 * page structure, so "grouped panels on a dashboard" and "mobile app with a
 * bottom bar" look and behave the same wherever they appear.
 *
 * Two shells:
 *  - `Dashboard` — full-width desktop console: sticky AppBar + hero header +
 *    a `PanelGrid` of titled `Panel`s that separate each concern.
 *  - `MobileShell` + `BottomNav` — phone-shaped app: a top title bar, a
 *    single scrolling panel column, and a fixed bottom tab bar.
 *
 * All server-safe (pure markup + anchors); interactions come from the shared
 * `.neo-interactive` class in `neoGlobalCss`.
 */

// ── AppBar ──────────────────────────────────────────────────────────────
/**
 * The single bar at the top of every console: the TESTIFY wordmark and the
 * "know and be known" slogan chip on the black product ground, then the
 * console's own name and its actions. One bar, so the product identity and
 * the console identity never stack into two rows of chrome.
 *
 * It is sticky, so which console you are in stays visible as the hero scrolls
 * away. Both shells render it — `Dashboard` passes the console name,
 * `MobileShell` passes the current screen's title.
 */
export interface AppBarProps {
  site: SiteKey;
  /** Console name (or, on mobile, the screen title), shown bold. */
  name: string;
  /** Right-aligned slot — sign in/out, etc. */
  actions?: ReactNode;
}

export function AppBar({ site, name, actions }: AppBarProps): ReactNode {
  const theme = siteThemes[site];
  return (
    <header
      className="testify-appbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "10px 20px",
        background: tokens.color.ink,
        color: tokens.color.surface,
        fontFamily: tokens.font.sans,
      }}
    >
      <a href="/" style={wordmarkStyle}>
        Testify
      </a>
      <span className="testify-appbar-slogan" style={sloganStyle}>
        Know and be known.
      </span>
      <span style={{ opacity: 0.45, flex: "none" }}>/</span>
      <span style={siteMarkStyle(theme.accent)} />
      <span
        style={{
          fontWeight: 800,
          fontSize: "15px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name}
      </span>
      {actions !== undefined && <div style={{ marginLeft: "auto", flex: "none" }}>{actions}</div>}
    </header>
  );
}

const wordmarkStyle: CSSProperties = {
  flex: "none",
  fontSize: "20px",
  fontWeight: 800,
  letterSpacing: "0.06em",
  lineHeight: 1,
  textTransform: "uppercase",
  color: tokens.color.surface,
  textDecoration: "none",
};

const sloganStyle: CSSProperties = {
  flex: "none",
  display: "inline-block",
  padding: "4px 9px",
  background: tokens.color.surface,
  color: tokens.color.ink,
  border: `${tokens.border.default} solid ${tokens.color.ink}`,
  borderRadius: tokens.radius.sm,
  // White-on-black, so an ink shadow would be invisible; a white ring around
  // the black offset keeps the stacked-card look readable on the dark bar.
  boxShadow: `3px 3px 0 0 ${tokens.color.ink}, 3px 3px 0 2px ${tokens.color.surface}`,
  fontSize: "10px",
  fontWeight: 800,
  letterSpacing: "0.08em",
  lineHeight: 1.1,
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

/** Per-site accent square — the cue for which console you are in. */
function siteMarkStyle(accent: string): CSSProperties {
  return {
    width: "12px",
    height: "12px",
    flex: "none",
    background: accent,
    // Bordered in the bar's own foreground so it reads against black.
    border: `${tokens.border.thin} solid ${tokens.color.surface}`,
    borderRadius: "3px",
  };
}

// ── PageHeader ──────────────────────────────────────────────────────────
export interface PageHeaderProps {
  site: SiteKey;
  audience: string;
  name: string;
  purpose: string;
}

export function PageHeader({ site, audience, name, purpose }: PageHeaderProps): ReactNode {
  const theme = siteThemes[site];
  return (
    <div style={{ display: "grid", gap: "12px" }}>
      <span
        style={{
          justifySelf: "start",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: tokens.color.ink,
          background: theme.accent,
          border: `${tokens.border.default} solid ${tokens.color.ink}`,
          boxShadow: tokens.shadow.sm,
          borderRadius: tokens.radius.sm,
          padding: "4px 10px",
        }}
      >
        {audience}
      </span>
      <h1
        style={{
          fontSize: "30px",
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        {name}
      </h1>
      <p
        style={{
          fontSize: "15px",
          lineHeight: 1.6,
          color: tokens.color.textMuted,
          margin: 0,
          maxWidth: "60ch",
        }}
      >
        {purpose}
      </p>
    </div>
  );
}

// ── Dashboard shell ─────────────────────────────────────────────────────
export interface DashboardProps {
  site: SiteKey;
  name: string;
  audience: string;
  purpose: string;
  /** AppBar right slot — typically the sign in/out control. */
  actions?: ReactNode;
  children?: ReactNode;
}

export function Dashboard({ site, name, audience, purpose, actions, children }: DashboardProps): ReactNode {
  return (
    <div
      style={{
        flex: 1,
        background: tokens.color.bg,
        color: tokens.color.text,
        fontFamily: tokens.font.sans,
      }}
    >
      <AppBar site={site} name={name} actions={actions} />
      <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px 20px 72px" }}>
        <PageHeader site={site} audience={audience} name={name} purpose={purpose} />
        <div style={{ marginTop: "28px" }}>{children}</div>
      </main>
    </div>
  );
}

// ── Panel + PanelGrid ───────────────────────────────────────────────────
export interface PanelProps {
  /** Header title — small, bold, uppercase. Omit for a plain card. */
  title?: string;
  /** Marker colour cueing this concern (defaults to a neutral ink dot). */
  accent?: string;
  /** Right-aligned header slot. */
  actions?: ReactNode;
  /** Span the full grid width instead of one column. */
  wide?: boolean;
  style?: CSSProperties;
  children?: ReactNode;
}

/**
 * A titled neo card that visually fences one concern. The accent marker in the
 * header is the grouping cue — give related panels the same colour, distinct
 * concerns different ones.
 */
export function Panel({ title, accent, actions, wide = false, style, children }: PanelProps): ReactNode {
  return (
    <section
      style={{
        gridColumn: wide ? "1 / -1" : "auto",
        background: tokens.color.surface,
        border: `${tokens.border.default} solid ${tokens.color.ink}`,
        borderRadius: tokens.radius.md,
        boxShadow: tokens.shadow.md,
        overflow: "hidden",
        ...style,
      }}
    >
      {(title !== undefined || actions !== undefined) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            padding: "11px 16px",
            borderBottom: `${tokens.border.default} solid ${tokens.color.ink}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                flex: "none",
                background: accent ?? tokens.color.ink,
                border: `${tokens.border.thin} solid ${tokens.color.ink}`,
                borderRadius: "2px",
              }}
            />
            {title !== undefined && (
              <h2
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "0.07em",
                  textTransform: "uppercase",
                  margin: 0,
                  color: tokens.color.ink,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {title}
              </h2>
            )}
          </div>
          {actions !== undefined && <div style={{ flex: "none" }}>{actions}</div>}
        </div>
      )}
      <div style={{ padding: "16px" }}>{children}</div>
    </section>
  );
}

export interface PanelGridProps {
  /** Minimum column width before wrapping. Defaults to 320px (→ 2 cols @ 1000px). */
  minColumn?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function PanelGrid({ minColumn = "320px", style, children }: PanelGridProps): ReactNode {
  return (
    <div
      style={{
        display: "grid",
        gap: "20px",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minColumn}, 1fr))`,
        alignItems: "start",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ── Mobile shell + bottom nav ───────────────────────────────────────────
export interface MobileShellProps {
  site: SiteKey;
  /** Top-bar title, e.g. "Wallet". */
  title: string;
  /** Top-right slot (sign in/out). */
  actions?: ReactNode;
  /** The fixed bottom bar, typically a `BottomNav`. */
  nav?: ReactNode;
  children?: ReactNode;
}

export function MobileShell({ site, title, actions, nav, children }: MobileShellProps): ReactNode {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: tokens.color.bg,
        color: tokens.color.text,
        fontFamily: tokens.font.sans,
      }}
    >
      <AppBar site={site} name={title} actions={actions} />
      <main
        style={{
          flex: 1,
          width: "100%",
          maxWidth: "480px",
          margin: "0 auto",
          padding: "20px 18px 96px",
        }}
      >
        {children}
      </main>
      {nav}
    </div>
  );
}

export interface BottomNavItem {
  href: string;
  label: string;
  /** 24×24 glyph, inherits `currentColor`. */
  icon?: ReactNode;
}

export interface BottomNavProps {
  site: SiteKey;
  items: BottomNavItem[];
  /** `href` of the active tab. */
  active?: string;
}

/** Fixed bottom tab bar — the active tab fills with the site accent. */
export function BottomNav({ site, items, active }: BottomNavProps): ReactNode {
  const theme = siteThemes[site];
  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        background: tokens.color.surface,
        borderTop: `${tokens.border.default} solid ${tokens.color.ink}`,
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        }}
      >
        {items.map((item, i) => {
          const on = item.href === active;
          return (
            <a
              key={item.href}
              href={item.href}
              aria-current={on ? "page" : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                padding: "9px 4px 11px",
                textDecoration: "none",
                color: tokens.color.ink,
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.02em",
                background: on ? theme.accent : "transparent",
                borderLeft:
                  i === 0 ? "none" : `${tokens.border.thin} solid ${tokens.color.ink}`,
              }}
            >
              <span style={{ display: "grid", placeItems: "center", width: "24px", height: "24px" }}>
                {item.icon}
              </span>
              {item.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
