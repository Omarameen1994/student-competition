"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/database/client";
import { clockTime } from "@/lib/format";
import type { LiveEvent } from "@/lib/types";

const ICON: Record<string, string> = {
  question_start: "▶️",
  buzz: "🔔",
  judge_correct: "✅",
  judge_wrong: "❌",
  powerup_requested: "⚡",
  powerup_approved: "👍",
  powerup_rejected: "👎",
  powerup_unlocked: "🔓",
  manual_adjust: "✏️",
  student_login: "👤",
  team_stage_finished: "🏁",
  knockout_built: "🏆",
  match_decided: "🥇",
  tournament_finished: "🎉",
};

/** سجل الأحداث المباشر — للمشرفين فقط (القسم 21). */
export function LiveEvents({ competitionId }: { competitionId: string }) {
  const supabase = supabaseBrowser();
  const [events, setEvents] = useState<LiveEvent[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("competition_id", competitionId)
      .order("created_at", { ascending: false })
      .limit(60);
    setEvents((data ?? []) as LiveEvent[]);
  }, [supabase, competitionId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`events:${competitionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "events", filter: `competition_id=eq.${competitionId}` },
        (payload) => setEvents((prev) => [payload.new as LiveEvent, ...prev].slice(0, 60))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, competitionId, load]);

  return (
    <section className="card flex max-h-[28rem] flex-col p-4">
      <h2 className="mb-3 text-sm font-bold text-[var(--color-muted)]">📜 سجل الأحداث</h2>

      <div className="flex-1 space-y-1.5 overflow-y-auto text-xs">
        {events.length === 0 && (
          <p className="text-center text-[var(--color-muted)]">لا توجد أحداث بعد</p>
        )}
        {events.map((e) => (
          <div key={e.id} className="rise flex gap-2 border-b border-[var(--color-line)]/40 pb-1.5">
            <span className="shrink-0">{ICON[e.type] ?? "•"}</span>
            <span className="flex-1">{e.message}</span>
            <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
              {clockTime(e.created_at)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
