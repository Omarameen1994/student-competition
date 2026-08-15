import { admin } from "@/lib/database/admin";
import { requireStudent } from "@/lib/auth/student-session";
import { ok, fail, handler, rpcMessage } from "@/lib/api";

export const POST = handler(async (req) => {
  const student = await requireStudent();
  const { session_id } = (await req.json()) as { session_id?: string };
  if (!session_id) return fail("لا يوجد سؤال نشط");

  const db = admin();

  // الجلسة يجب أن تكون في بطولة الطالب نفسه — لا يكفي أن يرسل أي معرّف
  const { data: session } = await db
    .from("question_sessions")
    .select("id, competition_id")
    .eq("id", session_id)
    .maybeSingle();

  if (!session || session.competition_id !== student.competition_id) {
    return fail("لا يوجد سؤال نشط");
  }

  const { data, error } = await db.rpc("press_buzzer", {
    p_student: student.id,
    p_session: session_id,
  });

  if (error) return fail(error.message, 500);
  const result = data as { ok: boolean; error?: string; reaction_ms?: number; buzz_id?: string };

  if (!result.ok) return fail(rpcMessage(result.error ?? "buzzer_closed"));
  return ok({ buzz_id: result.buzz_id, reaction_ms: result.reaction_ms });
});
