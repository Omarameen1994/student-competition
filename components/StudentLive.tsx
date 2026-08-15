"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLive } from "@/lib/realtime/useLive";
import { useServerClock } from "@/lib/realtime/useServerClock";
import { Timer } from "./Timer";
import { Buzzer } from "./Buzzer";
import { Scoreboard } from "./Scoreboard";
import { CaptainPowers } from "./CaptainPowers";
import { BracketView } from "./BracketView";
import { sounds, isMuted, setMuted } from "@/lib/sounds";
import { seconds } from "@/lib/format";
import type { Competition, Settings, Student } from "@/lib/types";

interface Props {
  me: Student;
  competition: Competition;
  settings: Settings;
}

export function StudentLive({ me, competition, settings }: Props) {
  const router = useRouter();
  const live = useLive(competition.id);
  const { offset } = useServerClock();

  const [buzzId, setBuzzId] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [pickedOption, setPickedOption] = useState<string | null>(null);
  const [answerSaved, setAnswerSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [blockedSessions, setBlockedSessions] = useState<string[]>([]);
  const [muted, setMutedState] = useState(false);
  const lastSession = useRef<string | null>(null);
  const lastPhase = useRef<string | null>(null);

  useEffect(() => setMutedState(isMuted()), []);

  const state = live.state;
  const question = state?.question_public ?? null;
  const sessionId = state?.session_id ?? null;
  const myTeam = live.teams.find((t) => t.id === me.team_id) ?? null;
  const myRow = live.students.find((s) => s.id === me.id) ?? me;

  // إعادة ضبط الحالة المحلية عند كل سؤال جديد
  useEffect(() => {
    if (sessionId === lastSession.current) return;
    lastSession.current = sessionId;
    setBuzzId(null);
    setAnswer("");
    setPickedOption(null);
    setAnswerSaved(false);
    setNotice(null);
    if (sessionId && settings.sounds_enabled) sounds.questionStart();
  }, [sessionId, settings.sounds_enabled]);

  // مؤثرات صوتية عند تغيّر المرحلة
  useEffect(() => {
    if (!state || !settings.sounds_enabled) return;
    if (lastPhase.current === "judging" && state.phase === "break") sounds.correct();
    lastPhase.current = state.phase;
  }, [state, settings.sounds_enabled]);

  const iAmFirst = state?.first_buzz?.student_id === me.id;
  const myState: "idle" | "sent" | "won" | "blocked" = iAmFirst
    ? "won"
    : sessionId && blockedSessions.includes(sessionId)
      ? "blocked"
      : buzzId
        ? "sent"
        : "idle";

  const myTeamRank =
    [...live.teams].sort((a, b) => b.score - a.score).findIndex((t) => t.id === me.team_id) + 1;

  const myTeamMates = live.students
    .filter((s) => s.team_id === me.team_id)
    .sort((a, b) => b.points - a.points);
  const myRankInTeam = myTeamMates.findIndex((s) => s.id === me.id) + 1;

  async function saveAnswer() {
    if (!buzzId) return;
    await fetch("/api/student/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ buzz_id: buzzId, text: answer, option_id: pickedOption }),
    });
    setAnswerSaved(true);
  }

  async function logout() {
    await fetch("/api/student/logout", { method: "POST" });
    router.replace("/login");
  }

  function toggleSound() {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pb-10">
      {/* بطاقة الهوية */}
      <header className="card p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-lg font-black">
              👤 {me.name} {me.is_captain && <span title="قائد الفريق">👑</span>}
            </div>
            {myTeam && (
              <div className="mt-0.5 text-sm" style={{ color: myTeam.color }}>
                {myTeam.emoji} {myTeam.name}
              </div>
            )}
          </div>
          <div className="flex shrink-0 gap-1">
            <button
              onClick={toggleSound}
              className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-sm"
              aria-label="الصوت"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              onClick={logout}
              className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-muted)]"
            >
              خروج
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <Stat label="نقاطي" value={myRow.points} accent />
          <Stat label="ترتيبي" value={myRankInTeam > 0 ? `#${myRankInTeam}` : "-"} />
          <Stat label="نقاط الفريق" value={myTeam?.score ?? 0} />
          <Stat label="ترتيب الفريق" value={myTeamRank > 0 ? `#${myTeamRank}` : "-"} />
        </div>
      </header>

      {state?.banner && (
        <div className="pop-in card border-[var(--color-gold)] p-4 text-center text-lg font-black text-[var(--color-gold)]">
          {state.banner}
        </div>
      )}

      {/* شجرة خروج المغلوب */}
      {(state?.phase === "knockout" || state?.phase === "finished") && (
        <BracketView competitionId={competition.id} students={live.students} highlight={me.id} />
      )}

      {/* السؤال الحالي */}
      {state?.phase !== "knockout" && state?.phase !== "finished" && (
        <section className="card flex flex-col items-center gap-4 p-5">
          {question ? (
            <>
              <div className="flex w-full items-center justify-between text-sm text-[var(--color-muted)]">
                <span>السؤال رقم {question.number}</span>
                <span className="font-bold text-[var(--color-gold)]">
                  {question.points} نقطة
                </span>
              </div>

              <p className="text-center text-xl font-bold leading-relaxed">{question.text}</p>

              {question.media_url && <QuestionMedia type={question.type} url={question.media_url} />}

              <Timer
                endsAt={question.ends_at}
                offset={offset}
                paused={!state?.buzzer_open && state?.phase !== "question"}
                onExpire={() => settings.sounds_enabled && sounds.timeUp()}
              />
            </>
          ) : (
            <p className="py-6 text-center text-[var(--color-muted)]">
              ⏳ بانتظار بدء السؤال التالي…
            </p>
          )}

          {settings.buzzer_enabled && (
            <Buzzer
              sessionId={sessionId}
              open={!!state?.buzzer_open}
              myState={myState}
              onResult={(r) => {
                if (r.ok) {
                  setBuzzId(r.buzz_id ?? null);
                  setNotice(`⚡ زمن ضغطك: ${seconds(r.reaction_ms ?? 0)} ثانية`);
                } else {
                  setNotice(r.error ?? "لم تُقبل الضغطة");
                  if (r.error?.includes("أجبت") && sessionId) {
                    setBlockedSessions((prev) => [...prev, sessionId]);
                  }
                }
              }}
            />
          )}

          {notice && <p className="text-center text-sm font-bold">{notice}</p>}

          {/* من ضغط أولًا */}
          {state?.first_buzz && (
            <div className="pop-in w-full rounded-xl bg-[var(--color-ink)] p-3 text-center">
              <span className="text-sm text-[var(--color-muted)]">أول ضاغط</span>
              <div className="mt-1 font-black">
                🔔 {state.first_buzz.student_name}{" "}
                <span style={{ color: state.first_buzz.team_color }}>
                  {state.first_buzz.team_emoji}
                </span>
              </div>
              <div className="text-xs text-[var(--color-muted)]">
                {seconds(state.first_buzz.reaction_ms)} ثانية
              </div>
            </div>
          )}

          {/* إدخال الإجابة — للطالب الذي فاز بالضغطة فقط */}
          {iAmFirst && buzzId && (
            <div className="w-full rise">
              {question?.type === "multiple_choice" && question.options.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {question.options.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => {
                        setPickedOption(o.id);
                        setAnswer(o.label);
                        setAnswerSaved(false);
                      }}
                      className={`btn border text-right ${
                        pickedOption === o.id
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/20"
                          : "border-[var(--color-line)]"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              ) : question?.type === "true_false" ? (
                <div className="grid grid-cols-2 gap-2">
                  {["صح", "خطأ"].map((label) => (
                    <button
                      key={label}
                      onClick={() => {
                        setAnswer(label);
                        setAnswerSaved(false);
                      }}
                      className={`btn border py-4 text-lg ${
                        answer === label
                          ? "border-[var(--color-brand)] bg-[var(--color-brand)]/20"
                          : "border-[var(--color-line)]"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : question?.type === "oral" ? (
                <p className="rounded-xl bg-[var(--color-ink)] p-3 text-center text-sm">
                  🎙️ أجب شفويًا أمام المشرف
                </p>
              ) : (
                <textarea
                  value={answer}
                  onChange={(e) => {
                    setAnswer(e.target.value);
                    setAnswerSaved(false);
                  }}
                  rows={2}
                  placeholder="اكتب إجابتك…"
                  className="input"
                />
              )}

              {question?.type !== "oral" && (
                <button
                  onClick={saveAnswer}
                  disabled={!answer.trim() || answerSaved}
                  className="btn mt-2 w-full bg-[var(--color-win)] text-white"
                >
                  {answerSaved ? "✔️ وصلت إجابتك للمشرف" : "إرسال الإجابة"}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* قدرات القائد */}
      {me.is_captain && myTeam && (
        <CaptainPowers
          teamId={myTeam.id}
          teamScore={myTeam.score}
          powerups={live.powerups}
          teamPowerups={live.teamPowerups}
          requests={live.requests}
        />
      )}

      {/* الترتيب المباشر */}
      <section>
        <h2 className="mb-2 text-sm font-bold text-[var(--color-muted)]">🏆 ترتيب الفرق</h2>
        <Scoreboard teams={live.teams} />
      </section>

      {settings.show_student_points && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-[var(--color-muted)]">
            ترتيب أعضاء فريقي
          </h2>
          <div className="card divide-y divide-[var(--color-line)]">
            {myTeamMates.map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-3 py-2 ${
                  s.id === me.id ? "bg-[var(--color-brand)]/10" : ""
                }`}
              >
                <span className="w-6 text-center text-sm text-[var(--color-muted)]">{i + 1}</span>
                <span className="flex-1 truncate text-sm">
                  {settings.show_student_names || s.id === me.id ? s.name : "طالب"}
                  {s.is_captain && " 👑"}
                </span>
                <span className="font-bold tabular-nums">{s.points}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-center text-xs text-[var(--color-muted)]">
        {live.connected ? "🟢 متصل مباشرة" : "🟠 جارٍ الاتصال…"}
      </p>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-[var(--color-ink)] px-1 py-2">
      <div className={`text-lg font-black tabular-nums ${accent ? "text-[var(--color-gold)]" : ""}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">{label}</div>
    </div>
  );
}

function QuestionMedia({ type, url }: { type: string; url: string }) {
  if (type === "audio") return <audio controls src={url} className="w-full" />;
  if (type === "video") return <video controls src={url} className="w-full rounded-xl" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="max-h-56 w-full rounded-xl object-contain" />;
}
