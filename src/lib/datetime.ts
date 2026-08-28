const TZ = "America/Argentina/Buenos_Aires";

/** "2026-09-12" -> "12 sep" */
export function fmtDay(isoDate: string): string {
  return new Date(isoDate + "T12:00:00Z")
    .toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })
    .replace(".", "");
}

/** Date -> "14:32" (hora de Argentina) */
export function fmtTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** Date -> "12 sep, 14:32" */
export function fmtDateTime(d: Date | string): string {
  return new Date(d)
    .toLocaleString("es-AR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: TZ,
    })
    .replace(".", "");
}
