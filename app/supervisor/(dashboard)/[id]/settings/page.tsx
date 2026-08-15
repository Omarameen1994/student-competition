import { admin } from "@/lib/database/admin";
import { SettingsManager } from "@/components/supervisor/SettingsManager";
import type { Competition } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data } = await admin().from("competitions").select("*").eq("id", id).single();

  return <SettingsManager competition={data as Competition} />;
}
