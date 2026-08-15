"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import type { Student, Team } from "@/lib/types";

const EMOJIS = ["🔴", "🔵", "🟢", "🟡", "🟣", "🟠", "⚫", "⚪"];

export function TeamsManager({
  competitionId,
  teams,
  students,
}: {
  competitionId: string;
  teams: Team[];
  students: Student[];
}) {
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);

  async function run(body: Record<string, unknown>, success: string) {
    const res = await api.teams(body);
    setNote(res.ok ? success : (res.error ?? "تعذّر التنفيذ"));
    if (res.ok) router.refresh();
  }

  return (
    <main className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() =>
            run({ action: "add", competition_id: competitionId, sort_order: teams.length }, "أُضيف الفريق")
          }
          className="btn bg-[var(--color-brand)] text-sm text-white"
        >
          ➕ فريق جديد
        </button>
        <button
          onClick={() => {
            if (confirm("تصفير نقاط جميع الفرق والطلاب؟"))
              run({ action: "reset_scores", competition_id: competitionId }, "صُفّرت النقاط");
          }}
          className="btn border border-[var(--color-lose)]/50 text-sm text-[var(--color-lose)]"
        >
          ♻️ تصفير النقاط
        </button>
      </div>

      {note && (
        <p className="mb-3 rounded-xl bg-[var(--color-ink-3)] p-2 text-center text-sm font-bold">{note}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => {
          const members = students.filter((s) => s.team_id === team.id);
          return (
            <section key={team.id} className="card p-4" style={{ borderColor: team.color }}>
              <div className="flex items-center gap-2">
                <select
                  value={team.emoji}
                  onChange={(e) => run({ action: "update", team_id: team.id, emoji: e.target.value }, "تم التعديل")}
                  className="input w-16 px-2 py-1.5 text-center"
                >
                  {EMOJIS.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>

                <input
                  defaultValue={team.name}
                  onBlur={(e) =>
                    e.target.value !== team.name &&
                    run({ action: "update", team_id: team.id, name: e.target.value }, "تم التعديل")
                  }
                  className="input flex-1 py-1.5 font-bold"
                />

                <input
                  type="color"
                  defaultValue={team.color}
                  onBlur={(e) => run({ action: "update", team_id: team.id, color: e.target.value }, "تم التعديل")}
                  className="size-9 shrink-0 rounded-lg border border-[var(--color-line)] bg-transparent"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-[var(--color-muted)]">
                  {members.length} عضوًا · القائد:{" "}
                  {members.find((m) => m.is_captain)?.name ?? "غير محدد"}
                </span>
                <span className="text-xl font-black" style={{ color: team.color }}>
                  {team.score}
                </span>
              </div>

              <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
                {members.map((m) => (
                  <li key={m.id} className="rounded-lg bg-[var(--color-ink)] px-2 py-1">
                    {m.name} {m.is_captain && "👑"}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => {
                  if (confirm(`حذف ${team.name}؟`)) run({ action: "delete", team_id: team.id }, "حُذف الفريق");
                }}
                className="mt-3 text-xs text-[var(--color-lose)]"
              >
                🗑️ حذف الفريق
              </button>
            </section>
          );
        })}
      </div>
    </main>
  );
}
