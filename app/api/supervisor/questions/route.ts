import { admin } from "@/lib/database/admin";
import { requireSupervisor } from "@/lib/auth/supervisor";
import { ok, fail, handler } from "@/lib/api";

export const POST = handler(async (req) => {
  await requireSupervisor();
  const body = (await req.json()) as Record<string, any>;
  const action = String(body.action ?? "");
  const db = admin();

  if (action === "add" || action === "update") {
    const fields = {
      type: body.type ?? "oral",
      text: String(body.text ?? "").trim(),
      media_url: body.media_url || null,
      correct_answer: body.correct_answer || null,
      points: Number(body.points ?? 10),
      time_limit: Number(body.time_limit ?? 15),
      is_golden: Boolean(body.is_golden),
    };

    if (!fields.text) return fail("اكتب نص السؤال");

    let questionId: string;

    if (action === "add") {
      const { data: last } = await db
        .from("questions")
        .select("order_index")
        .eq("competition_id", body.competition_id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data, error } = await db
        .from("questions")
        .insert({
          ...fields,
          competition_id: body.competition_id,
          order_index: (last?.order_index ?? 0) + 1,
        })
        .select("id")
        .single();

      if (error) return fail(error.message, 500);
      questionId = data.id;
    } else {
      const { error } = await db.from("questions").update(fields).eq("id", body.question_id);
      if (error) return fail(error.message, 500);
      questionId = body.question_id;
    }

    // خيارات الاختيار من متعدد
    if (Array.isArray(body.options)) {
      await db.from("question_options").delete().eq("question_id", questionId);
      const rows = (body.options as { label: string; is_correct?: boolean }[])
        .map((o, i) => ({
          question_id: questionId,
          label: String(o.label ?? "").trim(),
          is_correct: Boolean(o.is_correct),
          order_index: i,
        }))
        .filter((o) => o.label);

      if (rows.length) await db.from("question_options").insert(rows);
    }

    return ok({ id: questionId });
  }

  if (action === "delete") {
    const { error } = await db.from("questions").delete().eq("id", body.question_id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  if (action === "reorder") {
    const ids = body.ids as string[];
    for (let i = 0; i < ids.length; i++) {
      await db.from("questions").update({ order_index: i + 1 }).eq("id", ids[i]);
    }
    return ok();
  }

  if (action === "reset_asked") {
    await db.from("questions").update({ asked: false }).eq("competition_id", body.competition_id);
    return ok();
  }

  return fail("إجراء غير معروف");
});
