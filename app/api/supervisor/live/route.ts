import { admin } from "@/lib/database/admin";
import { requireSupervisor } from "@/lib/auth/supervisor";
import { ok, fail, handler, rpcMessage } from "@/lib/api";

type Rpc = { ok: boolean; error?: string } & Record<string, unknown>;

export const POST = handler(async (req) => {
  const supervisor = await requireSupervisor();
  const body = (await req.json()) as Record<string, any>;
  const action = String(body.action ?? "");
  const db = admin();

  // ——— بدء السؤال ———
  if (action === "start_question") {
    const { data, error } = await db.rpc("start_question", {
      p_question: body.question_id,
      p_supervisor: supervisor.id,
      p_seconds: body.seconds ?? null,
    });
    if (error) return fail(error.message, 500);
    const r = data as Rpc;
    return r.ok ? ok(r) : fail(rpcMessage(String(r.error)));
  }

  // ——— إيقاف / استئناف / إعادة / إنهاء / إلغاء / إعادة فتح ———
  if (action === "control_question") {
    const { data, error } = await db.rpc("control_question", {
      p_session: body.session_id,
      p_action: body.control,
      p_supervisor: supervisor.id,
    });
    if (error) return fail(error.message, 500);
    const r = data as Rpc;
    return r.ok ? ok(r) : fail(rpcMessage(String(r.error)));
  }

  // ——— اعتماد الإجابة (ذرّي: لا يُنفَّذ مرتين) ———
  if (action === "judge") {
    const { data, error } = await db.rpc("judge_buzz", {
      p_buzz: body.buzz_id,
      p_verdict: body.verdict,
      p_supervisor: supervisor.id,
    });
    if (error) return fail(error.message, 500);
    const r = data as Rpc;
    return r.ok ? ok(r) : fail(rpcMessage(String(r.error)));
  }

  // ——— البت في طلب قدرة ———
  if (action === "decide_powerup") {
    const { data, error } = await db.rpc("decide_powerup", {
      p_request: body.request_id,
      p_approve: Boolean(body.approve),
      p_supervisor: supervisor.id,
    });
    if (error) return fail(error.message, 500);
    const r = data as Rpc;
    return r.ok ? ok(r) : fail(rpcMessage(String(r.error)));
  }

  // ——— منح أو خصم نقاط يدويًا ———
  if (action === "adjust_points") {
    const { data, error } = await db.rpc("adjust_points", {
      p_competition: body.competition_id,
      p_team: body.team_id ?? null,
      p_student: body.student_id ?? null,
      p_team_delta: Number(body.team_delta ?? 0),
      p_student_delta: Number(body.student_delta ?? 0),
      p_reason: body.reason ?? null,
      p_supervisor: supervisor.id,
    });
    if (error) return fail(error.message, 500);
    return ok(data as Rpc);
  }

  // ——— قراءة إجابة أول ضاغط (لا يراها الطلاب) ———
  if (action === "read_answer") {
    const { data } = await db
      .from("answers")
      .select("text, option_id, submitted_at")
      .eq("buzz_id", body.buzz_id)
      .maybeSingle();
    return ok({ answer: data });
  }

  // ——— الإجابة الصحيحة المخزّنة للسؤال الحالي ———
  if (action === "reveal_correct") {
    const { data } = await db
      .from("questions")
      .select("correct_answer")
      .eq("id", body.question_id)
      .maybeSingle();
    return ok({ correct_answer: data?.correct_answer ?? null });
  }

  // ——— لافتة معروضة للطلاب ———
  if (action === "banner") {
    await db
      .from("competition_state")
      .update({ banner: body.text || null, updated_at: new Date().toISOString() })
      .eq("competition_id", body.competition_id);
    return ok();
  }

  // ——— سؤال كسر التعادل (Sudden Death) ———
  if (action === "sudden_death") {
    const { data: question, error } = await db
      .from("questions")
      .insert({
        competition_id: body.competition_id,
        order_index: 9999,
        type: body.type ?? "oral",
        text: String(body.text ?? "سؤال كسر التعادل"),
        correct_answer: body.correct_answer ?? null,
        points: Number(body.points ?? 0),
        time_limit: Number(body.time_limit ?? 15),
      })
      .select("id")
      .single();

    if (error) return fail(error.message, 500);

    const { data: started } = await db.rpc("start_question", {
      p_question: question.id,
      p_supervisor: supervisor.id,
      p_seconds: null,
    });

    await db
      .from("competition_state")
      .update({ banner: "⚡ سؤال كسر التعادل" })
      .eq("competition_id", body.competition_id);

    return ok(started as Rpc);
  }

  return fail("إجراء غير معروف");
});
