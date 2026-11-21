"use client";

import { useEffect, useRef, useState } from "react";

const secondsUntil = (deadline: string) => Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 1000));

/**
 * Seconds left until `deadline` (ISO string), ticking each second; calls `onExpire` once at zero.
 * Starts as null until mounted, so server and client render the same text.
 */
export function useCountdown(deadline: string | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!deadline) {
      setRemaining(null);
      return;
    }
    const tick = () => {
      const left = secondsUntil(deadline);
      setRemaining(left);
      if (left === 0) {
        window.clearInterval(timer);
        onExpireRef.current();
      }
    };
    const timer = window.setInterval(tick, 1000);
    tick();
    return () => window.clearInterval(timer);
  }, [deadline]);

  const label =
    remaining == null ? "–:––" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;
  return { remaining, label };
}
