import { admin } from "@/lib/database/admin";
import { KnockoutManager } from "@/components/supervisor/KnockoutManager";
import type { Competition, Student, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function KnockoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();

  const [{ data: competition }, { data: teams }, { data: students }] = await Promise.all([
    db.from("competitions").select("*").eq("id", id).single(),
    db.from("teams").select("*").eq("competition_id", id).order("score", { ascending: false }),
    db.from("students").select("*").eq("competition_id", id).order("points", { ascending: false }),
  ]);

  return (
    <KnockoutManager
      competition={competition as Competition}
      teams={(teams ?? []) as Team[]}
      students={(students ?? []) as Student[]}
    />
  );
}
