import { clearStudentCookie } from "@/lib/auth/student-session";
import { ok, handler } from "@/lib/api";

export const POST = handler(async () => {
  await clearStudentCookie();
  return ok();
});
