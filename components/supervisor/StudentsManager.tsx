"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import type { Student, Team } from "@/lib/types";

type CodeInfo = { code: string; enabled: boolean; bound: boolean };

interface Props {
  competitionId: string;
  initialStudents: Student[];
  teams: Team[];
  codes: Record<string, CodeInfo>;
}

export function StudentsManager({ competitionId, initialStudents, teams, codes }: Props) {
  const router = useRouter();
  const [students] = useState(initialStudents);
  const [search, setSearch] = useState("");
  const [bulk, setBulk] = useState("");
  const [newName, setNewName] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(body: Record<string, unknown>, success: string) {
    setBusy(true);
    const res = await api.students(body);
    setNote(res.ok ? success : (res.error ?? "تعذّر التنفيذ"));
    setBusy(false);
    if (res.ok) router.refresh();
  }

  const filtered = students.filter((s) => s.name.includes(search.trim()));
  const teamName = (id: string | null) => teams.find((t) => t.id === id);

  return (
    <main className="mx-auto max-w-6xl p-4">
      {/* الإضافة */}
      <section className="card mb-4 grid gap-4 p-4 md:grid-cols-2">
        <div>
          <label className="label">إضافة طالب</label>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم الطالب"
              className="input"
            />
            <button
              disabled={busy || !newName.trim()}
              onClick={async () => {
                await run({ action: "add", competition_id: competitionId, name: newName }, "أُضيف الطالب");
                setNewName("");
              }}
              className="btn shrink-0 bg-[var(--color-brand)] text-white"
            >
              إضافة
            </button>
          </div>
        </div>

        <div>
          <label className="label">إضافة دفعة (اسم في كل سطر)</label>
          <textarea
            value={bulk}
            onChange={(e) => setBulk(e.target.value)}
            rows={3}
            placeholder={"أحمد محمد\nمحمد أحمد\nخالد سعيد"}
            className="input"
          />
          <button
            disabled={busy || !bulk.trim()}
            onClick={async () => {
              await run({ action: "bulk_add", competition_id: competitionId, names: bulk }, "أُضيفت الدفعة");
              setBulk("");
            }}
            className="btn mt-2 w-full bg-[var(--color-brand)] text-white"
          >
            إضافة الدفعة
          </button>
        </div>
      </section>

      {/* أدوات */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 بحث عن طالب"
          className="input max-w-xs"
        />
        <button
          disabled={busy}
          onClick={() => run({ action: "auto_distribute", competition_id: competitionId }, "وُزّع الطلاب")}
          className="btn bg-[var(--color-gold)] text-sm text-black"
        >
          🔀 توزيع تلقائي على الفرق
        </button>
        <button onClick={() => window.print()} className="btn border border-[var(--color-line)] text-sm">
          🖨️ طباعة الأكواد
        </button>
        <span className="text-sm text-[var(--color-muted)]">
          العدد: {students.length}
        </span>
      </div>

      {note && (
        <p className="mb-3 rounded-xl bg-[var(--color-ink-3)] p-2 text-center text-sm font-bold">{note}</p>
      )}

      {/* الجدول */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[var(--color-line)] text-right text-xs text-[var(--color-muted)]">
            <tr>
              <th className="p-3">الاسم</th>
              <th className="p-3">الفريق</th>
              <th className="p-3">الكود</th>
              <th className="p-3">النقاط</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const info = codes[s.id];
              const team = teamName(s.team_id);
              return (
                <tr key={s.id} className="border-b border-[var(--color-line)]/40">
                  <td className="p-3 font-bold">
                    {s.name} {s.is_captain && "👑"}
                  </td>
                  <td className="p-3">
                    <select
                      value={s.team_id ?? ""}
                      onChange={(e) =>
                        run(
                          { action: "update", student_id: s.id, team_id: e.target.value || null },
                          "تم التعديل"
                        )
                      }
                      className="input px-2 py-1 text-xs"
                    >
                      <option value="">— بدون —</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>{t.emoji} {t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <span dir="ltr" className="rounded-lg bg-[var(--color-ink)] px-2 py-1 font-mono tracking-widest">
                      {info?.code ?? "—"}
                    </span>
                    {info?.bound && <span title="مرتبط بجهاز"> 📱</span>}
                  </td>
                  <td className="p-3 tabular-nums">{s.points}</td>
                  <td className="p-3">
                    {info?.enabled === false ? (
                      <span className="text-[var(--color-lose)]">معطّل</span>
                    ) : (
                      <span className="text-[var(--color-win)]">مفعّل</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      <Action onClick={() => run({ action: "set_captain", student_id: s.id }, "عُيّن قائدًا")}>
                        👑 قائد
                      </Action>
                      <Action onClick={() => run({ action: "regenerate_code", student_id: s.id }, "أُنشئ كود جديد")}>
                        🔁 كود
                      </Action>
                      <Action
                        onClick={() =>
                          run(
                            { action: "toggle_code", student_id: s.id, enabled: info?.enabled === false },
                            "تم التبديل"
                          )
                        }
                      >
                        {info?.enabled === false ? "✅ تفعيل" : "🚫 تعطيل"}
                      </Action>
                      <Action onClick={() => run({ action: "kick_device", student_id: s.id }, "طُرد الجهاز")}>
                        📴 طرد
                      </Action>
                      <Action
                        danger
                        onClick={() => {
                          if (confirm(`حذف ${s.name}؟`)) run({ action: "delete", student_id: s.id }, "حُذف");
                        }}
                      >
                        🗑️
                      </Action>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Action({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2 py-1 text-[11px] transition ${
        danger
          ? "border-[var(--color-lose)]/50 text-[var(--color-lose)]"
          : "border-[var(--color-line)] text-[var(--color-muted)] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
