"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/database/client";
import type {
  CompetitionState,
  Team,
  Student,
  Powerup,
  TeamPowerup,
  PowerupRequest,
} from "@/lib/types";

export interface LiveData {
  state: CompetitionState | null;
  teams: Team[];
  students: Student[];
  powerups: Powerup[];
  teamPowerups: TeamPowerup[];
  requests: PowerupRequest[];
  connected: boolean;
  refresh: () => void;
}

/**
 * اشتراك مباشر في كل ما يحتاجه أي عرض حيّ.
 * القراءة فقط عبر مفتاح anon، والصلاحيات محكومة بـRLS في قاعدة البيانات.
 */
export function useLive(competitionId: string): LiveData {
  const supabase = supabaseBrowser();
  const [state, setState] = useState<CompetitionState | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [powerups, setPowerups] = useState<Powerup[]>([]);
  const [teamPowerups, setTeamPowerups] = useState<TeamPowerup[]>([]);
  const [requests, setRequests] = useState<PowerupRequest[]>([]);
  const [connected, setConnected] = useState(false);
  const pending = useRef(false);

  const load = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;

    const [s, t, st, p, tp, rq] = await Promise.all([
      supabase.from("competition_state").select("*").eq("competition_id", competitionId).maybeSingle(),
      supabase.from("teams").select("*").eq("competition_id", competitionId).order("sort_order"),
      supabase.from("students").select("*").eq("competition_id", competitionId).order("points", { ascending: false }),
      supabase.from("powerups").select("*").eq("competition_id", competitionId).order("sort_order"),
      supabase.from("team_powerups").select("*"),
      supabase.from("powerup_requests").select("*").eq("competition_id", competitionId).eq("status", "pending"),
    ]);

    if (s.data) setState(s.data as CompetitionState);
    if (t.data) setTeams(t.data as Team[]);
    if (st.data) setStudents(st.data as Student[]);
    if (p.data) setPowerups(p.data as Powerup[]);
    if (tp.data) setTeamPowerups(tp.data as TeamPowerup[]);
    if (rq.data) setRequests(rq.data as PowerupRequest[]);

    pending.current = false;
  }, [supabase, competitionId]);

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`live:${competitionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "competition_state", filter: `competition_id=eq.${competitionId}` },
        (payload) => setState(payload.new as CompetitionState)
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "students" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_powerups" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "powerup_requests" }, load)
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    // شبكة أمان: إعادة مزامنة عند عودة التطبيق للواجهة
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [supabase, competitionId, load]);

  return { state, teams, students, powerups, teamPowerups, requests, connected, refresh: load };
}
