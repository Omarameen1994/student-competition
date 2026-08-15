"use client";

export interface ApiResult {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

/** استدعاء موحّد لمسارات الإدارة. */
export async function call(path: string, body: Record<string, unknown>): Promise<ApiResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiResult;
  } catch {
    return { ok: false, error: "تعذّر الاتصال بالخادم" };
  }
}

export const api = {
  competition: (body: Record<string, unknown>) => call("/api/supervisor/competition", body),
  students: (body: Record<string, unknown>) => call("/api/supervisor/students", body),
  teams: (body: Record<string, unknown>) => call("/api/supervisor/teams", body),
  questions: (body: Record<string, unknown>) => call("/api/supervisor/questions", body),
  live: (body: Record<string, unknown>) => call("/api/supervisor/live", body),
  knockout: (body: Record<string, unknown>) => call("/api/supervisor/knockout", body),
  powerups: (body: Record<string, unknown>) => call("/api/supervisor/powerups", body),
  demo: (body: Record<string, unknown>) => call("/api/supervisor/demo", body),
};
