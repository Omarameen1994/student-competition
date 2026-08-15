import { admin } from "@/lib/database/admin";
import { PowerupsManager } from "@/components/supervisor/PowerupsManager";
import type { Powerup, Team, TeamPowerup } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PowerupsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();

  const [{ data: powerups }, { data: teams }, { data: teamPowerups }] = await Promise.all([
    db.from("powerups").select("*").eq("competition_id", id).order("sort_order"),
    db.from("teams").select("*").eq("competition_id", id).order("sort_order"),
    db.from("team_powerups").select("*"),
  ]);

  return (
    <PowerupsManager
      competitionId={id}
      powerups={(powerups ?? []) as Powerup[]}
      teams={(teams ?? []) as Team[]}
      teamPowerups={(teamPowerups ?? []) as TeamPowerup[]}
    />
  );
}
