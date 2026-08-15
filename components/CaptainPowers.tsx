"use client";

import { useState } from "react";
import { sounds } from "@/lib/sounds";
import type { Powerup, TeamPowerup, PowerupRequest } from "@/lib/types";

interface Props {
  teamId: string;
  teamScore: number;
  powerups: Powerup[];
  teamPowerups: TeamPowerup[];
  requests: PowerupRequest[];
}

/** لوحة قدرات القائد — لا تُنفَّذ أي قدرة من هنا، بل تُرسل طلبًا للمشرف. */
export function CaptainPowers({ teamId, teamScore, powerups, teamPowerups, requests }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mine = new Map(teamPowerups.filter((tp) => tp.team_id === teamId).map((tp) => [tp.powerup_id, tp]));
  const pending = new Set(requests.filter((r) => r.team_id === teamId).map((r) => r.powerup_id));

  async function request(powerup: Powerup) {
    setBusy(powerup.id);
    setMessage(null);

    const res = await fetch("/api/student/powerup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ powerup_id: powerup.id }),
    });
    const data = await res.json();

    setMessage(
      data.ok
        ? data.requires_approval
          ? "📨 أُرسل طلبك إلى المشرف"
          : "⚡ فُعّلت القدرة"
        : data.error
    );
    if (data.ok) sounds.unlock();
    setBusy(null);
  }

  const enabled = powerups.filter((p) => p.enabled);
  if (enabled.length === 0) return null;

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-bold text-[var(--color-muted)]">
        👑 قدرات الفريق
      </h2>

      <div className="flex flex-col gap-2">
        {enabled.map((p) => {
          const tp = mine.get(p.id);
          const unlocked = tp?.unlocked ?? false;
          const used = (tp?.uses_left ?? p.max_uses) <= 0;
          const armed = tp?.armed ?? false;
          const waiting = pending.has(p.id);
          const remaining = Math.max(0, p.unlock_points - teamScore);

          return (
            <button
              key={p.id}
              disabled={!unlocked || used || armed || waiting || busy === p.id}
              onClick={() => request(p)}
              className={`flex items-center gap-3 rounded-xl border p-3 text-right transition
                ${
                  armed
                    ? "border-[var(--color-gold)] bg-[var(--color-gold)]/10"
                    : unlocked && !used
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 active:scale-95"
                      : "border-[var(--color-line)] opacity-60"
                }`}
            >
              <span className="text-2xl">{p.icon}</span>
              <span className="flex-1">
                <span className="block font-bold">{p.name}</span>
                <span className="block text-xs text-[var(--color-muted)]">
                  {used
                    ? "تم استخدامها"
                    : armed
                      ? "مفعّلة — ستُطبَّق على السؤال القادم"
                      : waiting
                        ? "بانتظار موافقة المشرف"
                        : unlocked
                          ? p.description || "متاحة الآن"
                          : `تُفتح عند ${p.unlock_points} نقطة (باقٍ ${remaining})`}
                </span>
              </span>
              <span className="text-lg">{used ? "✅" : armed ? "⚡" : unlocked ? "🔓" : "🔒"}</span>
            </button>
          );
        })}
      </div>

      {message && <p className="mt-3 text-center text-sm font-bold">{message}</p>}
    </section>
  );
}
