import Link from "next/link";
import { admin } from "@/lib/database/admin";
import { getSupervisor } from "@/lib/auth/supervisor";
import { STATUS_LABEL } from "@/lib/format";
import { NewCompetition } from "@/components/supervisor/NewCompetition";
import { SignOutButton } from "@/components/supervisor/SignOutButton";
import type { Competition } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CompetitionsPage() {
  const supervisor = await getSupervisor();
  const { data } = await admin()
    .from("competitions")
    .select("*")
    .order("created_at", { ascending: false });

  const competitions = (data ?? []) as Competition[];
  const live = competitions.filter((c) => !["finished"].includes(c.status));
  const past = competitions.filter((c) => c.status === "finished");

  return (
    <main className="mx-auto max-w-4xl p-5">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black">🛡️ لوحة المشرف</h1>
          <p className="text-sm text-[var(--color-muted)]">{supervisor?.name}</p>
        </div>
        <SignOutButton />
      </header>

      <NewCompetition />

      <section className="mt-8">
        <h2 className="mb-3 font-bold">البطولات الحالية</h2>
        {live.length === 0 ? (
          <p className="card p-5 text-center text-sm text-[var(--color-muted)]">
            لا توجد بطولات. أنشئ واحدة للبدء.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {live.map((c) => (
              <CompetitionCard key={c.id} competition={c} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-bold">البطولات السابقة</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {past.map((c) => (
              <CompetitionCard key={c.id} competition={c} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function CompetitionCard({ competition }: { competition: Competition }) {
  return (
    <Link
      href={`/supervisor/${competition.id}`}
      className="card block p-4 transition hover:border-[var(--color-brand)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold">{competition.name}</span>
        <span className="shrink-0 rounded-lg bg-[var(--color-ink)] px-2 py-0.5 text-[11px] text-[var(--color-muted)]">
          {STATUS_LABEL[competition.status] ?? competition.status}
        </span>
      </div>
      <div className="mt-2 text-xs text-[var(--color-muted)]">
        {competition.event_date ?? "بدون تاريخ"}
        {competition.is_demo && " · وضع تجريبي"}
      </div>
    </Link>
  );
}
