"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";

export function NewCompetition() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [teams, setTeams] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);

    const res = await api.competition({
      action: "create",
      name,
      event_date: date || null,
      teams_count: teams,
    });

    if (!res.ok) {
      setError(res.error ?? "تعذّر الإنشاء");
      setBusy(false);
      return;
    }
    router.push(`/supervisor/${res.id}`);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn w-full bg-[var(--color-brand)] py-3 text-white">
        ➕ بطولة جديدة
      </button>
    );
  }

  return (
    <div className="card flex flex-col gap-3 p-5">
      <div>
        <label className="label">اسم البطولة</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="دوري أبطال المعرفة"
          className="input"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">التاريخ</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">عدد الفرق</label>
          <select value={teams} onChange={(e) => setTeams(Number(e.target.value))} className="input">
            {[2, 3, 4].map((n) => (
              <option key={n} value={n}>{n} فرق</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm font-bold text-[var(--color-lose)]">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="btn flex-1 bg-[var(--color-win)] text-white"
        >
          {busy ? "…" : "إنشاء"}
        </button>
        <button onClick={() => setOpen(false)} className="btn border border-[var(--color-line)]">
          إلغاء
        </button>
      </div>
    </div>
  );
}
