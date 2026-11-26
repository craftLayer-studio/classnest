/** India Standard Time is UTC+5:30 all year (no daylight saving). */
export const IST_OFFSET_MINUTES = 330;
const DAY_MS = 86_400_000;
const OFFSET_MS = IST_OFFSET_MINUTES * 60_000;

/** A calendar date in IST as "YYYY-MM-DD". */
export type DateKey = string;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateKey(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** IST calendar date for an instant. */
export function istDateKey(at: number): DateKey {
  return new Date(at + OFFSET_MS).toISOString().slice(0, 10);
}

/** Minutes since IST midnight for an instant (0..1439). */
export function istMinuteOfDay(at: number): number {
  return Math.floor(((at + OFFSET_MS) % DAY_MS) / 60_000);
}

/** Day of week in IST, 0 = Sunday … 6 = Saturday. */
export function istWeekday(at: number): number {
  return new Date(at + OFFSET_MS).getUTCDay();
}

/** Weekday of a date key, 0 = Sunday. */
export function weekdayOf(date: DateKey): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** Shift a date key by whole days. */
export function addDays(date: DateKey, days: number): DateKey {
  const t = new Date(`${date}T00:00:00Z`).getTime() + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: DateKey, b: DateKey): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / DAY_MS);
}

/** UTC instant of an IST wall-clock time on a date. */
export function istInstant(date: DateKey, minuteOfDay: number): number {
  return new Date(`${date}T00:00:00Z`).getTime() + minuteOfDay * 60_000 - OFFSET_MS;
}

/** "17:30" -> 1050. Returns null for invalid input. */
export function parseClock(value: string): number | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 1050 -> "5:30 pm". */
export function formatClock(minuteOfDay: number): string {
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** 1050 -> "17:30" (for time inputs). */
export function clockValue(minuteOfDay: number): string {
  return `${String(Math.floor(minuteOfDay / 60)).padStart(2, "0")}:${String(minuteOfDay % 60).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-25" -> "25 Nov 2026". */
export function formatDate(date: DateKey): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Instant -> "25 Nov, 5:32 pm" in IST. */
export function formatInstant(at: number): string {
  const date = istDateKey(at);
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}, ${formatClock(istMinuteOfDay(at))}`;
}
