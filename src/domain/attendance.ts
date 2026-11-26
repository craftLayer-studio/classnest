export type AttendanceStatus = "present" | "absent";
export type AttendanceSource = "qr_self" | "qr_card" | "staff" | "auto";

/** Students in the batch with no mark yet: they become absent after the cutoff. */
export function unmarked(enrolledIds: string[], markedIds: Iterable<string>): string[] {
  const marked = new Set(markedIds);
  return enrolledIds.filter((id) => !marked.has(id));
}

/** Percentage of present marks, rounded to a whole number. Null when there is nothing to measure. */
export function attendancePercent(marks: { status: AttendanceStatus }[]): number | null {
  if (marks.length === 0) return null;
  const present = marks.filter((m) => m.status === "present").length;
  return Math.round((present * 100) / marks.length);
}

/** Students absent `threshold` or more times in the given marks. */
export function chronicAbsentees(marks: { studentId: string; status: AttendanceStatus }[], threshold = 3): { studentId: string; absences: number }[] {
  const counts = new Map<string, number>();
  for (const m of marks) if (m.status === "absent") counts.set(m.studentId, (counts.get(m.studentId) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, n]) => n >= threshold)
    .map(([studentId, absences]) => ({ studentId, absences }))
    .sort((a, b) => b.absences - a.absences);
}

/** Absence-only is the default: one alert per absence. "all" adds an arrival alert (paid add-on). */
export type AlertMode = "absence_only" | "all";
export function shouldAlert(mode: AlertMode, status: AttendanceStatus): boolean {
  return status === "absent" || mode === "all";
}
