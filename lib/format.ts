export function seconds(ms: number): string {
  return (ms / 1000).toFixed(3);
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function clockTime(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

export const MEDAL = ["🥇", "🥈", "🥉"];

export function medal(rank: number): string {
  return MEDAL[rank - 1] ?? `#${rank}`;
}

export const QUESTION_TYPE_LABEL: Record<string, string> = {
  multiple_choice: "اختيار من متعدد",
  true_false: "صح أو خطأ",
  short_answer: "إجابة قصيرة",
  oral: "إجابة شفوية",
  image: "سؤال بصورة",
  audio: "سؤال صوتي",
  video: "سؤال بفيديو",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "مسودة",
  ready: "جاهزة",
  live: "مباشرة",
  paused: "متوقفة مؤقتًا",
  team_stage_finished: "انتهت مرحلة الفرق",
  knockout: "خروج المغلوب",
  finished: "منتهية",
};
