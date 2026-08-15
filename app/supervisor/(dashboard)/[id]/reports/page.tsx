import Link from "next/link";
import { admin } from "@/lib/database/admin";
import { seconds, medal, clockTime } from "@/lib/format";
import type { Student, Team, LiveEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();

  const [{ data: teams }, { data: students }, { data: events }, { data: rounds }] = await Promise.all([
    db.from("teams").select("*").eq("competition_id", id).order("score", { ascending: false }),
    db.from("students").select("*").eq("competition_id", id).order("points", { ascending: false }),
    db.from("events").select("*").eq("competition_id", id).order("created_at", { ascending: false }).limit(300),
    db.from("rounds").select("id, name, round_index").eq("competition_id", id).order("round_index"),
  ]);

  const finalRound = rounds?.find((r) => r.round_index === 1);
  let champion: string | null = null;
  let runnerUp: string | null = null;

  if (finalRound) {
    const { data: finalMatch } = await db
      .from("matches")
      .select("student_a, student_b, winner_id")
      .eq("round_id", finalRound.id)
      .maybeSingle();

    if (finalMatch?.winner_id) {
      const list = (students ?? []) as Student[];
      champion = list.find((s) => s.id === finalMatch.winner_id)?.name ?? null;
      const loser =
        finalMatch.winner_id === finalMatch.student_a ? finalMatch.student_b : finalMatch.student_a;
      runnerUp = list.find((s) => s.id === loser)?.name ?? null;
    }
  }

  const teamList = (teams ?? []) as Team[];
  const studentList = (students ?? []) as Student[];
  const eventList = (events ?? []) as LiveEvent[];

  return (
    <main className="mx-auto max-w-5xl p-4">
      {champion && (
        <section className="card mb-4 border-[var(--color-gold)] p-6 text-center">
          <div className="text-5xl">🏆</div>
          <h2 className="mt-2 text-2xl font-black text-[var(--color-gold)]">البطل: {champion}</h2>
          {runnerUp && <p className="mt-1 text-[var(--color-muted)]">🥈 الوصيف: {runnerUp}</p>}
          <Link href={`/results/${id}`} className="btn mt-4 inline-block bg-[var(--color-gold)] text-black">
            عرض صفحة التتويج
          </Link>
        </section>
      )}

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-bold">🚩 نتائج الفرق</h2>
        <div className="flex flex-col gap-2">
          {teamList.map((t, i) => (
            <div key={t.id} className="flex items-center gap-3 rounded-xl bg-[var(--color-ink)] px-3 py-2">
              <span>{medal(i + 1)}</span>
              <span className="flex-1">{t.emoji} {t.name}</span>
              <span className="text-xl font-black" style={{ color: t.color }}>{t.score}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card mb-4 overflow-x-auto p-4">
        <h2 className="mb-3 font-bold">👥 إحصائيات الطلاب</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-line)] text-right text-xs text-[var(--color-muted)]">
            <tr>
              <th className="p-2">#</th>
              <th className="p-2">الاسم</th>
              <th className="p-2">الفريق</th>
              <th className="p-2">النقاط</th>
              <th className="p-2">صحيحة</th>
              <th className="p-2">خاطئة</th>
              <th className="p-2">ضغطات</th>
              <th className="p-2">متوسط السرعة</th>
            </tr>
          </thead>
          <tbody>
            {studentList.map((s, i) => {
              const team = teamList.find((t) => t.id === s.team_id);
              const avg = s.buzz_count > 0 ? s.total_reaction_ms / s.buzz_count : null;
              return (
                <tr key={s.id} className="border-b border-[var(--color-line)]/40">
                  <td className="p-2 text-[var(--color-muted)]">{i + 1}</td>
                  <td className="p-2 font-bold">{s.name} {s.is_captain && "👑"}</td>
                  <td className="p-2">{team ? `${team.emoji} ${team.name}` : "—"}</td>
                  <td className="p-2 font-black tabular-nums">{s.points}</td>
                  <td className="p-2 tabular-nums text-[var(--color-win)]">{s.correct_count}</td>
                  <td className="p-2 tabular-nums text-[var(--color-lose)]">{s.wrong_count}</td>
                  <td className="p-2 tabular-nums">{s.buzz_count}</td>
                  <td className="p-2 tabular-nums">{avg ? `${seconds(avg)} ث` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 font-bold">📜 السجل الكامل ({eventList.length})</h2>
        <div className="max-h-96 space-y-1 overflow-y-auto text-xs">
          {eventList.map((e) => (
            <div key={e.id} className="flex gap-2 border-b border-[var(--color-line)]/30 pb-1">
              <span className="shrink-0 tabular-nums text-[var(--color-muted)]">{clockTime(e.created_at)}</span>
              <span className="flex-1">{e.message}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
