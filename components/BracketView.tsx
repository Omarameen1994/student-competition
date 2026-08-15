"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/database/client";
import type { Match, Round, Student } from "@/lib/types";

interface Props {
  competitionId: string;
  students: Student[];
  highlight?: string;
  /** للمشرف: اعتماد الفائز مباشرة من الشجرة */
  onDecide?: (match: Match, winnerId: string) => void;
}

/** شجرة خروج المغلوب — تتحدث تلقائيًا بعد كل مواجهة (القسم 30). */
export function BracketView({ competitionId, students, highlight, onDecide }: Props) {
  const supabase = supabaseBrowser();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);

  const load = useCallback(async () => {
    const { data: r } = await supabase
      .from("rounds")
      .select("*")
      .eq("competition_id", competitionId)
      .order("round_index", { ascending: false });

    const roundList = (r ?? []) as Round[];
    setRounds(roundList);

    if (roundList.length === 0) {
      setMatches([]);
      return;
    }

    const { data: m } = await supabase
      .from("matches")
      .select("*")
      .in("round_id", roundList.map((x) => x.id))
      .order("match_index");

    setMatches((m ?? []) as Match[]);
  }, [supabase, competitionId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`bracket:${competitionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "rounds" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, competitionId, load]);

  const nameOf = (id: string | null) =>
    id ? (students.find((s) => s.id === id)?.name ?? "—") : "—";

  if (rounds.length === 0) {
    return (
      <section className="card p-4 text-center text-sm text-[var(--color-muted)]">
        لم تبدأ مرحلة خروج المغلوب بعد
      </section>
    );
  }

  return (
    <section className="card overflow-x-auto p-4">
      <h2 className="mb-3 text-sm font-bold text-[var(--color-muted)]">🏆 شجرة البطولة</h2>

      <div className="flex min-w-max gap-4">
        {rounds.map((round) => (
          <div key={round.id} className="flex min-w-[13rem] flex-col justify-around gap-3">
            <div className="text-center text-xs font-bold text-[var(--color-gold)]">
              {round.name}
            </div>

            {matches
              .filter((m) => m.round_id === round.id)
              .map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border p-2 text-sm ${
                    m.status === "finished"
                      ? "border-[var(--color-line)]"
                      : "border-[var(--color-brand)]"
                  }`}
                >
                  {(["a", "b"] as const).map((slot) => {
                    const sid = slot === "a" ? m.student_a : m.student_b;
                    const isWinner = m.winner_id === sid && sid !== null;
                    return (
                      <div
                        key={slot}
                        className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5
                          ${isWinner ? "bg-[var(--color-win)]/20 font-bold" : ""}
                          ${sid === highlight ? "ring-1 ring-[var(--color-brand)]" : ""}`}
                      >
                        <span className="truncate">{nameOf(sid)}</span>
                        {isWinner && <span>🏆</span>}
                        {onDecide && !m.winner_id && sid && (
                          <button
                            onClick={() => onDecide(m, sid)}
                            className="shrink-0 rounded-lg bg-[var(--color-win)] px-2 py-0.5 text-xs font-bold text-white"
                          >
                            فائز
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {m.is_bye && (
                    <div className="mt-1 text-center text-[11px] text-[var(--color-muted)]">
                      تأهل مباشر (Bye)
                    </div>
                  )}
                </div>
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}
