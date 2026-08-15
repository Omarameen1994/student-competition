import { admin } from "@/lib/database/admin";
import { requireSupervisor } from "@/lib/auth/supervisor";
import { ok, fail, handler } from "@/lib/api";
import { syncTeamPowerups } from "@/lib/powerups";

const DEFAULT_TEAMS = [
  { name: "الفريق الأحمر", color: "#ef4444", emoji: "🔴" },
  { name: "الفريق الأزرق", color: "#3b82f6", emoji: "🔵" },
  { name: "الفريق الأخضر", color: "#22c55e", emoji: "🟢" },
  { name: "الفريق الأصفر", color: "#eab308", emoji: "🟡" },
];

const DEFAULT_POWERUPS = [
  { key: "double", name: "مضاعفة النقاط", icon: "⚡", unlock_points: 100, description: "يتضاعف السؤال القادم", sort_order: 1 },
  { key: "skip",   name: "تخطّي السؤال",  icon: "⏭️", unlock_points: 200, description: "إلغاء السؤال الحالي", sort_order: 2, applies_to: "current" },
  { key: "shield", name: "الدرع",         icon: "🛡️", unlock_points: 300, description: "حماية من الخصم", sort_order: 3 },
];

export const POST = handler(async (req) => {
  const supervisor = await requireSupervisor();
  const body = (await req.json()) as Record<string, unknown>;
  const action = body.action as string;
  const db = admin();

  if (action === "create") {
    const name = String(body.name ?? "").trim();
    if (!name) return fail("اكتب اسم البطولة");

    const teamsCount = Math.min(4, Math.max(2, Number(body.teams_count ?? 2)));

    const { data: competition, error } = await db
      .from("competitions")
      .insert({
        name,
        event_date: body.event_date ?? null,
        is_demo: Boolean(body.is_demo),
        created_by: supervisor.id,
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 500);

    await db
      .from("competitions")
      .update({ settings: { ...competition.settings, teams_count: teamsCount } })
      .eq("id", competition.id);

    await db.from("teams").insert(
      DEFAULT_TEAMS.slice(0, teamsCount).map((t, i) => ({
        ...t,
        competition_id: competition.id,
        sort_order: i,
      }))
    );

    await db.from("powerups").insert(
      DEFAULT_POWERUPS.map((p) => ({ ...p, competition_id: competition.id }))
    );

    await db.from("competition_state").insert({ competition_id: competition.id });
    await syncTeamPowerups(competition.id);

    await db.from("events").insert({
      competition_id: competition.id,
      actor_type: "supervisor",
      actor_name: supervisor.name,
      type: "competition_created",
      message: `أُنشئت بطولة ${name}`,
    });

    return ok({ id: competition.id });
  }

  const competitionId = String(body.competition_id ?? "");
  if (!competitionId) return fail("البطولة غير محددة");

  if (action === "update") {
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.event_date !== undefined) patch.event_date = body.event_date;
    if (body.status !== undefined) patch.status = body.status;

    if (body.settings !== undefined) {
      const { data: current } = await db
        .from("competitions")
        .select("settings")
        .eq("id", competitionId)
        .single();
      patch.settings = { ...current?.settings, ...(body.settings as object) };
    }

    const { error } = await db.from("competitions").update(patch).eq("id", competitionId);
    if (error) return fail(error.message, 500);

    await db.from("events").insert({
      competition_id: competitionId,
      actor_type: "supervisor",
      actor_name: supervisor.name,
      type: "competition_updated",
      message: body.status ? `تغيّرت حالة البطولة إلى ${body.status}` : "عُدّلت إعدادات البطولة",
      payload: patch,
    });

    return ok();
  }

  if (action === "delete") {
    const { error } = await db.from("competitions").delete().eq("id", competitionId);
    if (error) return fail(error.message, 500);
    return ok();
  }

  return fail("إجراء غير معروف");
});
