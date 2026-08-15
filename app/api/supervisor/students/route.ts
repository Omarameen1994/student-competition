import { admin } from "@/lib/database/admin";
import { requireSupervisor } from "@/lib/auth/supervisor";
import { ok, fail, handler } from "@/lib/api";

export const POST = handler(async (req) => {
  const supervisor = await requireSupervisor();
  const body = (await req.json()) as Record<string, any>;
  const action = String(body.action ?? "");
  const db = admin();

  // ——— إضافة طالب واحد ———
  if (action === "add") {
    const name = String(body.name ?? "").trim();
    if (!name) return fail("اكتب اسم الطالب");

    const { data: student, error } = await db
      .from("students")
      .insert({
        competition_id: body.competition_id,
        name,
        team_id: body.team_id ?? null,
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);
    const code = await issueCode(student.id);
    return ok({ student, code });
  }

  // ——— إضافة دفعة (اسم في كل سطر) ———
  if (action === "bulk_add") {
    const names = String(body.names ?? "")
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean);

    if (names.length === 0) return fail("أدخل أسماء الطلاب، اسمًا في كل سطر");

    const { data: students, error } = await db
      .from("students")
      .insert(names.map((name) => ({ competition_id: body.competition_id, name })))
      .select("id");

    if (error) return fail(error.message, 500);
    for (const s of students ?? []) await issueCode(s.id);

    return ok({ added: students?.length ?? 0 });
  }

  // ——— تعديل ———
  if (action === "update") {
    const patch: Record<string, unknown> = {};
    for (const key of ["name", "team_id", "active"]) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    const { error } = await db.from("students").update(patch).eq("id", body.student_id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  // ——— تعيين قائد (قائد واحد لكل فريق) ———
  if (action === "set_captain") {
    const { data: student } = await db
      .from("students")
      .select("id, team_id, name, competition_id")
      .eq("id", body.student_id)
      .single();

    if (!student?.team_id) return fail("عيّن الطالب في فريق أولًا");

    await db.from("students").update({ is_captain: false }).eq("team_id", student.team_id);
    const { error } = await db.from("students").update({ is_captain: true }).eq("id", student.id);
    if (error) return fail(error.message, 500);

    await db.from("events").insert({
      competition_id: student.competition_id,
      actor_type: "supervisor",
      actor_name: supervisor.name,
      type: "captain_set",
      message: `${student.name} أصبح قائد الفريق`,
    });

    return ok();
  }

  if (action === "delete") {
    const { error } = await db.from("students").delete().eq("id", body.student_id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  // ——— إعادة توليد الكود ———
  if (action === "regenerate_code") {
    const code = await issueCode(body.student_id, true);
    return ok({ code });
  }

  // ——— تعطيل/تفعيل الكود ———
  if (action === "toggle_code") {
    const { error } = await db
      .from("student_credentials")
      .update({ enabled: Boolean(body.enabled) })
      .eq("student_id", body.student_id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  // ——— طرد الجهاز: إبطال الجلسة الحالية وتحرير الكود لجهاز جديد ———
  if (action === "kick_device") {
    const { data: cred } = await db
      .from("student_credentials")
      .select("session_epoch")
      .eq("student_id", body.student_id)
      .single();

    const { error } = await db
      .from("student_credentials")
      .update({ session_epoch: (cred?.session_epoch ?? 1) + 1, device_id: null })
      .eq("student_id", body.student_id);

    if (error) return fail(error.message, 500);
    return ok();
  }

  // ——— التوزيع التلقائي بالتساوي (القسم 8) ———
  if (action === "auto_distribute") {
    const [{ data: students }, { data: teams }] = await Promise.all([
      db.from("students").select("id").eq("competition_id", body.competition_id).order("created_at"),
      db.from("teams").select("id").eq("competition_id", body.competition_id).order("sort_order"),
    ]);

    if (!teams?.length) return fail("أنشئ الفرق أولًا");
    if (!students?.length) return fail("لا يوجد طلاب");

    // خلط ثم توزيع دوري ⇒ فرق متساوية العدد
    const shuffled = [...students].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      await db
        .from("students")
        .update({ team_id: teams[i % teams.length].id })
        .eq("id", shuffled[i].id);
    }

    await db.from("events").insert({
      competition_id: body.competition_id,
      actor_type: "supervisor",
      actor_name: supervisor.name,
      type: "auto_distribute",
      message: `وُزّع ${shuffled.length} طالبًا على ${teams.length} فرق`,
    });

    return ok({ distributed: shuffled.length });
  }

  return fail("إجراء غير معروف");
});

/** ينشئ أو يجدّد كود دخول فريد للطالب. */
async function issueCode(studentId: string, regenerate = false): Promise<string> {
  const db = admin();
  const { data: code } = await db.rpc("generate_login_code");

  if (regenerate) {
    // زيادة الحقبة تُخرج الجهاز القديم فورًا
    const { data: cred } = await db
      .from("student_credentials")
      .select("session_epoch")
      .eq("student_id", studentId)
      .maybeSingle();

    await db
      .from("student_credentials")
      .update({
        login_code: code,
        device_id: null,
        enabled: true,
        session_epoch: (cred?.session_epoch ?? 1) + 1,
      })
      .eq("student_id", studentId);
  } else {
    await db.from("student_credentials").insert({ student_id: studentId, login_code: code });
  }

  return code as string;
}
