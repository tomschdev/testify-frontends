"use client";

import { tokens } from "@attestant/ui";

// TODO(shared): swap these for Badge / Toggle from @attestant/ui once the
// issuer sprint lands the shared primitives — minimal in-app stand-ins only,
// styled off the shared tokens so the swap is visual no-op. Do not grow
// competing versions here.

export function Badge({
  children,
  color = tokens.color.info,
}: {
  children: React.ReactNode;
  color?: string;
}): React.ReactNode {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        color,
        border: `1px solid ${color}`,
        opacity: 0.9,
      }}
    >
      {children}
    </span>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}): React.ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{
        width: "34px",
        height: "18px",
        borderRadius: "999px",
        border: `1px solid ${checked ? tokens.color.success : tokens.color.border}`,
        background: checked ? "rgba(134, 239, 172, 0.25)" : "rgba(255, 255, 255, 0.04)",
        position: "relative",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "2px",
          left: checked ? "18px" : "2px",
          width: "12px",
          height: "12px",
          borderRadius: "50%",
          background: checked ? tokens.color.success : tokens.color.textMuted,
          transition: "left 120ms ease",
        }}
      />
    </button>
  );
}
