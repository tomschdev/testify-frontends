export interface SiteTheme {
  /** Accent colour distinguishing this site within the shared product identity. */
  accent: string;
  accentSoft: string;
}

export const tokens = {
  color: {
    bg: "#0b0d12",
    surface: "#131722",
    border: "#232a3a",
    text: "#e8ebf2",
    textMuted: "#8b93a7",
    // Status colours shared by Badge, ErrorState and the per-app status
    // labels (previously duplicated as hex literals in each app).
    success: "#86efac",
    warning: "#fcd34d",
    danger: "#fca5a5",
    info: "#93c5fd",
  },
  font: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'SF Mono', 'Fira Code', ui-monospace, monospace",
  },
  radius: {
    md: "10px",
    lg: "16px",
  },
  maxWidth: "640px",
} as const;

export const siteThemes = {
  profile: { accent: "#5eead4", accentSoft: "rgba(94, 234, 212, 0.12)" },
  issuer: { accent: "#a5b4fc", accentSoft: "rgba(165, 180, 252, 0.12)" },
  positions: { accent: "#fca5a5", accentSoft: "rgba(252, 165, 165, 0.12)" },
} satisfies Record<string, SiteTheme>;

export type SiteKey = keyof typeof siteThemes;
