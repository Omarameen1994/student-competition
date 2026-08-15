"use client";

import { useEffect, useState } from "react";

/**
 * يقيس فارق ساعة الجهاز عن ساعة الخادم مرة واحدة عند التحميل،
 * فيعرض كل الطلاب نفس العد التنازلي مهما اختلفت ساعاتهم (القسم 49).
 */
export function useServerClock(): { offset: number; ready: boolean } {
  const [offset, setOffset] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // ثلاث قياسات، نأخذ أقلها زمن ذهاب وإياب
      let best = Number.POSITIVE_INFINITY;
      let bestOffset = 0;

      for (let i = 0; i < 3; i++) {
        const t0 = Date.now();
        try {
          const res = await fetch("/api/time", { cache: "no-store" });
          const { now } = (await res.json()) as { now: number };
          const t1 = Date.now();
          const rtt = t1 - t0;
          if (rtt < best) {
            best = rtt;
            bestOffset = now + rtt / 2 - t1;
          }
        } catch {
          break;
        }
      }

      if (!cancelled) {
        setOffset(Number.isFinite(best) ? bestOffset : 0);
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { offset, ready };
}
