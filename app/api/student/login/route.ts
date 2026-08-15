import { admin } from "@/lib/database/admin";
import { setStudentCookie, sessionExpiry } from "@/lib/auth/student-session";
import { ok, fail, handler } from "@/lib/api";

export const POST = handler(async (req) => {
  const { code, device_id } = (await req.json()) as { code?: string; device_id?: string };
  const clean = (code ?? "").trim().toUpperCase();
  if (clean.length < 3) return fail("أدخل كودًا صحيحًا");

  const db = admin();

  const { data: cred } = await db
    .from("student_credentials")
    .select("student_id, enabled, device_id, session_epoch")
    .eq("login_code", clean)
    .maybeSingle();

  if (!cred) return fail("الكود غير صحيح");
  if (!cred.enabled) return fail("هذا الكود معطّل. راجع المشرف");

  const { data: student } = await db
    .from("students")
    .select("id, name, competition_id, active")
    .eq("id", cred.student_id)
    .maybeSingle();

  if (!student || !student.active) return fail("الحساب غير مفعّل. راجع المشرف");

  const { data: competition } = await db
    .from("competitions")
    .select("settings")
    .eq("id", student.competition_id)
    .maybeSingle();

  const singleDevice = competition?.settings?.single_device_per_code ?? true;
  if (singleDevice && cred.device_id && device_id && cred.device_id !== device_id) {
    return fail("هذا الكود مستخدم على جهاز آخر. راجع المشرف");
  }

  await db
    .from("student_credentials")
    .update({ device_id: device_id ?? cred.device_id, last_seen_at: new Date().toISOString() })
    .eq("student_id", student.id);

  await setStudentCookie({
    sid: student.id,
    cid: student.competition_id,
    epoch: cred.session_epoch,
    exp: sessionExpiry(),
  });

  await db.from("events").insert({
    competition_id: student.competition_id,
    actor_type: "student",
    actor_name: student.name,
    type: "student_login",
    message: `${student.name} دخل المنصة`,
  });

  return ok({ name: student.name });
});
