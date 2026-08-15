import { admin } from "@/lib/database/admin";
import { requireSupervisor } from "@/lib/auth/supervisor";
import { ok, fail, handler } from "@/lib/api";

const DEMO_NAMES = [
  "أحمد محمد", "محمد أحمد", "خالد سعيد", "عبدالله ناصر", "يوسف علي",
  "ياسر فهد", "وليد سالم", "ماجد راشد", "معاذ حسن", "عمر طارق",
];

const DEMO_QUESTIONS = [
  { text: "ما هي السورة التي تسمى قلب القرآن؟", correct_answer: "سورة يس", type: "oral", points: 10, time_limit: 15 },
  { text: "من هو القائد الملقب بسيف الله المسلول؟", correct_answer: "خالد بن الوليد", type: "short_answer", points: 10, time_limit: 15 },
  { text: "كم عدد أركان الإسلام؟", correct_answer: "خمسة", type: "short_answer", points: 5, time_limit: 10 },
  { text: "عاصمة المملكة العربية السعودية هي الرياض.", correct_answer: "صح", type: "true_false", points: 5, time_limit: 10 },
  { text: "أطول نهر في العالم؟", correct_answer: "النيل", type: "multiple_choice", points: 20, time_limit: 20,
    options: ["النيل", "الأمازون", "الفرات", "دجلة"] },
  { text: "السؤال الذهبي: كم عدد حروف اللغة العربية؟", correct_answer: "28", type: "short_answer", points: 50, time_limit: 30 },
];

export const POST = handler(async (req) => {
  await requireSupervisor();
  const body = (await req.json()) as Record<string, any>;
  const action = String(body.action ?? "");
  const competitionId = String(body.competition_id ?? "");
  const db = admin();

  if (!competitionId) return fail("البطولة غير محددة");

  // ——— تعبئة بيانات تجريبية (القسم 44) ———
  if (action === "seed") {
    const { data: teams } = await db
      .from("teams")
      .select("id")
      .eq("competition_id", competitionId)
      .order("sort_order");

    if (!teams?.length) return fail("أنشئ الفرق أولًا");

    const { data: students } = await db
      .from("students")
      .insert(
        DEMO_NAMES.map((name, i) => ({
          competition_id: competitionId,
          name: `${name} (تجريبي)`,
          team_id: teams[i % teams.length].id,
        }))
      )
      .select("id, team_id");

    const codes: { name: string; code: string }[] = [];
    for (const [i, s] of (students ?? []).entries()) {
      const { data: code } = await db.rpc("generate_login_code");
      await db.from("student_credentials").insert({ student_id: s.id, login_code: code });
      codes.push({ name: DEMO_NAMES[i], code: code as string });
    }

    // قائد لكل فريق: أول طالب فيه
    for (const team of teams) {
      const first = students?.find((s) => s.team_id === team.id);
      if (first) await db.from("students").update({ is_captain: true }).eq("id", first.id);
    }

    const { data: lastQ } = await db
      .from("questions")
      .select("order_index")
      .eq("competition_id", competitionId)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();

    let order = (lastQ?.order_index ?? 0) + 1;
    for (const q of DEMO_QUESTIONS) {
      const { data: inserted } = await db
        .from("questions")
        .insert({
          competition_id: competitionId,
          order_index: order++,
          type: q.type,
          text: q.text,
          correct_answer: q.correct_answer,
          points: q.points,
          time_limit: q.time_limit,
          is_golden: q.points >= 50,
        })
        .select("id")
        .single();

      if (inserted && q.options) {
        await db.from("question_options").insert(
          q.options.map((label, i) => ({
            question_id: inserted.id,
            label,
            is_correct: label === q.correct_answer,
            order_index: i,
          }))
        );
      }
    }

    await db.from("competitions").update({ is_demo: true }).eq("id", competitionId);
    await db.rpc("refresh_powerup_unlocks", { p_competition: competitionId });

    return ok({ students: students?.length ?? 0, questions: DEMO_QUESTIONS.length, codes });
  }

  // ——— حذف بيانات التجربة قبل البطولة الحقيقية ———
  if (action === "clear") {
    const { data: demoStudents } = await db
      .from("students")
      .select("id")
      .eq("competition_id", competitionId)
      .like("name", "%(تجريبي)%");

    if (demoStudents?.length) {
      await db.from("students").delete().in("id", demoStudents.map((s) => s.id));
    }

    await db.from("teams").update({ score: 0 }).eq("competition_id", competitionId);
    await db.from("questions").update({ asked: false }).eq("competition_id", competitionId);
    await db.from("events").delete().eq("competition_id", competitionId);
    await db.from("score_events").delete().eq("competition_id", competitionId);
    await db.from("rounds").delete().eq("competition_id", competitionId);
    await db
      .from("competition_state")
      .update({
        phase: "idle",
        session_id: null,
        question_public: null,
        first_buzz: null,
        buzzer_open: false,
        banner: null,
      })
      .eq("competition_id", competitionId);

    await db
      .from("competitions")
      .update({ status: "draft", is_demo: false, finished_at: null })
      .eq("id", competitionId);

    return ok({ removed: demoStudents?.length ?? 0 });
  }

  return fail("إجراء غير معروف");
});
