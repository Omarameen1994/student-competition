"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/apiClient";
import type { Competition, Settings } from "@/lib/types";

/**
 * كل قاعدة قابلة للتغيير تُدار من هنا — لا شيء مكتوب داخل الكود (القسم 60).
 */
export function SettingsManager({ competition }: { competition: Competition }) {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>(competition.settings);
  const [name, setName] = useState(competition.name);
  const [date, setDate] = useState(competition.event_date ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  async function save() {
    setBusy(true);
    const res = await api.competition({
      action: "update",
      competition_id: competition.id,
      name,
      event_date: date || null,
      settings,
    });
    setNote(res.ok ? "✔️ حُفظت الإعدادات" : (res.error ?? "تعذّر الحفظ"));
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function demo(action: "seed" | "clear") {
    if (action === "clear" && !confirm("حذف كل بيانات التجربة والنتائج؟")) return;
    setBusy(true);
    const res = await api.demo({ action, competition_id: competition.id });
    setNote(res.ok ? (action === "seed" ? "أُنشئت بيانات تجريبية" : "حُذفت بيانات التجربة") : (res.error ?? "تعذّر التنفيذ"));
    setBusy(false);
    router.refresh();
  }

  return (
    <main className="mx-auto max-w-3xl p-4">
      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-bold">بيانات البطولة</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">اسم البطولة</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <div>
            <label className="label">التاريخ</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" />
          </div>
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-bold">⏱️ الوقت والنقاط</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Num label="مدة السؤال (ثانية)" value={settings.question_seconds} onChange={(v) => set("question_seconds", v)} />
          <Num label="النقاط الافتراضية" value={settings.default_points} onChange={(v) => set("default_points", v)} />
          <Num label="وقت الإجابة (ثانية)" value={settings.answer_seconds} onChange={(v) => set("answer_seconds", v)} />
          <Num label="استراحة بين الأسئلة" value={settings.break_seconds} onChange={(v) => set("break_seconds", v)} />
          <Num label="عدد المحاولات للسؤال" value={settings.max_attempts_per_question} onChange={(v) => set("max_attempts_per_question", v)} />
          <Num label="خصم الإجابة الخاطئة" value={settings.wrong_answer_penalty} onChange={(v) => set("wrong_answer_penalty", v)} />
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-bold">🚩 الفرق والتوزيع</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">عدد الفرق</label>
            <select
              value={settings.teams_count}
              onChange={(e) => set("teams_count", Number(e.target.value))}
              className="input"
            >
              {[2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="label">طريقة التوزيع</label>
            <select
              value={settings.distribution}
              onChange={(e) => set("distribution", e.target.value as Settings["distribution"])}
              className="input"
            >
              <option value="auto">تلقائي</option>
              <option value="manual">يدوي</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-bold">🏆 خروج المغلوب</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="label">طريقة القرعة</label>
            <select
              value={settings.knockout_seeding}
              onChange={(e) => set("knockout_seeding", e.target.value as Settings["knockout_seeding"])}
              className="input"
            >
              <option value="ranked">حسب الترتيب (#1 مع #الأخير)</option>
              <option value="random">عشوائي</option>
            </select>
          </div>
          <div>
            <label className="label">العدد الفردي</label>
            <select
              value={settings.knockout_odd_handling}
              onChange={(e) => set("knockout_odd_handling", e.target.value as Settings["knockout_odd_handling"])}
              className="input"
            >
              <option value="bye">تأهل مباشر (Bye)</option>
              <option value="play_in">جولة تأهيلية</option>
            </select>
          </div>
          <div>
            <label className="label">كسر التعادل</label>
            <select
              value={settings.tiebreaker}
              onChange={(e) => set("tiebreaker", e.target.value)}
              className="input"
            >
              <option value="sudden_death">سؤال حاسم</option>
              <option value="fastest_buzz">أسرع ضغطة</option>
              <option value="supervisor">قرار المشرف</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card mb-4 p-4">
        <h2 className="mb-3 font-bold">👁️ العرض والـBuzzer</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <Toggle label="عرض نقاط الطلاب" value={settings.show_student_points} onChange={(v) => set("show_student_points", v)} />
          <Toggle label="عرض أسماء الطلاب" value={settings.show_student_names} onChange={(v) => set("show_student_names", v)} />
          <Toggle label="تفعيل الـBuzzer" value={settings.buzzer_enabled} onChange={(v) => set("buzzer_enabled", v)} />
          <Toggle label="السماح بإعادة المحاولة" value={settings.allow_retry} onChange={(v) => set("allow_retry", v)} />
          <Toggle label="المؤثرات الصوتية" value={settings.sounds_enabled} onChange={(v) => set("sounds_enabled", v)} />
          <Toggle label="جهاز واحد لكل كود" value={settings.single_device_per_code} onChange={(v) => set("single_device_per_code", v)} />
        </div>
      </section>

      <div className="sticky bottom-4 flex gap-2">
        <button onClick={save} disabled={busy} className="btn flex-1 bg-[var(--color-win)] py-3 text-white shadow-lg">
          {busy ? "…" : "💾 حفظ الإعدادات"}
        </button>
      </div>

      {note && <p className="mt-3 text-center font-bold">{note}</p>}

      <section className="card mt-6 border-[var(--color-gold)]/40 p-4">
        <h2 className="mb-2 font-bold">🧪 الوضع التجريبي</h2>
        <p className="mb-3 text-sm text-[var(--color-muted)]">
          أنشئ طلابًا وأسئلة تجريبية لتجربة المسابقة كاملة، ثم احذفها قبل البطولة الحقيقية.
        </p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => demo("seed")} disabled={busy} className="btn bg-[var(--color-gold)] text-sm text-black">
            🧪 إنشاء بيانات تجريبية
          </button>
          <button onClick={() => demo("clear")} disabled={busy} className="btn border border-[var(--color-lose)]/50 text-sm text-[var(--color-lose)]">
            🗑️ حذف بيانات التجربة
          </button>
        </div>
      </section>
    </main>
  );
}

function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="input" />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-xl bg-[var(--color-ink)] px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 accent-[var(--color-win)]"
      />
      {label}
    </label>
  );
}
