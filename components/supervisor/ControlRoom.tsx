"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLive } from "@/lib/realtime/useLive";
import { useServerClock } from "@/lib/realtime/useServerClock";
import { supabaseBrowser } from "@/lib/database/client";
import { api } from "@/lib/apiClient";
import { Timer } from "@/components/Timer";
import { Scoreboard } from "@/components/Scoreboard";
import { LiveEvents } from "@/components/supervisor/LiveEvents";
import { seconds, QUESTION_TYPE_LABEL } from "@/lib/format";
import type { Competition, Question } from "@/lib/types";

export function ControlRoom({ competition }: { competition: Competition }) {
  const supabase = supabaseBrowser();
  const live = useLive(competition.id);
  const { offset } = useServerClock();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answer, setAnswer] = useState<{ text: string; option_id: string | null } | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastBuzz = useRef<string | null>(null);

  const state = live.state;
  const question = state?.question_public ?? null;
  const firstBuzz = state?.first_buzz ?? null;

  const loadQuestions = useCallback(async () => {
    const { data } = await supabase
      .from("questions")
      .select("*")
      .eq("competition_id", competition.id)
      .order("order_index");
    setQuestions((data ?? []) as Question[]);
  }, [supabase, competition.id]);

  useEffect(() => {
    loadQuestions();
    const channel = supabase
      .channel(`questions:${competition.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, loadQuestions)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, competition.id, loadQuestions]);

  // جلب إجابة أول ضاغط فور وصولها + متابعة تعديلاتها مباشرة
  useEffect(() => {
    if (!firstBuzz) {
      setAnswer(null);
      setCorrectAnswer(null);
      lastBuzz.current = null;
      return;
    }
    if (lastBuzz.current === firstBuzz.buzz_id) return;
    lastBuzz.current = firstBuzz.buzz_id;

    const fetchAnswer = async () => {
      const res = await api.live({ action: "read_answer", buzz_id: firstBuzz.buzz_id });
      const a = res.answer as { text: string; option_id: string | null } | null;
      setAnswer(a);
    };
    fetchAnswer();

    const channel = supabase
      .channel(`answer:${firstBuzz.buzz_id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `buzz_id=eq.${firstBuzz.buzz_id}` },
        fetchAnswer
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [firstBuzz, supabase]);

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>, success?: string) {
    setBusy(true);
    setMessage(null);
    const res = await fn();
    setMessage(res.ok ? (success ?? null) : (res.error ?? "تعذّر التنفيذ"));
    setBusy(false);
  }

  const nextQuestion = questions.find((q) => !q.asked);

  return (
    <main className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-4">
        {/* النتائج */}
        <section className="grid gap-3 sm:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-2 text-sm font-bold text-[var(--color-muted)]">🏆 ترتيب الفرق</h2>
            <Scoreboard teams={live.teams} />
          </div>

          <div className="card flex flex-col justify-between gap-3 p-4">
            <div>
              <h2 className="mb-2 text-sm font-bold text-[var(--color-muted)]">حالة البطولة</h2>
              <p className="text-lg font-black">
                {state?.phase === "question" && "🔴 سؤال جارٍ"}
                {state?.phase === "judging" && "⚖️ بانتظار الحكم"}
                {state?.phase === "break" && "⏸️ استراحة"}
                {state?.phase === "idle" && "⏳ لم تبدأ"}
                {state?.phase === "knockout" && "🏆 خروج المغلوب"}
                {state?.phase === "finished" && "🎉 انتهت"}
              </p>
              <p className="mt-1 text-xs text-[var(--color-muted)]">
                {live.connected ? "🟢 متزامن مباشرة مع المشرف الآخر" : "🟠 جارٍ الاتصال…"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => run(() => api.competition({ action: "update", competition_id: competition.id, status: "live" }), "بدأت البطولة")}
                className="btn bg-[var(--color-win)] text-sm text-white"
              >
                ▶️ بدء البطولة
              </button>
              <button
                onClick={() => run(() => api.competition({ action: "update", competition_id: competition.id, status: "paused" }), "أُوقفت البطولة")}
                className="btn border border-[var(--color-line)] text-sm"
              >
                ⏸️ إيقاف
              </button>
              <button
                onClick={() => run(() => api.knockout({ action: "finish_team_stage", competition_id: competition.id }), "انتهت مرحلة الفرق")}
                className="btn bg-[var(--color-gold)] text-sm text-black"
              >
                🏁 إنهاء مرحلة الفرق
              </button>
            </div>
          </div>
        </section>

        {/* السؤال الحالي */}
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-bold">
              {question ? `السؤال رقم ${question.number}` : "لا يوجد سؤال نشط"}
            </h2>
            {question && (
              <div className="flex items-center gap-4">
                <span className="text-sm text-[var(--color-gold)]">{question.points} نقطة</span>
                <Timer
                  endsAt={question.ends_at}
                  offset={offset}
                  size="sm"
                  paused={state?.phase !== "question"}
                />
              </div>
            )}
          </div>

          {question && <p className="mt-3 text-lg font-bold">{question.text}</p>}

          {state?.session_id && (
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                { control: "pause", label: "⏸️ إيقاف" },
                { control: "resume", label: "▶️ استئناف" },
                { control: "reset", label: "🔄 إعادة السؤال" },
                { control: "reopen", label: "🔓 إعادة فتح Buzzer" },
                { control: "end", label: "⏹️ إنهاء السؤال" },
                { control: "cancel", label: "❌ إلغاء السؤال" },
              ].map((c) => (
                <button
                  key={c.control}
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api.live({
                        action: "control_question",
                        session_id: state.session_id,
                        control: c.control,
                      })
                    )
                  }
                  className="btn border border-[var(--color-line)] text-sm"
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* أول ضاغط + الحكم */}
        <section
          className={`card p-4 ${firstBuzz ? "pop-in border-[var(--color-gold)]" : ""}`}
        >
          <h2 className="mb-3 text-sm font-bold text-[var(--color-muted)]">🔔 أول ضاغط</h2>

          {!firstBuzz ? (
            <p className="py-4 text-center text-sm text-[var(--color-muted)]">
              {state?.buzzer_open ? "الـBuzzer مفتوح — بانتظار الطلاب" : "لا توجد ضغطة"}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <div className="text-2xl font-black">{firstBuzz.student_name}</div>
                  <div style={{ color: firstBuzz.team_color }}>
                    {firstBuzz.team_emoji} {firstBuzz.team_name}
                  </div>
                </div>
                <div className="rounded-xl bg-[var(--color-ink)] px-4 py-2 text-center">
                  <div className="text-xl font-black tabular-nums text-[var(--color-gold)]">
                    {seconds(firstBuzz.reaction_ms)}
                  </div>
                  <div className="text-[11px] text-[var(--color-muted)]">ثانية</div>
                </div>
              </div>

              <div className="mt-4 rounded-xl bg-[var(--color-ink)] p-3">
                <div className="text-xs text-[var(--color-muted)]">إجابة الطالب</div>
                <div className="mt-1 text-lg font-bold">
                  {answer?.text ? answer.text : "— (لم تصل إجابة مكتوبة / إجابة شفوية)"}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={async () => {
                    // رقم السؤال المعروض هو ترتيبه في القائمة وليس order_index
                    const q = question ? questions[question.number - 1] : undefined;
                    const res = await api.live({
                      action: "reveal_correct",
                      question_id: q?.id ?? questions.find((x) => !x.asked)?.id,
                    });
                    setCorrectAnswer((res.correct_answer as string) ?? "غير محددة");
                  }}
                  className="btn border border-[var(--color-line)] text-xs"
                >
                  👁️ إظهار الإجابة الصحيحة
                </button>
                {correctAnswer && (
                  <span className="text-sm font-bold text-[var(--color-win)]">{correctAnswer}</span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api.live({ action: "judge", buzz_id: firstBuzz.buzz_id, verdict: "correct" }),
                      "✅ اعتُمدت صحيحة"
                    )
                  }
                  className="btn bg-[var(--color-win)] py-4 text-lg text-white"
                >
                  ✅ صحيحة
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => api.live({ action: "judge", buzz_id: firstBuzz.buzz_id, verdict: "wrong" }),
                      "❌ اعتُمدت خاطئة"
                    )
                  }
                  className="btn bg-[var(--color-lose)] py-4 text-lg text-white"
                >
                  ❌ خاطئة
                </button>
                <button
                  disabled={busy}
                  onClick={() =>
                    run(() =>
                      api.live({ action: "control_question", session_id: state?.session_id, control: "reset" })
                    )
                  }
                  className="btn border border-[var(--color-line)] py-4"
                >
                  🔄 إعادة
                </button>
              </div>
            </>
          )}
        </section>

        {/* قائمة الأسئلة */}
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">❓ الأسئلة</h2>
            {nextQuestion && (
              <button
                disabled={busy}
                onClick={() =>
                  run(() => api.live({ action: "start_question", question_id: nextQuestion.id }), "بدأ السؤال")
                }
                className="btn bg-[var(--color-brand)] text-sm text-white"
              >
                ▶️ بدء السؤال التالي
              </button>
            )}
          </div>

          {questions.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-muted)]">
              لا توجد أسئلة — أضفها من تبويب الأسئلة
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {questions.map((q, i) => (
                <div
                  key={q.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${
                    q.asked ? "border-[var(--color-line)] opacity-50" : "border-[var(--color-line)]"
                  }`}
                >
                  <span className="w-6 text-center text-[var(--color-muted)]">{i + 1}</span>
                  <span className="flex-1 truncate">
                    {q.is_golden && "⭐ "}
                    {q.text}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--color-muted)]">
                    {QUESTION_TYPE_LABEL[q.type]} · {q.points}ن · {q.time_limit}ث
                  </span>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(() => api.live({ action: "start_question", question_id: q.id }), "بدأ السؤال")
                    }
                    className="btn shrink-0 bg-[var(--color-brand)] px-3 py-1 text-xs text-white"
                  >
                    بدء
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* العمود الجانبي */}
      <aside className="flex flex-col gap-4">
        {/* طلبات القدرات */}
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-bold text-[var(--color-muted)]">⚡ طلبات القدرات</h2>
          {live.requests.length === 0 ? (
            <p className="text-center text-xs text-[var(--color-muted)]">لا توجد طلبات</p>
          ) : (
            <div className="flex flex-col gap-2">
              {live.requests.map((r) => {
                const powerup = live.powerups.find((p) => p.id === r.powerup_id);
                const team = live.teams.find((t) => t.id === r.team_id);
                return (
                  <div key={r.id} className="pop-in rounded-xl border border-[var(--color-gold)] p-3">
                    <div className="text-sm font-bold">
                      {powerup?.icon} {powerup?.name}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      قائد {team?.emoji} {team?.name}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() =>
                          run(() => api.live({ action: "decide_powerup", request_id: r.id, approve: true }), "تمت الموافقة")
                        }
                        className="btn flex-1 bg-[var(--color-win)] py-1.5 text-xs text-white"
                      >
                        قبول
                      </button>
                      <button
                        onClick={() =>
                          run(() => api.live({ action: "decide_powerup", request_id: r.id, approve: false }), "رُفض الطلب")
                        }
                        className="btn flex-1 bg-[var(--color-lose)] py-1.5 text-xs text-white"
                      >
                        رفض
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* تعديل يدوي للنقاط */}
        <ManualPoints competitionId={competition.id} teams={live.teams} students={live.students} />

        {/* سجل الأحداث */}
        <LiveEvents competitionId={competition.id} />
      </aside>

      {message && (
        <div className="pop-in fixed bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-xl bg-[var(--color-ink-3)] px-5 py-3 font-bold shadow-lg">
          {message}
        </div>
      )}
    </main>
  );
}

function ManualPoints({
  competitionId,
  teams,
  students,
}: {
  competitionId: string;
  teams: { id: string; name: string; emoji: string }[];
  students: { id: string; name: string; team_id: string | null }[];
}) {
  const [teamId, setTeamId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [delta, setDelta] = useState(10);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);

  async function apply(sign: 1 | -1) {
    const res = await api.live({
      action: "adjust_points",
      competition_id: competitionId,
      team_id: teamId || null,
      student_id: studentId || null,
      team_delta: teamId ? sign * delta : 0,
      student_delta: studentId ? sign * delta : 0,
      reason: reason || "تعديل يدوي",
    });
    setNote(res.ok ? "تم التعديل" : (res.error ?? "تعذّر التعديل"));
  }

  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-bold text-[var(--color-muted)]">➕ نقاط يدوية</h2>

      <div className="flex flex-col gap-2">
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="input py-2 text-sm">
          <option value="">— بدون فريق —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
          ))}
        </select>

        <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="input py-2 text-sm">
          <option value="">— بدون طالب —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(Number(e.target.value))}
          className="input py-2 text-sm"
        />
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="السبب (اختياري)"
          className="input py-2 text-sm"
        />

        <div className="flex gap-2">
          <button onClick={() => apply(1)} className="btn flex-1 bg-[var(--color-win)] py-2 text-sm text-white">
            منح
          </button>
          <button onClick={() => apply(-1)} className="btn flex-1 bg-[var(--color-lose)] py-2 text-sm text-white">
            خصم
          </button>
        </div>

        {note && <p className="text-center text-xs">{note}</p>}
      </div>
    </section>
  );
}
