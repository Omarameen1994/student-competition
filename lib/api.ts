import { NextResponse } from "next/server";

export function ok(data: unknown = {}) {
  return NextResponse.json({ ok: true, ...(data as object) });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** يغلّف معالج المسار ويحوّل أخطاء الصلاحيات إلى ردود صحيحة. */
export function handler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      const err = e as Error & { status?: number };
      return fail(err.message || "خطأ غير متوقع", err.status ?? 500);
    }
  };
}

/** رسائل عربية لأخطاء دوال قاعدة البيانات. */
export const RPC_ERRORS: Record<string, string> = {
  session_not_found: "لا يوجد سؤال نشط",
  buzzer_closed: "الـBuzzer مغلق الآن",
  time_up: "انتهى الوقت",
  already_answered: "لقد أجبت على هذا السؤال بالفعل",
  already_buzzed: "لقد ضغطت مسبقًا",
  student_not_active: "الحساب غير مفعّل",
  buzz_not_found: "الضغطة غير موجودة",
  already_judged: "تم اعتماد هذه الإجابة مسبقًا",
  bad_verdict: "قرار غير صالح",
  bad_action: "إجراء غير صالح",
  request_not_found: "الطلب غير موجود",
  already_decided: "تم البت في هذا الطلب مسبقًا",
  match_not_found: "المواجهة غير موجودة",
  winner_not_in_match: "الفائز ليس من أطراف المواجهة",
  not_enough_students: "عدد الطلاب غير كافٍ لإنشاء البطولة",
  question_not_found: "السؤال غير موجود",
};

export function rpcMessage(code: string): string {
  return RPC_ERRORS[code] ?? code;
}
