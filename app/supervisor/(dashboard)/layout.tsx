import { redirect } from "next/navigation";
import { getSupervisor } from "@/lib/auth/supervisor";

export const dynamic = "force-dynamic";

/** حارس كل صفحات الإدارة — لا يمر إلا من هو مسجّل في جدول المشرفين. */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supervisor = await getSupervisor();
  if (!supervisor) redirect("/supervisor/login");
  return <>{children}</>;
}
