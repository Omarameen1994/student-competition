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
    const { error } = await db.from("powerups").insert({
      competition_id: body.competition_id,
      key: String(body.key ?? "").trim() || `custom_${Date.now()}`,
      name: String(body.name ?? "قدرة جديدة"),
      description: body.description ?? "",
      icon: body.icon ?? "✨",
      unlock_points: Number(body.unlock_points ?? 100),
      max_uses: Number(body.max_uses ?? 1),
      requires_approval: body.requires_approval ?? true,
      applies_to: body.applies_to ?? "next",
      sort_order: Number(body.sort_order ?? 99),
    });
    if (error) return fail(error.message, 500);

    await syncTeamPowerups(body.competition_id);
    return ok();
  }

  if (action === "update") {
    const patch: Record<string, unknown> = {};
    for (const key of [
      "name", "description", "icon", "unlock_points",
      "max_uses", "requires_approval", "applies_to", "enabled",
    ]) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    const { error } = await db.from("powerups").update(patch).eq("id", body.powerup_id);
    if (error) return fail(error.message, 500);

    // مزامنة عدد الاستخدامات المتبقية إن تغيّر الحد
    if (body.max_uses !== undefined) {
      await db
        .from("team_powerups")
        .update({ uses_left: Number(body.max_uses) })
        .eq("powerup_id", body.powerup_id)
        .eq("used_count", 0);
    }

    if (body.competition_id) {
      await db.rpc("refresh_powerup_unlocks", { p_competition: body.competition_id });
    }
    return ok();
  }

  if (action === "delete") {
    const { error } = await db.from("powerups").delete().eq("id", body.powerup_id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  // ——— فتح/إغلاق قدرة لفريق يدويًا (القسم 2) ———
  if (action === "set_team_powerup") {
    const patch: Record<string, unknown> = {};
    for (const key of ["unlocked", "armed", "uses_left"]) {
      if (body[key] !== undefined) patch[key] = body[key];
    }

    const { error } = await db
      .from("team_powerups")
      .update(patch)
      .eq("team_id", body.team_id)
      .eq("powerup_id", body.powerup_id);

    if (error) return fail(error.message, 500);
    return ok();
  }

  if (action === "sync") {
    await syncTeamPowerups(body.competition_id);
    return ok();
  }

  return fail("إجراء غير معروف");
});
