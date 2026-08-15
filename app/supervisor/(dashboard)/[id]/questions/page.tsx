import { admin } from "@/lib/database/admin";
import { QuestionsManager } from "@/components/supervisor/QuestionsManager";
import type { Question, QuestionOption, Competition } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function QuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = admin();

  const [{ data: questions }, { data: options }, { data: competition }] = await Promise.all([
    db.from("questions").select("*").eq("competition_id", id).order("order_index"),
    db.from("question_options").select("*").order("order_index"),
    db.from("competitions").select("*").eq("id", id).single(),
  ]);

  return (
    <QuestionsManager
      competitionId={id}
      settings={(competition as Competition).settings}
      initialQuestions={(questions ?? []) as Question[]}
      allOptions={(options ?? []) as QuestionOption[]}
    />
  );
}
