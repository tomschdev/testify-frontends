"use client";

import { useEffect, useRef, useState } from "react";

export type BoundedPollStatus = "idle" | "pending" | "confirmed" | "timeout";

export interface BoundedPollOptions {
  /** Delay between checks. */
  intervalMs?: number;
  /**
   * Ceiling after which polling stops with "timeout". Mirror-node lag is real
   * (impl spec §6.4): the backend tests use 90–120s ceilings.
   */
  timeoutMs?: number;
}

/**
 * Bounded polling for propagation lag after writes: runs `check` every
 * `intervalMs` until it resolves true ("confirmed") or `timeoutMs` elapses
 * ("timeout"). Passing `null` disables polling ("idle"). A check that throws
 * counts as "not yet" — transient mirror errors must not end the poll early.
 *
 * The status is never an empty/success lie: callers render "pending" while
 * this hook is working, per impl spec §6.4.
 */
export function useBoundedPoll(
  check: (() => Promise<boolean>) | null,
  { intervalMs = 5_000, timeoutMs = 120_000 }: BoundedPollOptions = {},
): BoundedPollStatus {
  const [status, setStatus] = useState<BoundedPollStatus>(check ? "pending" : "idle");

  // Latest check without re-arming the effect on every render — callers pass
  // inline closures; only the null↔function transition restarts the poll.
  const checkRef = useRef(check);
  checkRef.current = check;

  const active = check !== null;

  useEffect(() => {
    if (!active) {
      setStatus("idle");
      return;
    }
    setStatus("pending");

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + timeoutMs;

    const tick = async (): Promise<void> => {
      const fn = checkRef.current;
      if (cancelled || !fn) return;
      let confirmed = false;
      try {
        confirmed = await fn();
      } catch {
        // Transient failure — treat as "not yet" and keep polling.
      }
      if (cancelled) return;
      if (confirmed) {
        setStatus("confirmed");
        return;
      }
      if (Date.now() >= deadline) {
        setStatus("timeout");
        return;
      }
      timer = setTimeout(() => void tick(), intervalMs);
    };

    void tick();

    return (): void => {
      cancelled = true;
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [active, intervalMs, timeoutMs]);

  return status;
}
