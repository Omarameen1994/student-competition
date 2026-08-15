"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/**
 * عميل المتصفح بمفتاح anon — للقراءة والاشتراك في Realtime فقط.
 * لا يكتب أي شيء حساس: كل الكتابات تمر عبر /api على الخادم.
 */
export function supabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  cached = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  return cached;
}
