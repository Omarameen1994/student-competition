"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deviceId } from "@/lib/device";
import { BackHome } from "@/components/BackHome";

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim().toUpperCase(), device_id: deviceId() }),
    });
    const data = await res.json();

    if (!data.ok) {
      setError(data.error);
      setBusy(false);
      return;
    }
    router.replace("/student");
  }

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 p-6">
      <BackHome />

      <div className="text-center">
        <div className="text-6xl glow">🏆</div>
        <h1 className="mt-3 text-2xl font-black">أدخل كود الدخول</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          الكود موجود لدى المشرف
        </p>
      </div>

      <form onSubmit={submit} className="card flex flex-col gap-4 p-5">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="A7K92"
          autoComplete="off"
          autoCapitalize="characters"
          inputMode="text"
          maxLength={8}
          dir="ltr"
          className="input py-5 text-center text-3xl font-black tracking-[0.4em]"
        />

        {error && (
          <p className="shake rounded-xl bg-[var(--color-lose)]/15 p-3 text-center text-sm font-bold text-[var(--color-lose)]">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || code.trim().length < 3}
          className="btn bg-[var(--color-brand)] py-4 text-lg text-white"
        >
          {busy ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
    </main>
  );
}
