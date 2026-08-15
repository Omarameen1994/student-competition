import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * وقت الخادم — تستخدمه الأجهزة لمعايرة فارق الساعة،
 * حتى يعرض المؤقت نفس القيمة على كل الأجهزة (القسم 49).
 */
export function GET() {
  return NextResponse.json({ now: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
