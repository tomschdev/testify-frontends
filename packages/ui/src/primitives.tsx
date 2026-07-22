import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

import { tokens } from "./tokens";

/**
 * Form-control base style shared by Input, Select and Button. This is the
 * inline `inputStyle` object that was previously duplicated per app
 * (Organisations.tsx, CreatePosition.tsx) — one definition, three consoles,
 * visibly one product.
 */
export const controlStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.04)",
  border: `1px solid ${tokens.color.border}`,
  borderRadius: "8px",
  padding: "9px 11px",
  color: "inherit",
  font: "inherit",
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ style, ...rest }: InputProps): ReactNode {
  return <input style={{ ...controlStyle, ...style }} {...rest} />;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ style, children, ...rest }: SelectProps): ReactNode {
  return (
    <select style={{ ...controlStyle, ...style }} {...rest}>
      {children}
    </select>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Shows this label instead of children while truthy, and disables the button. */
  busy?: boolean;
  busyLabel?: string;
}

export function Button({
  busy = false,
  busyLabel,
  disabled,
  style,
  children,
  type = "button",
  ...rest
}: ButtonProps): ReactNode {
  const inactive = disabled || busy;
  return (
    <button
      type={type}
      disabled={inactive}
      style={{
        ...controlStyle,
        cursor: inactive ? "default" : "pointer",
        opacity: inactive ? 0.5 : 1,
        fontWeight: 600,
        ...style,
      }}
      {...rest}
    >
      {busy && busyLabel ? busyLabel : children}
    </button>
  );
}

export interface CardProps {
  /** Border colour, typically `siteThemes.<site>.accentSoft`-adjacent rgba. */
  borderColor?: string;
  /** Render as a list item inside <ul> lists. */
  as?: "div" | "li" | "section";
  style?: CSSProperties;
  children?: ReactNode;
}

export function Card({
  borderColor = tokens.color.border,
  as: Tag = "div",
  style,
  children,
}: CardProps): ReactNode {
  return (
    <Tag
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: tokens.radius.md,
        padding: "12px 14px",
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
    <h2 style={{ fontSize: "15px", margin: "0 0 10px", opacity: 0.75 }}>{children}</h2>
  );
}

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

const badgeToneColor: Record<BadgeTone, string> = {
  neutral: tokens.color.textMuted,
  success: tokens.color.success,
  warning: tokens.color.warning,
  danger: tokens.color.danger,
  info: tokens.color.info,
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Overrides the tone colour, e.g. `siteThemes.issuer.accent` for site-branded chips. */
  color?: string;
  children?: ReactNode;
}

/** Small chip for roles, credential types and pending/confirmed states. */
export function Badge({ tone = "neutral", color, children }: BadgeProps): ReactNode {
  const c = color ?? badgeToneColor[tone];
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: c,
        background: "rgba(255, 255, 255, 0.06)",
        border: `1px solid ${c}40`,
        borderRadius: "999px",
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
          width: "34px",
          height: "20px",
          borderRadius: "999px",
          border: `1px solid ${tokens.color.border}`,
          background: checked ? tokens.color.success : "rgba(255, 255, 255, 0.06)",
          position: "relative",
          padding: 0,
          cursor: "inherit",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "2px",
            left: checked ? "16px" : "2px",
            width: "14px",
            height: "14px",
            borderRadius: "50%",
            background: tokens.color.text,
            transition: "left 120ms ease",
          }}
        />
      </button>
      {label}
    </label>
  );
}
