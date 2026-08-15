"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import type { Powerup, Team, TeamPowerup } from "@/lib/types";

export function PowerupsManager({
  competitionId,
  powerups,
  teams,
  teamPowerups,
}: {
  competitionId: string;
  powerups: Powerup[];
  teams: Team[];
  teamPowerups: TeamPowerup[];
}) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);

  async function run(body: Record<string, unknown>, success = "تم الحفظ") {
    const res = await api.powerups({ competition_id: competitionId, ...body });
    setNote(res.ok ? success : (res.error ?? "تعذّر التنفيذ"));
    if (res.ok) router.refresh();
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => run({ action: "add", name: "قدرة جديدة", key: `custom_${Date.now()}` }, "أُضيفت القدرة")}
          className="btn bg-[var(--color-brand)] text-sm text-white"
        >
          ➕ قدرة جديدة
        </button>
        <button
          onClick={() => run({ action: "sync" }, "تمت المزامنة")}
          className="btn border border-[var(--color-line)] text-sm"
        >
          🔄 مزامنة الفرق
        </button>
      </div>

      {note && (
        <p className="mb-3 rounded-xl bg-[var(--color-ink-3)] p-2 text-center text-sm font-bold">{note}</p>
      )}

      <div className="flex flex-col gap-4">
        {powerups.map((p) => (
          <section key={p.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-3">
              <input
                defaultValue={p.icon}
                onBlur={(e) => e.target.value !== p.icon && run({ action: "update", powerup_id: p.id, icon: e.target.value })}
                className="input w-16 py-1.5 text-center text-xl"
              />
              <input
                defaultValue={p.name}
                onBlur={(e) => e.target.value !== p.name && run({ action: "update", powerup_id: p.id, name: e.target.value })}
                className="input max-w-48 py-1.5 font-bold"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  defaultChecked={p.enabled}
                  onChange={(e) => run({ action: "update", powerup_id: p.id, enabled: e.target.checked })}
                  className="size-4 accent-[var(--color-win)]"
                />
                مفعّلة
              </label>
              <button
                onClick={() => {
                  if (confirm(`حذف ${p.name}؟`)) run({ action: "delete", powerup_id: p.id }, "حُذفت");
                }}
                className="mr-auto text-xs text-[var(--color-lose)]"
              >
                🗑️ حذف
              </button>
            </div>

            <input
              defaultValue={p.description}
              onBlur={(e) => e.target.value !== p.description && run({ action: "update", powerup_id: p.id, description: e.target.value })}
              placeholder="الوصف"
              className="input mt-3 py-1.5 text-sm"
            />

            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <div>
                <label className="label">تُفتح عند</label>
                <input
                  type="number"
                  defaultValue={p.unlock_points}
                  onBlur={(e) => run({ action: "update", powerup_id: p.id, unlock_points: Number(e.target.value) })}
                  className="input py-1.5"
                />
              </div>
              <div>
                <label className="label">عدد الاستخدامات</label>
                <input
                  type="number"
                  defaultValue={p.max_uses}
                  onBlur={(e) => run({ action: "update", powerup_id: p.id, max_uses: Number(e.target.value) })}
                  className="input py-1.5"
                />
              </div>
              <div>
                <label className="label">تحتاج موافقة</label>
                <select
                  defaultValue={p.requires_approval ? "yes" : "no"}
                  onChange={(e) => run({ action: "update", powerup_id: p.id, requires_approval: e.target.value === "yes" })}
                  className="input py-1.5"
                >
                  <option value="yes">نعم</option>
                  <option value="no">لا</option>
                </select>
              </div>
              <div>
                <label className="label">تُطبَّق على</label>
                <select
                  defaultValue={p.applies_to}
                  onChange={(e) => run({ action: "update", powerup_id: p.id, applies_to: e.target.value })}
                  className="input py-1.5"
                >
                  <option value="next">السؤال القادم</option>
                  <option value="current">السؤال الحالي</option>
                </select>
              </div>
            </div>

            {/* حالة كل فريق */}
            <div className="mt-3 flex flex-wrap gap-2">
              {teams.map((t) => {
                const tp = teamPowerups.find((x) => x.team_id === t.id && x.powerup_id === p.id);
                return (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 rounded-xl bg-[var(--color-ink)] px-3 py-1.5 text-xs"
                  >
                    <span>{t.emoji} {t.name}</span>
                    <span>{tp?.armed ? "⚡" : tp?.unlocked ? "🔓" : "🔒"}</span>
                    <span className="text-[var(--color-muted)]">متبقٍ {tp?.uses_left ?? 0}</span>
                    <button
                      onClick={() =>
                        run(
                          { action: "set_team_powerup", team_id: t.id, powerup_id: p.id, unlocked: !(tp?.unlocked ?? false) },
                          "تم التبديل"
                        )
                      }
                      className="rounded-md border border-[var(--color-line)] px-2 py-0.5"
                    >
                      {tp?.unlocked ? "إغلاق" : "فتح"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
