import "server-only";
import { cache } from "react";
import { supabaseServer } from "@/lib/database/server";
import { admin } from "@/lib/database/admin";

export interface SupervisorIdentity {
  id: string;
  name: string;
  email: string;
}

/**
 * يعيد هوية المشرف الحالي، أو null إن لم يكن مسجّل دخول أو ليس مشرفًا.
 *
 * مغلَّفة بـcache() لأن التخطيط والصفحة يستدعيانها في الطلب نفسه،
 * فتُنفَّذ رحلة الشبكة مرة واحدة بدل مرتين.
 */
export const getSupervisor = cache(async function getSupervisor(): Promise<SupervisorIdentity | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // التحقق من العضوية في جدول المشرفين — وجود حساب Auth وحده لا يكفي
  const { data: row } = await admin()
    .from("supervisors")
    .select("id, name")
    .eq("id", user.id)
    .maybeSingle();

  if (!row) return null;
  return { id: row.id, name: row.name, email: user.email ?? "" };
});

/** يرمي 403 إن لم يكن الطالب الحالي مشرفًا — يُستدعى في كل مسار إداري. */
export async function requireSupervisor(): Promise<SupervisorIdentity> {
  const supervisor = await getSupervisor();
  if (!supervisor) {
    throw Object.assign(new Error("هذه العملية للمشرفين فقط"), { status: 403 });
  }
  return supervisor;
}
