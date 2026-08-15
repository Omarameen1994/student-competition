import "server-only";
import { cache } from "react";
import { admin } from "@/lib/database/admin";
import type { Competition } from "@/lib/types";

/**
 * جلب البطولة مرة واحدة لكل طلب.
 * التخطيط والصفحة يحتاجانها معًا، وبدون cache تُنفَّذ رحلتان للشبكة بلا داعٍ.
 */
export const getCompetition = cache(async function getCompetition(
  id: string
): Promise<Competition | null> {
  const { data } = await admin().from("competitions").select("*").eq("id", id).maybeSingle();
  return (data as Competition) ?? null;
});
