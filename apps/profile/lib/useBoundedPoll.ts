"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// TODO(shared): swap for the shared bounded-poll hook from @attestant/ui once
// it exists (impl spec §6.4 says every console needs one) — this is a minimal
// in-app version, kept here to avoid publishing a conflicting shared primitive
// while the other console sprints are in flight.

export interface BoundedPoll {
  /** True while a bounded polling window is running. */
  polling: boolean;
  /** Start (or restart) the polling window: fires `onTick` immediately, then every `intervalMs` until `timeoutMs` has elapsed. */
  start: () => void;
  /** Stop the window early, e.g. when the awaited data has arrived. */
  stop: () => void;
}

/**
 * Bounded polling for mirror-node lag (impl spec §6.4): after a live issuance
 * the mirror trails consensus by a few seconds, so a read straight after a
 * write must re-poll with a ceiling rather than trust the first empty answer.
 */
export function useBoundedPoll(
  onTick: () => void,
  intervalMs = 10_000,
  timeoutMs = 120_000,
): BoundedPoll {
  const [polling, setPolling] = useState(false);
  const timers = useRef<{ interval?: ReturnType<typeof setInterval>; timeout?: ReturnType<typeof setTimeout> }>({});
  const tick = useRef(onTick);
  tick.current = onTick;

  const stop = useCallback((): void => {
    clearInterval(timers.current.interval);
    clearTimeout(timers.current.timeout);
    timers.current = {};
    setPolling(false);
  }, []);

  const start = useCallback((): void => {
    stop();
    setPolling(true);
    tick.current();
    timers.current.interval = setInterval(() => tick.current(), intervalMs);
    timers.current.timeout = setTimeout(stop, timeoutMs);
  }, [intervalMs, timeoutMs, stop]);

  useEffect(() => stop, [stop]);

  return { polling, start, stop };
}
