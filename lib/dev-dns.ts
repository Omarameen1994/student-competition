import dns from "node:dns";

/**
 * حل مؤقت لبيئة التطوير المحلية فقط.
 *
 * على بعض الشبكات تكون عناوين Cloudflare التي يعيدها DNS لنطاق ‎*.supabase.co
 * غير قابلة للوصول من Node (مهلة اتصال)، بينما تعمل عناوين أخرى في شبكة
 * Cloudflare نفسها ويخدم أيٌّ منها النطاق عبر SNI.
 *
 * عند ضبط SUPABASE_EDGE_IP نوجّه استعلامات DNS لهذا النطاق إلى ذلك العنوان.
 * لا يُفعَّل إطلاقًا إن لم يُضبط المتغيّر، فلا أثر له في الإنتاج (Vercel).
 */
export function applyDevDnsWorkaround() {
  const edgeIp = process.env.SUPABASE_EDGE_IP;
  if (!edgeIp) return;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return;

  let targetHost: string;
  try {
    targetHost = new URL(supabaseUrl).hostname;
  } catch {
    return;
  }

  const originalLookup = dns.lookup.bind(dns);

  // التوقيع متعدد الأشكال، لذا نتعامل مع الوسائط بشكل عام
  const patched = (
    hostname: string,
    options: unknown,
    callback?: (...args: unknown[]) => void
  ) => {
    const cb = (typeof options === "function" ? options : callback) as
      | ((...args: unknown[]) => void)
      | undefined;

    if (hostname !== targetHost || !cb) {
      return (originalLookup as unknown as (...a: unknown[]) => unknown)(
        hostname,
        options,
        callback
      );
    }

    const all =
      typeof options === "object" && options !== null && "all" in options
        ? Boolean((options as { all?: boolean }).all)
        : false;

    process.nextTick(() =>
      all ? cb(null, [{ address: edgeIp, family: 4 }]) : cb(null, edgeIp, 4)
    );
  };

  (dns as unknown as { lookup: unknown }).lookup = patched;
  console.log(`[dev-dns] ${targetHost} → ${edgeIp} (تجاوز محلي مفعّل)`);
}
