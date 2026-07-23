"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { tokens } from "./tokens";

export interface InfoTooltipProps {
  /** Visible text beside the icon. Omit for a bare icon. */
  label?: string;
  /** Accessible name for the trigger when there is no `label`. */
  ariaLabel?: string;
  /** Floating panel contents. */
  children?: ReactNode;
  /** Panel width in px. */
  width?: number;
}

const GAP = 8;
/** Grace period so the pointer can travel from icon to panel without closing. */
const CLOSE_DELAY_MS = 140;

/**
 * An ⓘ trigger with a floating panel of complementary detail.
 *
 * Opens on hover, focus and click. Hover alone would strand keyboard and touch
 * users, and the panel holds interactive content (copy buttons, HashScan
 * links) they have to be able to reach — so the click/focus paths are not
 * optional extras.
 *
 * The panel renders in a portal because every console card is a `Panel`, and
 * `Panel` sets `overflow: hidden` — an in-flow absolute panel would be clipped
 * by its own card.
 */
export function InfoTooltip({
  label,
  ariaLabel = "More information",
  children,
  width = 320,
}: InfoTooltipProps): ReactNode {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const panelId = useId();

  const cancelClose = useCallback((): void => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const openPanel = useCallback((): void => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);

  const closePanel = useCallback((): void => {
    cancelClose();
    setOpen(false);
  }, [cancelClose]);

  const closeAfterDelay = useCallback((): void => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  }, [cancelClose]);

  const updatePosition = useCallback((): void => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (anchor === undefined) return;

    // The panel is unmeasurable on the first pass (it has not rendered yet);
    // fall back to the declared width and let the layout effect correct it.
    const panel = panelRef.current?.getBoundingClientRect();
    const panelWidth = panel?.width ?? width;
    const panelHeight = panel?.height ?? 0;

    const left = Math.max(
      GAP,
      Math.min(anchor.left, window.innerWidth - panelWidth - GAP),
    );

    let top = anchor.bottom + GAP;
    if (panelHeight > 0 && top + panelHeight > window.innerHeight - GAP) {
      const above = anchor.top - GAP - panelHeight;
      if (above > GAP) top = above;
    }

    // Bail out when nothing moved — this runs inside a layout effect, and a
    // fresh object every pass would re-render forever.
    setPos((prev) => (prev !== null && prev.top === top && prev.left === left ? prev : { top, left }));
  }, [width]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  });

  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === "Escape") closePanel();
    }
    function onPointerDown(e: PointerEvent): void {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target) === true) return;
      if (panelRef.current?.contains(target) === true) return;
      closePanel();
    }
    function onReflow(): void {
      updatePosition();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);
    // `true` so the panel tracks anchors inside scrollable cards, not just the
    // page scroller.
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open, closePanel, updatePosition]);

  useEffect(() => cancelClose, [cancelClose]);

  return (
    <span
      ref={anchorRef}
      onMouseEnter={openPanel}
      onMouseLeave={closeAfterDelay}
      style={{ display: "inline-flex", alignItems: "center", gap: "5px", maxWidth: "100%" }}
    >
      {label !== undefined && <span style={labelStyle}>{label}</span>}
      <button
        type="button"
        aria-label={label === undefined ? ariaLabel : `${label} — details`}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? closePanel() : openPanel())}
        onFocus={openPanel}
        onBlur={closeAfterDelay}
        style={iconStyle}
      >
        i
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="tooltip"
            onMouseEnter={cancelClose}
            onMouseLeave={closeAfterDelay}
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              left: pos?.left ?? -9999,
              width: `${width}px`,
              maxWidth: "calc(100vw - 16px)",
              zIndex: 60,
              display: "grid",
              gap: "6px",
              padding: "10px 12px",
              background: tokens.color.surface,
              color: tokens.color.text,
              border: `${tokens.border.default} solid ${tokens.color.ink}`,
              borderRadius: tokens.radius.md,
              boxShadow: tokens.shadow.md,
              fontFamily: tokens.font.sans,
              fontSize: "12px",
              // Hidden until placed, so it never flashes at the fallback
              // offscreen coordinates.
              visibility: pos === null ? "hidden" : "visible",
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
}

const labelStyle = {
  opacity: 0.55,
  fontFamily: tokens.font.sans,
  fontSize: "12px",
} as const;

const iconStyle = {
  flex: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "15px",
  height: "15px",
  padding: 0,
  background: tokens.color.surface,
  border: `${tokens.border.thin} solid ${tokens.color.ink}`,
  borderRadius: "50%",
  color: tokens.color.ink,
  font: "inherit",
  fontFamily: tokens.font.sans,
  fontSize: "10px",
  fontWeight: 700,
  lineHeight: 1,
  cursor: "pointer",
} as const;
