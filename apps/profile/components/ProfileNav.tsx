import type { ReactNode } from "react";

import { siteThemes, tokens } from "@attestant/ui";

const MENUS = [
  { href: "/credentials", label: "Credentials" },
  { href: "/jobs", label: "Jobs" },
  { href: "/wallet", label: "Wallet" },
] as const;

export type MenuKey = (typeof MENUS)[number]["href"];

/**
 * The console's three menus (feature list §3). Server-rendered: the active
 * menu is a prop from the page, not a client-side pathname hook.
 */
export function ProfileNav({ active }: { active?: MenuKey }): ReactNode {
  return (
    <nav style={{ display: "flex", gap: "8px", margin: "20px 0", flexWrap: "wrap" }}>
      <a href="/" className="neo-interactive" style={linkStyle(false)}>
        Home
      </a>
      {MENUS.map((menu) => (
        <a
          key={menu.href}
          href={menu.href}
          className="neo-interactive"
          style={linkStyle(menu.href === active)}
        >
          {menu.label}
        </a>
      ))}
    </nav>
  );
}

function linkStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    borderRadius: tokens.radius.md,
    fontWeight: 700,
    fontSize: "14px",
    textDecoration: "none",
    color: tokens.color.ink,
    background: isActive ? siteThemes.profile.accent : tokens.color.surface,
    border: `${tokens.border.default} solid ${tokens.color.ink}`,
    boxShadow: isActive ? tokens.shadow.sm : tokens.shadow.none,
  };
}
