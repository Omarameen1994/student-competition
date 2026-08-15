import "server-only";
import { admin } from "@/lib/database/admin";

/** يضمن وجود صف حالة لكل (فريق × قدرة) في البطولة. */
export async function syncTeamPowerups(competitionId: string) {
  const db = admin();
  const [{ data: teams }, { data: powerups }] = await Promise.all([
    db.from("teams").select("id").eq("competition_id", competitionId),
    db.from("powerups").select("id, max_uses").eq("competition_id", competitionId),
  ]);

  if (!teams?.length || !powerups?.length) return;

  const rows = teams.flatMap((t) =>
    powerups.map((p) => ({ team_id: t.id, powerup_id: p.id, uses_left: p.max_uses }))
  );

  await db
    .from("team_powerups")
    .upsert(rows, { onConflict: "team_id,powerup_id", ignoreDuplicates: true });

  // تحديث الفتح فورًا حسب النقاط الحالية
  await db.rpc("refresh_powerup_unlocks", { p_competition: competitionId });
}
