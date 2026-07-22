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
      <a href="/" style={linkStyle(false)}>
        Home
      </a>
      {MENUS.map((menu) => (
        <a key={menu.href} href={menu.href} style={linkStyle(menu.href === active)}>
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
    fontWeight: 600,
    fontSize: "14px",
    textDecoration: "none",
    color: isActive ? siteThemes.profile.accent : tokens.color.textMuted,
    background: isActive ? siteThemes.profile.accentSoft : "transparent",
    border: `1px solid ${isActive ? "transparent" : tokens.color.border}`,
  };
}
