import { redirect } from "next/navigation";
import { getStudent } from "@/lib/auth/student-session";
import { admin } from "@/lib/database/admin";
import { StudentLive } from "@/components/StudentLive";
import type { Competition } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StudentPage() {
  const student = await getStudent();
  if (!student) redirect("/login");

  const { data: competition } = await admin()
    .from("competitions")
    .select("*")
    .eq("id", student.competition_id)
    .maybeSingle();

  if (!competition) redirect("/login");

  return (
    <StudentLive
      me={student}
      competition={competition as Competition}
      settings={(competition as Competition).settings}
    />
  );
}
