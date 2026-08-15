import { admin } from "@/lib/database/admin";
import { medal } from "@/lib/format";
import type { Student, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

/** صفحة التتويج (القسم 32) — يمكن عرضها على الشاشة الكبيرة. */
export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();

  const [{ data: competition }, { data: teams }, { data: students }, { data: rounds }] =
    await Promise.all([
      db.from("competitions").select("name").eq("id", id).maybeSingle(),
      db.from("teams").select("*").eq("competition_id", id).order("score", { ascending: false }),
      db.from("students").select("*").eq("competition_id", id).order("points", { ascending: false }),
      db.from("rounds").select("id, round_index").eq("competition_id", id).eq("round_index", 1),
    ]);

  const studentList = (students ?? []) as Student[];
  const teamList = (teams ?? []) as Team[];

  let champion: Student | undefined;
  let runnerUp: Student | undefined;

  if (rounds?.[0]) {
    const { data: finalMatch } = await db
      .from("matches")
      .select("student_a, student_b, winner_id")
      .eq("round_id", rounds[0].id)
      .maybeSingle();

    if (finalMatch?.winner_id) {
      champion = studentList.find((s) => s.id === finalMatch.winner_id);
      const loserId =
        finalMatch.winner_id === finalMatch.student_a ? finalMatch.student_b : finalMatch.student_a;
      runnerUp = studentList.find((s) => s.id === loserId);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="text-6xl glow">🏆🏆🏆</div>
      <h1 className="text-2xl font-black text-[var(--color-muted)]">{competition?.name}</h1>

      {champion ? (
        <>
          <div className="card pop-in w-full border-[var(--color-gold)] p-8">
            <p className="text-sm text-[var(--color-muted)]">بطل البطولة</p>
            <p className="mt-2 text-4xl font-black text-[var(--color-gold)]">{champion.name}</p>
            <p className="mt-2 text-lg">🥇 المركز الأول</p>
          </div>

          {runnerUp && (
            <div className="card w-full p-5">
              <p className="text-sm text-[var(--color-muted)]">الوصيف</p>
              <p className="mt-1 text-2xl font-black">{runnerUp.name}</p>
              <p className="mt-1">🥈 المركز الثاني</p>
            </div>
          )}

          <p className="text-xl font-black text-[var(--color-win)]">مبروك للأبطال! 🎉</p>
        </>
      ) : (
        <p className="card w-full p-6 text-[var(--color-muted)]">لم تُحسم البطولة بعد</p>
      )}

      <section className="w-full">
        <h2 className="mb-2 text-sm font-bold text-[var(--color-muted)]">ترتيب الفرق</h2>
        <div className="flex flex-col gap-2">
          {teamList.map((t, i) => (
            <div key={t.id} className="card flex items-center gap-3 px-4 py-3">
              <span>{medal(i + 1)}</span>
              <span className="flex-1 text-right">{t.emoji} {t.name}</span>
              <span className="text-xl font-black" style={{ color: t.color }}>{t.score}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
