import type { ReactNode } from "react";

import { BottomNav, MobileShell, tokens, type BottomNavItem } from "@attestant/ui";

/**
 * The Profile console is a phone-shaped app: a title bar, one scrolling panel,
 * and a fixed bottom tab bar (Home / Jobs / Wallet). Each menu is its own
 * route; the bottom bar switches between them and marks the active one. Home
 * carries both the account record and the credentials the user holds.
 */

const iconProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.1,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const HomeIcon = (
  <svg {...iconProps} aria-hidden="true">
    <path d="M4 11 12 4l8 7" />
    <path d="M6 10v9h12v-9" />
  </svg>
);

const JobsIcon = (
  <svg {...iconProps} aria-hidden="true">
    <rect x="3" y="7" width="18" height="13" rx="1.5" />
    <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2" />
  </svg>
);

const WalletIcon = (
  <svg {...iconProps} aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="1.5" />
    <path d="M3 10h18" />
    <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const NAV_ITEMS: BottomNavItem[] = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/jobs", label: "Jobs", icon: JobsIcon },
  { href: "/wallet", label: "Wallet", icon: WalletIcon },
];

const authActionStyle = {
  display: "inline-block",
  padding: "6px 12px",
  borderRadius: tokens.radius.md,
  background: tokens.color.surface,
  color: tokens.color.ink,
  border: `${tokens.border.default} solid ${tokens.color.ink}`,
  boxShadow: tokens.shadow.sm,
  fontWeight: 700,
  fontSize: "12px",
  textDecoration: "none",
} as const;

/** Top-bar sign in / sign out control. */
export function AuthAction({ hasSession }: { hasSession: boolean }): ReactNode {
  return hasSession ? (
    <a href="/auth/signout" className="neo-interactive" style={authActionStyle}>
      Sign out
    </a>
  ) : (
    <a href="/auth/signin" className="neo-interactive" style={authActionStyle}>
      Sign in
    </a>
  );
}

export interface ProfileShellProps {
  /** `href` of the active tab. */
  active: string;
  /** Top-bar title. */
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function ProfileShell({ active, title, actions, children }: ProfileShellProps): ReactNode {
  return (
    <MobileShell
      site="profile"
      title={title}
      actions={actions}
      nav={<BottomNav site="profile" items={NAV_ITEMS} active={active} />}
    >
      {children}
    </MobileShell>
  );
}
