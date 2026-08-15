import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudent } from "@/lib/auth/student-session";

export default async function Home() {
  const student = await getStudent();
  if (student) redirect("/student");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 p-6 text-center">
      <div>
        <div className="text-7xl glow">🏆</div>
        <h1 className="mt-4 text-3xl font-black">منصة مسابقات الطلاب</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          مسابقة مباشرة، فرق متنافسة، وBuzzer سريع
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Link
          href="/login"
          className="btn bg-[var(--color-brand)] py-4 text-lg text-white"
        >
          دخول الطالب بكود المشاركة
        </Link>
        <Link
          href="/supervisor/login"
          className="btn border border-[var(--color-line)] text-[var(--color-muted)]"
        >
          دخول المشرفين
        </Link>
      </div>
    </main>
  );
}
