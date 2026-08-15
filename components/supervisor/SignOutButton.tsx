"use client";

import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/database/client";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace("/supervisor/login");
        router.refresh();
      }}
      className="btn border border-[var(--color-line)] text-sm text-[var(--color-muted)]"
    >
      خروج
    </button>
  );
}
