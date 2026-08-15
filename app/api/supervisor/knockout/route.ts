import { admin } from "@/lib/database/admin";
import { requireSupervisor } from "@/lib/auth/supervisor";
import { ok, fail, handler, rpcMessage } from "@/lib/api";

type Rpc = { ok: boolean; error?: string } & Record<string, unknown>;

export const POST = handler(async (req) => {
  const supervisor = await requireSupervisor();
  const body = (await req.json()) as Record<string, any>;
  const action = String(body.action ?? "");
  const db = admin();

  // ——— إنهاء مرحلة الفرق وتحديد الفريق الفائز (القسم 25) ———
  if (action === "finish_team_stage") {
    const { data, error } = await db.rpc("finish_team_stage", {
      p_competition: body.competition_id,
      p_supervisor: supervisor.id,
    });
    if (error) return fail(error.message, 500);
    return ok(data as Rpc);
  }

  // ——— إنشاء شجرة خروج المغلوب تلقائيًا (القسم 26) ———
  if (action === "build") {
    let teamId = body.team_id as string | undefined;

    if (!teamId) {
      const { data: winner } = await db
        .from("teams")
        .select("id")
        .eq("competition_id", body.competition_id)
        .order("score", { ascending: false })
        .limit(1)
        .maybeSingle();
      teamId = winner?.id;
    }

    if (!teamId) return fail("لا يوجد فريق فائز");

    const { data, error } = await db.rpc("build_knockout", {
      p_competition: body.competition_id,
      p_team: teamId,
      p_seeding: body.seeding ?? null,
    });
    if (error) return fail(error.message, 500);

    const r = data as Rpc;
    return r.ok ? ok(r) : fail(rpcMessage(String(r.error)));
  }

  // ——— اعتماد فائز مواجهة والترقية التلقائية (القسم 29) ———
  if (action === "decide_match") {
    const { data, error } = await db.rpc("decide_match", {
      p_match: body.match_id,
      p_winner: body.winner_id,
      p_supervisor: supervisor.id,
    });
    if (error) return fail(error.message, 500);

    const r = data as Rpc;
    return r.ok ? ok(r) : fail(rpcMessage(String(r.error)));
  }

  // ——— بدء مواجهة (لعرضها كمباراة جارية) ———
  if (action === "set_match_status") {
    const { error } = await db
      .from("matches")
      .update({ status: body.status })
      .eq("id", body.match_id);
    if (error) return fail(error.message, 500);
    return ok();
  }

  return fail("إجراء غير معروف");
});
