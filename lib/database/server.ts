import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/** عميل Supabase مرتبط بجلسة المشرف (Supabase Auth) داخل مكوّنات الخادم. */
export async function supabaseServer() {
  const store = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // استدعاء من Server Component — التحديث يتم في middleware
          }
        },
      },
    }
  );
}
