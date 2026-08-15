import Link from "next/link";

/**
 * زر الرجوع إلى الصفحة الرئيسية في صفحات الدخول.
 * يستخدم start-4 (لا right-4) ليبقى في بداية السطر مع اتجاه RTL.
 */
export function BackHome() {
  return (
    <Link
      href="/"
      className="absolute start-4 top-4 flex items-center gap-1.5 rounded-xl border border-[var(--color-line)]
                 px-3 py-2 text-sm text-[var(--color-muted)] transition
                 hover:border-[var(--color-brand)] hover:text-white active:scale-95"
    >
      <span aria-hidden="true" className="text-base leading-none">
        →
      </span>
      الرئيسية
    </Link>
  );
}
