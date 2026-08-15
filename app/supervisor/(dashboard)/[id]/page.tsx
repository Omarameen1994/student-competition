import { notFound } from "next/navigation";
import { getCompetition } from "@/lib/competition";
import { ControlRoom } from "@/components/supervisor/ControlRoom";

export const dynamic = "force-dynamic";

export default async function ControlRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const competition = await getCompetition(id);
  if (!competition) notFound();

  return <ControlRoom competition={competition} />;
}
