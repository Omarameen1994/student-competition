"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import { QUESTION_TYPE_LABEL } from "@/lib/format";
import type { Question, QuestionOption, QuestionType, Settings } from "@/lib/types";

interface Props {
  competitionId: string;
  settings: Settings;
  initialQuestions: Question[];
  allOptions: QuestionOption[];
}

const EMPTY = {
  type: "oral" as QuestionType,
  text: "",
  media_url: "",
  correct_answer: "",
  points: 10,
  time_limit: 15,
  is_golden: false,
  options: ["", "", "", ""],
  correct_index: 0,
};

export function QuestionsManager({ competitionId, settings, initialQuestions, allOptions }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    ...EMPTY,
    points: settings.default_points,
    time_limit: settings.question_seconds,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setBusy(true);

    const options =
      form.type === "multiple_choice"
        ? form.options
            .map((label, i) => ({ label, is_correct: i === form.correct_index }))
            .filter((o) => o.label.trim())
        : [];

    const res = await api.questions({
      action: editing ? "update" : "add",
      competition_id: competitionId,
      question_id: editing,
      type: form.type,
      text: form.text,
      media_url: form.media_url || null,
      correct_answer:
        form.type === "multiple_choice"
          ? form.options[form.correct_index]
          : form.correct_answer,
      points: form.points,
      time_limit: form.time_limit,
      is_golden: form.is_golden,
      options,
    });

    setNote(res.ok ? (editing ? "حُفظ التعديل" : "أُضيف السؤال") : (res.error ?? "تعذّر الحفظ"));
    setBusy(false);

    if (res.ok) {
      setForm({ ...EMPTY, points: settings.default_points, time_limit: settings.question_seconds });
      setEditing(null);
      router.refresh();
    }
  }

  function edit(q: Question) {
    const opts = allOptions.filter((o) => o.question_id === q.id);
    setEditing(q.id);
    setForm({
      type: q.type,
      text: q.text,
      media_url: q.media_url ?? "",
      correct_answer: q.correct_answer ?? "",
      points: q.points,
      time_limit: q.time_limit,
      is_golden: q.is_golden,
      options: [0, 1, 2, 3].map((i) => opts[i]?.label ?? ""),
      correct_index: Math.max(0, opts.findIndex((o) => o.is_correct)),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[22rem_1fr]">
      {/* النموذج */}
      <section className="card h-fit p-4">
        <h2 className="mb-3 font-bold">{editing ? "تعديل السؤال" : "➕ سؤال جديد"}</h2>

        <div className="flex flex-col gap-3">
          <div>
            <label className="label">نوع السؤال</label>
            <select
              value={form.type}
              onChange={(e) => set("type", e.target.value as QuestionType)}
              className="input"
            >
              {Object.entries(QUESTION_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">نص السؤال</label>
            <textarea
              value={form.text}
              onChange={(e) => set("text", e.target.value)}
              rows={3}
              className="input"
            />
          </div>

          {["image", "audio", "video"].includes(form.type) && (
            <div>
              <label className="label">رابط الملف</label>
              <input
                value={form.media_url}
                onChange={(e) => set("media_url", e.target.value)}
                dir="ltr"
                placeholder="https://…"
                className="input"
              />
            </div>
          )}

          {form.type === "multiple_choice" ? (
            <div>
              <label className="label">الخيارات (اختر الصحيح)</label>
              <div className="flex flex-col gap-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={form.correct_index === i}
                      onChange={() => set("correct_index", i)}
                      className="size-4 accent-[var(--color-win)]"
                    />
                    <input
                      value={opt}
                      onChange={(e) => {
                        const next = [...form.options];
                        next[i] = e.target.value;
                        set("options", next);
                      }}
                      placeholder={`الخيار ${i + 1}`}
                      className="input py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="label">الإجابة الصحيحة (للمشرف فقط)</label>
              <input
                value={form.correct_answer}
                onChange={(e) => set("correct_answer", e.target.value)}
                className="input"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">النقاط</label>
              <input
                type="number"
                value={form.points}
                onChange={(e) => set("points", Number(e.target.value))}
                className="input"
              />
            </div>
            <div>
              <label className="label">الوقت (ثانية)</label>
              <select
                value={form.time_limit}
                onChange={(e) => set("time_limit", Number(e.target.value))}
                className="input"
              >
                {[10, 15, 20, 30, 45, 60, 90, 120].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_golden}
              onChange={(e) => set("is_golden", e.target.checked)}
              className="size-4 accent-[var(--color-gold)]"
            />
            ⭐ سؤال ذهبي
          </label>

          {note && <p className="text-center text-sm font-bold">{note}</p>}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={busy || !form.text.trim()}
              className="btn flex-1 bg-[var(--color-win)] text-white"
            >
              {editing ? "حفظ التعديل" : "إضافة"}
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(null);
                  setForm({ ...EMPTY, points: settings.default_points, time_limit: settings.question_seconds });
                }}
                className="btn border border-[var(--color-line)]"
              >
                إلغاء
              </button>
            )}
          </div>
        </div>
      </section>

      {/* القائمة */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-bold">الأسئلة ({initialQuestions.length})</h2>
          <button
            onClick={async () => {
              await api.questions({ action: "reset_asked", competition_id: competitionId });
              router.refresh();
            }}
            className="btn border border-[var(--color-line)] text-xs"
          >
            🔄 إعادة تعيين "طُرح"
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {initialQuestions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-[var(--color-line)] p-3">
              <div className="flex items-start gap-3">
                <span className="text-sm text-[var(--color-muted)]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {q.is_golden && "⭐ "}
                    {q.text}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-muted)]">
                    {QUESTION_TYPE_LABEL[q.type]} · {q.points} نقطة · {q.time_limit} ثانية
                    {q.correct_answer && ` · الإجابة: ${q.correct_answer}`}
                    {q.asked && " · طُرح ✔️"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => edit(q)}
                    className="rounded-lg border border-[var(--color-line)] px-2 py-1 text-xs"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("حذف السؤال؟")) return;
                      await api.questions({ action: "delete", question_id: q.id });
                      router.refresh();
                    }}
                    className="rounded-lg border border-[var(--color-lose)]/50 px-2 py-1 text-xs text-[var(--color-lose)]"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}

          {initialQuestions.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--color-muted)]">لا توجد أسئلة بعد</p>
          )}
        </div>
      </section>
    </main>
  );
}
