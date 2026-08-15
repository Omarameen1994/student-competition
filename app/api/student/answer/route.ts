import { admin } from "@/lib/database/admin";
import { requireStudent } from "@/lib/auth/student-session";
import { ok, fail, handler } from "@/lib/api";

export const POST = handler(async (req) => {
  const student = await requireStudent();
  const { buzz_id, text, option_id } = (await req.json()) as {
    buzz_id?: string;
    text?: string;
    option_id?: string | null;
  };
  if (!buzz_id) return fail("لا توجد ضغطة مرتبطة");

  const db = admin();

  // الإجابة تُقبل فقط من صاحب الضغطة، وقبل حكم المشرف
  const { data: buzz } = await db
    .from("buzzes")
    .select("id, student_id, status")
    .eq("id", buzz_id)
    .maybeSingle();

  if (!buzz || buzz.student_id !== student.id) return fail("غير مصرّح", 403);
  if (buzz.status !== "pending") return fail("تم اعتماد هذه الإجابة مسبقًا");

  await db.from("answers").upsert(
    {
      buzz_id,
      student_id: student.id,
      text: (text ?? "").slice(0, 500),
      option_id: option_id ?? null,
    },
    { onConflict: "buzz_id" }
  );

  return ok();
});
