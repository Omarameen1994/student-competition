import { admin } from "@/lib/database/admin";
import { StudentsManager } from "@/components/supervisor/StudentsManager";
import type { Student, Team } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();

  const [{ data: students }, { data: teams }, { data: creds }] = await Promise.all([
    db.from("students").select("*").eq("competition_id", id).order("created_at"),
    db.from("teams").select("*").eq("competition_id", id).order("sort_order"),
    db.from("student_credentials").select("student_id, login_code, enabled, device_id"),
  ]);

  const codeMap = Object.fromEntries(
    (creds ?? []).map((c) => [c.student_id, { code: c.login_code, enabled: c.enabled, bound: !!c.device_id }])
  );

  return (
    <StudentsManager
      competitionId={id}
      initialStudents={(students ?? []) as Student[]}
      teams={(teams ?? []) as Team[]}
      codes={codeMap}
    />
  );
}
