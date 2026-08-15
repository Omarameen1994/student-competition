"use client";

import { useState } from "react";
import { sounds } from "@/lib/sounds";

interface Props {
  sessionId: string | null;
  open: boolean;
  /** نتيجة ضغطتي أنا في هذه الجلسة، إن وُجدت */
  myState: "idle" | "sent" | "won" | "blocked";
  onResult: (result: { ok: boolean; error?: string; reaction_ms?: number; buzz_id?: string }) => void;
}

/**
 * الزر الأكبر في صفحة الطالب.
 * لا يحسب شيئًا محليًا: يرسل الطلب، والخادم وحده يقرر أول ضاغط.
 */
export function Buzzer({ sessionId, open, myState, onResult }: Props) {
  const [busy, setBusy] = useState(false);

  const disabled = !open || !sessionId || busy || myState !== "idle";

  async function press() {
    if (disabled) return;
    setBusy(true);
    sounds.buzz();
    if (navigator.vibrate) navigator.vibrate(40);

    try {
      const res = await fetch("/api/student/buzz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      });
      onResult(await res.json());
    } catch {
      onResult({ ok: false, error: "تعذّر الاتصال. حاول مجددًا" });
    } finally {
      setBusy(false);
    }
  }

  const label =
    myState === "won"
      ? "أنت الأسرع! 🎉"
      : myState === "blocked"
        ? "أجبت على هذا السؤال"
        : myState === "sent"
          ? "بانتظار الحكم…"
          : open
            ? "اضغط أولًا!"
            : "انتظر بدء السؤال";

  return (
    <button
      onPointerDown={press}
      disabled={disabled}
      aria-label="زر الضغط السريع"
      className={`no-select relative flex aspect-square w-full max-w-[19rem] flex-col items-center
                  justify-center gap-2 rounded-full text-3xl font-black transition
                  ${
                    open && myState === "idle"
                      ? "buzzer-live bg-gradient-to-b from-red-500 to-red-700 text-white active:scale-90"
                      : "bg-[var(--color-ink-3)] text-[var(--color-muted)]"
                  }`}
    >
      <span className="text-6xl">🔔</span>
      <span className="px-4 text-center text-xl leading-tight">{label}</span>
    </button>
  );
}
