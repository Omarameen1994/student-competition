"use client";

import { useEffect, useState } from "react";

interface Props {
  endsAt: string | null;
  offset?: number;
  paused?: boolean;
  size?: "sm" | "lg";
  onExpire?: () => void;
}

/** عدّاد تنازلي مضبوط على ساعة الخادم. */
export function Timer({ endsAt, offset = 0, paused = false, size = "lg", onExpire }: Props) {
  const [left, setLeft] = useState(0);
  const [fired, setFired] = useState(false);

  useEffect(() => {
    setFired(false);
  }, [endsAt]);

  useEffect(() => {
    if (!endsAt) {
      setLeft(0);
      return;
    }
    const end = new Date(endsAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, end - (Date.now() + offset));
      setLeft(remaining);
      if (remaining === 0 && !fired) {
        setFired(true);
        onExpire?.();
      }
    };

    tick();
    if (paused) return;
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt, offset, paused, fired, onExpire]);

  const secs = Math.ceil(left / 1000);
  const danger = secs <= 5 && secs > 0;
  const dim = size === "lg" ? "text-6xl" : "text-2xl";

  return (
    <div
      className={`${dim} font-black tabular-nums ${
        left === 0
          ? "text-[var(--color-muted)]"
          : danger
            ? "text-[var(--color-lose)]"
            : "text-[var(--color-gold)]"
      } ${danger ? "animate-pulse" : ""}`}
    >
      ⏱️ {secs < 10 ? `0${secs}` : secs}
    </div>
  );
}
