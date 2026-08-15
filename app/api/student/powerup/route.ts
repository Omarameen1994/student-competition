import { admin } from "@/lib/database/admin";
import { requireStudent } from "@/lib/auth/student-session";
import { ok, fail, handler } from "@/lib/api";

export const POST = handler(async (req) => {
  const student = await requireStudent();

  // القدرات حكر على القائد (القسم 18)
  if (!student.is_captain) return fail("القدرات متاحة لقائد الفريق فقط", 403);
  if (!student.team_id) return fail("لست ضمن فريق");

  const { powerup_id } = (await req.json()) as { powerup_id?: string };
  if (!powerup_id) return fail("قدرة غير محددة");

  const db = admin();

  const { data: powerup } = await db
    .from("powerups")
    .select("*")
    .eq("id", powerup_id)
    .eq("competition_id", student.competition_id)
    .maybeSingle();

  if (!powerup || !powerup.enabled) return fail("هذه القدرة غير متاحة");

  const { data: tp } = await db
    .from("team_powerups")
    .select("*")
    .eq("team_id", student.team_id)
    .eq("powerup_id", powerup_id)
    .maybeSingle();

  if (!tp) return fail("هذه القدرة غير متاحة لفريقك");
  if (!tp.unlocked) return fail("لم تُفتح هذه القدرة بعد");
  if (tp.uses_left <= 0) return fail("استُهلكت هذه القدرة");
  if (tp.armed) return fail("القدرة مفعّلة بالفعل وتنتظر التطبيق");

  const { data: existing } = await db
    .from("powerup_requests")
    .select("id")
    .eq("team_id", student.team_id)
    .eq("powerup_id", powerup_id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) return fail("طلبك قيد المراجعة لدى المشرف");

  // بدون موافقة المشرف؟ نفعّلها مباشرة حسب إعداد القدرة
  if (!powerup.requires_approval) {
    await db.from("team_powerups").update({ armed: true }).eq("id", tp.id);
  } else {
    await db.from("powerup_requests").insert({
      competition_id: student.competition_id,
      team_id: student.team_id,
      powerup_id,
      requested_by: student.id,
    });
  }

  await db.from("events").insert({
    competition_id: student.competition_id,
    actor_type: "student",
    actor_name: student.name,
    type: "powerup_requested",
    message: `قائد الفريق طلب استخدام ${powerup.name}`,
    payload: { powerup_id },
  });

  return ok({ requires_approval: powerup.requires_approval });
});
