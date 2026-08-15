"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { BracketView } from "@/components/BracketView";
import type { Competition, Match, Student, Team } from "@/lib/types";

export function KnockoutManager({
  competition,
  teams,
  students,
}: {
  competition: Competition;
  teams: Team[];
  students: Student[];
}) {
  const router = useRouter();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [seeding, setSeeding] = useState(competition.settings.knockout_seeding);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const members = students.filter((s) => s.team_id === teamId && s.active);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    const res = await api.knockout(body);
    setNote(res.ok ? success : (res.error ?? "تعذّر التنفيذ"));
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function decide(match: Match, winnerId: string) {
    const name = students.find((s) => s.id === winnerId)?.name;
    if (!confirm(`اعتماد فوز ${name}؟`)) return;
    await run({ action: "decide_match", match_id: match.id, winner_id: winnerId }, `تأهل ${name}`);
  }

  return (
    <main className="mx-auto max-w-6xl p-4">
      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-bold">🏁 تجهيز مرحلة خروج المغلوب</h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">الفريق الفائز</label>
            <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="input">
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.emoji} {t.name} ({t.score})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">طريقة القرعة</label>
            <select
              value={seeding}
              onChange={(e) => setSeeding(e.target.value as typeof seeding)}
              className="input"
            >
              <option value="ranked">حسب الترتيب</option>
              <option value="random">عشوائي</option>
            </select>
          </div>

          <div className="flex items-end">
            <span className="text-sm text-[var(--color-muted)]">
              {members.length} طالبًا مؤهلًا
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => run({ action: "finish_team_stage", competition_id: competition.id }, "انتهت مرحلة الفرق")}
            className="btn bg-[var(--color-gold)] text-sm text-black"
          >
            🏁 إنهاء مرحلة الفرق
          </button>
          <button
            disabled={busy || members.length < 2}
            onClick={() =>
              run(
                { action: "build", competition_id: competition.id, team_id: teamId, seeding },
                "أُنشئت شجرة المواجهات"
              )
            }
            className="btn bg-[var(--color-brand)] text-sm text-white"
          >
            🎲 إنشاء شجرة المواجهات
          </button>
          <button
            disabled={busy || members.length < 2}
            onClick={() => {
              if (!confirm("إعادة القرعة تحذف نتائج المواجهات الحالية. متابعة؟")) return;
              run(
                { action: "build", competition_id: competition.id, team_id: teamId, seeding: "random" },
                "أُعيدت القرعة"
              );
            }}
            className="btn border border-[var(--color-line)] text-sm"
          >
            🔄 إعادة القرعة
          </button>
        </div>

        {note && <p className="mt-3 text-center text-sm font-bold">{note}</p>}
      </section>

      <BracketView
        competitionId={competition.id}
        students={students}
        onDecide={decide}
      />
    </main>
  );
}
