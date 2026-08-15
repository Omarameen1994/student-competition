import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * عميل بمفتاح الخدمة — يتجاوز RLS.
 * يُستخدم على الخادم فقط، وبعد التحقق اليدوي من الصلاحيات في كل مرة.
 * لا يجوز استيراده من أي مكوّن يعمل في المتصفح.
 */
export function admin(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "مفاتيح Supabase غير مضبوطة. أضف NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في .env.local"
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
