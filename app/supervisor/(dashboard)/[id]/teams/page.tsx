import { admin } from "@/lib/database/admin";
import { TeamsManager } from "@/components/supervisor/TeamsManager";
import type { Student, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();

  const [{ data: teams }, { data: students }] = await Promise.all([
    db.from("teams").select("*").eq("competition_id", id).order("sort_order"),
    db.from("students").select("*").eq("competition_id", id).order("name"),
  ]);

  return (
    <TeamsManager
      competitionId={id}
      teams={(teams ?? []) as Team[]}
      students={(students ?? []) as Student[]}
    />
  );
}
