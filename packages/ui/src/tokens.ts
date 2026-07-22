export interface SiteTheme {
  /** Accent colour distinguishing this site within the shared product identity. */
  accent: string;
  /** Soft tint of the accent, for large fills where the full accent is too loud. */
  accentSoft: string;
}

/**
 * Neo-brutalism design tokens — the single source of truth for all three
 * consoles. Ported from the `learn` Flutter app's `Neo` palette + `AppTheme`
 * (light scheme): sky-blue / yellow / mint / coral on a warm off-white ground,
 * with hard black borders and hard (zero-blur) drop shadows.
 *
 * Defining traits, so consumers stay on-system:
 *  - `color.ink` (#000) draws every border AND every shadow — one colour.
 *  - Shadows are offset, zero-blur (`shadow.*`); never soft/blurred.
 *  - Corners are a single soft radius (8px) everywhere.
 *  - Type is Inter, heavy (600/700/800) for anything structural.
 */
export const tokens = {
  color: {
    /** Warm off-white page ground (Neo.background). */
    bg: "#FFFDF5",
    /** Card / control fill (Neo.surface). */
    surface: "#FFFFFF",
    /** Ink — borders, shadows, primary text. THE structural colour. */
    ink: "#000000",
    /** Alias of `ink`; kept so existing `tokens.color.border` sites re-skin. */
    border: "#000000",
    /** Primary text (== ink). */
    text: "#000000",
    /** Muted text / secondary labels (Neo.inkMuted, 70% black). */
    textMuted: "rgba(0, 0, 0, 0.7)",
    // Status colours — chosen to read on the white surface. Shared by Badge,
    // ErrorState and per-app status labels (previously duplicated as hex).
    success: "#2E7D32",
    warning: "#F57C00",
    danger: "#FF6B6B", // Neo coral (error)
    info: "#6FB6E8", // Neo primary (sky blue)
  },
  /**
   * Bright brand palette — category chips, avatar fallbacks, accents. The full
   * Neo rainbow; prefer these over inlining new brights.
   */
  palette: {
    primary: "#6FB6E8", // sky blue
    secondary: "#FFD23F", // bold yellow
    tertiary: "#A8E6CF", // mint
    error: "#FF6B6B", // coral
    skyBlue: "#7EC8E3",
    peach: "#FFB347",
  },
  font: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'SF Mono', 'Fira Code', ui-monospace, monospace",
  },
  /** Neo unifies every corner to one soft radius; the three keys are aliases. */
  radius: {
    sm: "8px",
    md: "8px",
    lg: "8px",
  },
  /** Border widths — thin (chips), default (cards/controls), thick (hero/dialogs). */
  border: {
    thin: "1.5px",
    default: "2px",
    thick: "3px",
  },
  /**
   * Hard drop shadows: zero blur, bottom-right offset, drawn in ink. Ready to
   * drop into `boxShadow`. This IS the neo-brutalist depth cue — do not blur.
   */
  shadow: {
    sm: "2px 2px 0 0 #000000",
    md: "4px 4px 0 0 #000000",
    lg: "6px 6px 0 0 #000000",
    xl: "10px 10px 0 0 #000000",
    none: "0 0 0 0 #000000",
  },
  /** 4/8/12/16/24/32/48 spacing grid (Neo / MD3). */
  space: {
    xs: "4px",
    sm: "8px",
    xm: "12px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    xxl: "48px",
  },
  maxWidth: "640px",
} as const;

/**
 * Per-site accent, drawn from the Neo palette so the three consoles read as
 * siblings under one shell — mint / sky-blue / coral. `accentSoft` is a ~30%
 * tint for large fills.
 */
export const siteThemes = {
  profile: { accent: "#A8E6CF", accentSoft: "rgba(168, 230, 207, 0.35)" }, // mint
  issuer: { accent: "#6FB6E8", accentSoft: "rgba(111, 182, 232, 0.35)" }, // sky blue
  positions: { accent: "#FF6B6B", accentSoft: "rgba(255, 107, 107, 0.30)" }, // coral
} satisfies Record<string, SiteTheme>;

export type SiteKey = keyof typeof siteThemes;
