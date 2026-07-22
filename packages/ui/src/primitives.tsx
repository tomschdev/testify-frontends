import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

import { tokens } from "./tokens";

/**
 * Form-control base style shared by Input, Select and Button: white fill, a
 * hard ink border, one soft radius. This is the neo-brutalist replacement for
 * the `inputStyle` object that was duplicated per app — one definition, three
 * consoles, visibly one product.
 */
export const controlStyle: CSSProperties = {
  background: tokens.color.surface,
  border: `${tokens.border.default} solid ${tokens.color.ink}`,
  borderRadius: tokens.radius.md,
  padding: "9px 12px",
  color: tokens.color.text,
  font: "inherit",
  fontWeight: 600,
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ style, className, ...rest }: InputProps): ReactNode {
  return (
    <input
      className={["neo-input", className].filter(Boolean).join(" ")}
      style={{ ...controlStyle, ...style }}
      {...rest}
    />
  );
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ style, className, children, ...rest }: SelectProps): ReactNode {
  return (
    <select
      className={["neo-input", className].filter(Boolean).join(" ")}
      style={{ ...controlStyle, ...style }}
      {...rest}
    >
      {children}
    </select>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shows this label instead of children while truthy, and disables the button. */
  busy?: boolean;
  busyLabel?: string;
  /** Fill colour — pass a site accent or a Neo bright for the primary action. */
  tone?: string;
}

export function Button({
  busy = false,
  busyLabel,
  disabled,
  style,
  className,
  children,
  tone,
  type = "button",
  ...rest
}: ButtonProps): ReactNode {
  const inactive = disabled || busy;
  return (
    <button
      type={type}
      disabled={inactive}
      className={["neo-interactive", className].filter(Boolean).join(" ")}
      style={{
        ...controlStyle,
        background: tone ?? tokens.color.surface,
        boxShadow: inactive ? tokens.shadow.none : tokens.shadow.sm,
        cursor: inactive ? "default" : "pointer",
        opacity: inactive ? 0.5 : 1,
        fontWeight: 700,
        ...style,
      }}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export interface CardProps {
  /** Border colour; defaults to ink. Pass a site accent for a branded card. */
  borderColor?: string;
  /** Render as a list item inside <ul> lists. */
  as?: "div" | "li" | "section";
  /** Hard drop-shadow depth; `"none"` for flat cards inside already-raised UI. */
  elevation?: "none" | "sm" | "md" | "lg";
  style?: CSSProperties;
  children?: ReactNode;
}

export function Card({
  borderColor = tokens.color.ink,
  as: Tag = "div",
  elevation = "sm",
  style,
  children,
}: CardProps): ReactNode {
  return (
    <Tag
      style={{
        background: tokens.color.surface,
        border: `${tokens.border.default} solid ${borderColor}`,
        borderRadius: tokens.radius.md,
        boxShadow: tokens.shadow[elevation],
        padding: "14px 16px",
        display: "grid",
        gap: "8px",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

export interface SectionHeaderProps {
  children?: ReactNode;
}

export function SectionHeader({ children }: SectionHeaderProps): ReactNode {
  return (
    <h2
      style={{
        fontSize: "13px",
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        margin: "0 0 12px",
        color: tokens.color.text,
      }}
    >
      {children}
    </h2>
  );
}

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

// Bright fills so the black label stays legible — the neo chip idiom. These
// are the tints of the semantic status colours, not the (darker) text ones.
const badgeToneColor: Record<BadgeTone, string> = {
  neutral: tokens.color.surface, // white
  success: tokens.palette.tertiary, // mint
  warning: tokens.palette.secondary, // yellow
  danger: tokens.color.danger, // coral
  info: tokens.palette.primary, // sky blue
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Overrides the tone fill, e.g. `siteThemes.issuer.accent` for site chips. */
  color?: string;
  children?: ReactNode;
}

/**
 * Small chip for roles, credential types and pending/confirmed states. Neo
 * style: bright fill, ink border + tiny hard shadow, black uppercase label.
 */
export function Badge({ tone = "neutral", color, children }: BadgeProps): ReactNode {
  const fill = color ?? badgeToneColor[tone];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "11px",
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: tokens.color.ink,
        background: fill,
        border: `${tokens.border.thin} solid ${tokens.color.ink}`,
        boxShadow: tokens.shadow.sm,
        borderRadius: tokens.radius.sm,
        padding: "2px 8px",
        verticalAlign: "middle",
      }}
    >
      {children}
    </span>
  );
}

export interface ToggleProps {
  checked: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name; also rendered next to the switch when provided. */
  label?: string;
}

export function Toggle({ checked, onChange, disabled = false, label }: ToggleProps): ReactNode {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontSize: "13px",
        fontWeight: 600,
      }}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        style={{
          width: "40px",
          height: "24px",
          borderRadius: tokens.radius.sm,
          border: `${tokens.border.default} solid ${tokens.color.ink}`,
          background: checked ? tokens.palette.tertiary : tokens.color.surface,
          position: "relative",
          padding: 0,
          cursor: "inherit",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "1px",
            left: checked ? "18px" : "1px",
            width: "18px",
            height: "18px",
            borderRadius: "4px",
            background: tokens.color.ink,
            transition: "left 120ms ease",
          }}
        />
      </button>
      {label}
    </label>
  );
}
