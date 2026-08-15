import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompetition } from "@/lib/competition";
import { STATUS_LABEL } from "@/lib/format";
import { SignOutButton } from "@/components/supervisor/SignOutButton";

export const dynamic = "force-dynamic";

const TABS = [
  { href: "", label: "🎛️ الغرفة المباشرة" },
  { href: "/questions", label: "❓ الأسئلة" },
  { href: "/students", label: "👥 الطلاب" },
  { href: "/teams", label: "🚩 الفرق" },
  { href: "/powerups", label: "⚡ القدرات" },
  { href: "/knockout", label: "🏆 خروج المغلوب" },
  { href: "/settings", label: "⚙️ الإعدادات" },
  { href: "/reports", label: "📊 التقارير" },
];

export default async function CompetitionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const competition = await getCompetition(id);
  if (!competition) notFound();

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-[var(--color-line)] bg-[var(--color-ink)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/supervisor" className="text-[var(--color-muted)]">
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="truncate font-black">🏆 {competition.name}</h1>
              <span className="text-xs text-[var(--color-muted)]">
                {STATUS_LABEL[competition.status] ?? competition.status}
              </span>
            </div>
          </div>
          <SignOutButton />
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-3 pb-2">
          {TABS.map((tab) => (
            <Link
              key={tab.href}
              href={`/supervisor/${id}${tab.href}`}
              className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-[var(--color-muted)] transition hover:bg-[var(--color-ink-3)] hover:text-white"
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      {children}
    </div>
  );
}
