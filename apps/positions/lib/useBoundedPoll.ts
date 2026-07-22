"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// TODO(shared): swap for the bounded-poll hook from @attestant/ui once the
// issuer sprint lands it there — this is the minimal in-app version, kept
// deliberately small so the swap is mechanical. Do not grow it here.

export interface BoundedPollOptions {
  /** Milliseconds between attempts. */
  intervalMs: number;
  /**
   * Give-up ceiling. Mirror-node reads trail consensus by a few seconds
   * (impl spec §6.4 — backend tests use 90–120s ceilings).
   */
  timeoutMs: number;
}

export type BoundedPollState = "idle" | "pending" | "settled" | "timed-out";

/**
 * Repeatedly runs `attempt` until it reports done or the ceiling passes.
 * Screens that read straight after a write show `pending` — not an empty
 * state, and not a stale cached answer.
 */
export function useBoundedPoll(
  attempt: () => Promise<boolean>,
  { intervalMs, timeoutMs }: BoundedPollOptions,
): { state: BoundedPollState; start: () => void } {
  const [state, setState] = useState<BoundedPollState>("idle");
  const attemptRef = useRef(attempt);
  attemptRef.current = attempt;
  const runIdRef = useRef(0);

  const start = useCallback((): void => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    const deadline = Date.now() + timeoutMs;
    setState("pending");

    const tick = async (): Promise<void> => {
      if (runId !== runIdRef.current) {
        return; // superseded by a newer start() or unmount
      }
      let done = false;
      try {
        done = await attemptRef.current();
      } catch {
        // Treat a failed attempt like "not yet" — the ceiling bounds retries.
      }
      if (runId !== runIdRef.current) {
        return;
      }
      if (done) {
        setState("settled");
      } else if (Date.now() >= deadline) {
        setState("timed-out");
      } else {
        setTimeout(() => void tick(), intervalMs);
      }
    };
    void tick();
  }, [intervalMs, timeoutMs]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1; // cancel any in-flight run on unmount
    };
  }, []);

  return { state, start };
}
