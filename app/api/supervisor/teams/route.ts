import { admin } from "@/lib/database/admin";
import { requireSupervisor } from "@/lib/auth/supervisor";
import { ok, fail, handler } from "@/lib/api";
import { syncTeamPowerups } from "@/lib/powerups";

export const POST = handler(async (req) => {
  await requireSupervisor();
  const body = (await req.json()) as Record<string, any>;
  const action = String(body.action ?? "");
  const db = admin();

  if (action === "add") {
    const { data, error } = await db
      .from("teams")
      .insert({
        competition_id: body.competition_id,
        name: String(body.name ?? "فريق جديد"),
        color: body.color ?? "#6366f1",
        emoji: body.emoji ?? "🟣",
        sort_order: Number(body.sort_order ?? 0),
      })
      .select("id")
      .single();

    if (error) return fail(error.message, 500);
    await syncTeamPowerups(body.competition_id);
    return ok({ id: data.id });
  }

  if (action === "update") {
    const patch: Record<string, unknown> = {};
    for (const key of ["name", "color", "emoji", "logo_url", "sort_order"]) {
      if (body[key] !== undefined) patch[key] = body[key];
    }
    const { error } = await db.from("teams").update(patch).eq("id", body.team_id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  if (action === "delete") {
    const { error } = await db.from("teams").delete().eq("id", body.team_id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  if (action === "reset_scores") {
    await db.from("teams").update({ score: 0 }).eq("competition_id", body.competition_id);
    await db
      .from("students")
      .update({ points: 0, correct_count: 0, wrong_count: 0, buzz_count: 0, total_reaction_ms: 0 })
      .eq("competition_id", body.competition_id);
    return ok();
  }

  return fail("إجراء غير معروف");
});
