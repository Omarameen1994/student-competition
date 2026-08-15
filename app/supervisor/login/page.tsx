"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/database/client";

export default function SupervisorLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setError("البريد أو كلمة المرور غير صحيحة");
      setBusy(false);
      return;
    }

    router.replace("/supervisor");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="text-center">
        <div className="text-5xl">🛡️</div>
        <h1 className="mt-3 text-2xl font-black">دخول المشرفين</h1>
      </div>

      <form onSubmit={submit} className="card flex flex-col gap-3 p-5">
        <div>
          <label className="label">البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dir="ltr"
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            dir="ltr"
            className="input"
            required
          />
        </div>

        {error && (
          <p className="rounded-xl bg-[var(--color-lose)]/15 p-3 text-center text-sm font-bold text-[var(--color-lose)]">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn bg-[var(--color-brand)] py-3 text-white">
          {busy ? "جارٍ الدخول…" : "دخول"}
        </button>
      </form>
    </main>
  );
}
