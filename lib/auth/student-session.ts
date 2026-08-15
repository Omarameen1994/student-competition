import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { admin } from "@/lib/database/admin";
import type { StudentSession, Student } from "@/lib/types";

export const STUDENT_COOKIE = "sc_student";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 ساعة تكفي ليوم البطولة

function secret(): string {
  const s = process.env.STUDENT_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("STUDENT_SESSION_SECRET غير مضبوط (يجب أن يكون نصًا عشوائيًا طويلًا)");
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(data: StudentSession): string {
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string): StudentSession | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = sign(body);
  // مقارنة ثابتة الزمن لمنع تسريب التوقيع
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString()) as StudentSession;
    if (!data.sid || !data.cid || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function setStudentCookie(data: StudentSession) {
  const store = await cookies();
  store.set(STUDENT_COOKIE, encodeSession(data), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearStudentCookie() {
  const store = await cookies();
  store.delete(STUDENT_COOKIE);
}

export function sessionExpiry(): number {
  return Date.now() + MAX_AGE_SECONDS * 1000;
}

/**
 * يتحقق من جلسة الطالب مقابل قاعدة البيانات في كل طلب حسّاس.
 * التحقق من session_epoch يسمح للمشرف بطرد جهاز الطالب فورًا (القسم 37).
 */
export async function getStudent(): Promise<Student | null> {
  const store = await cookies();
  const token = store.get(STUDENT_COOKIE)?.value;
  if (!token) return null;

  const session = decodeSession(token);
  if (!session) return null;

  const db = admin();
  const { data: cred } = await db
    .from("student_credentials")
    .select("student_id, enabled, session_epoch")
    .eq("student_id", session.sid)
    .maybeSingle();

  if (!cred || !cred.enabled || cred.session_epoch !== session.epoch) return null;

  const { data: student } = await db
    .from("students")
    .select("*")
    .eq("id", session.sid)
    .maybeSingle();

  if (!student || !student.active) return null;
  return student as Student;
}

/** يرمي خطأ 401 إن لم تكن الجلسة صالحة — للاستخدام في مسارات API. */
export async function requireStudent(): Promise<Student> {
  const student = await getStudent();
  if (!student) {
    throw Object.assign(new Error("جلسة الطالب غير صالحة"), { status: 401 });
  }
  return student;
}
