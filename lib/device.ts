const KEY = "sc_device_id";

/** معرّف ثابت للجهاز، يُستخدم لمنع استعمال الكود نفسه من جهازين (القسم 37). */
export function deviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
