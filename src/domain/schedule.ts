import { istMinuteOfDay, istWeekday, weekdayOf, type DateKey } from "./time";

/** Days a batch meets, 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface BatchSlot {
  id: string;
  name: string;
  days: Weekday[];
  startMin: number;
  endMin: number;
  room: string;
  teacherId: string | null;
}

/** Minutes after start when unmarked students become absent. */
export const ABSENCE_CUTOFF_MIN = 15;
/** Students may self check in from this many minutes before start until the end. */
export const CHECKIN_EARLY_MIN = 30;

export function parseDays(value: string): Weekday[] {
  return [...new Set(value.split(",").map((s) => Number(s.trim())))]
    .filter((n): n is Weekday => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
}

export function formatDays(days: Weekday[]): string {
  return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
}

export function validateSlot(slot: Pick<BatchSlot, "days" | "startMin" | "endMin">): string[] {
  const errors: string[] = [];
  if (slot.days.length === 0) errors.push("Pick at least one day");
  if (!Number.isInteger(slot.startMin) || slot.startMin < 0 || slot.startMin > 1439) errors.push("Start time is invalid");
  if (!Number.isInteger(slot.endMin) || slot.endMin < 1 || slot.endMin > 1440) errors.push("End time is invalid");
  if (slot.endMin <= slot.startMin) errors.push("End time must be after start time");
  else if (slot.endMin - slot.startMin > 360) errors.push("A class can be at most 6 hours long");
  return errors;
}

export function meetsOn(slot: Pick<BatchSlot, "days">, date: DateKey): boolean {
  return slot.days.includes(weekdayOf(date) as Weekday);
}

export interface Clash {
  a: string;
  b: string;
  reason: "room" | "teacher";
}

/** Two batches clash when they share a day, overlap in time, and share a room or a teacher. */
export function findClashes(slots: BatchSlot[]): Clash[] {
  const clashes: Clash[] = [];
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      const shareDay = a.days.some((d) => b.days.includes(d));
      const overlap = a.startMin < b.endMin && b.startMin < a.endMin;
      if (!shareDay || !overlap) continue;
      if (a.room.trim() && a.room.trim().toLowerCase() === b.room.trim().toLowerCase()) clashes.push({ a: a.id, b: b.id, reason: "room" });
      if (a.teacherId && a.teacherId === b.teacherId) clashes.push({ a: a.id, b: b.id, reason: "teacher" });
    }
  }
  return clashes;
}

/** Clashes a proposed slot would create with existing ones (the slot's own id is ignored). */
export function clashesFor(proposed: BatchSlot, existing: BatchSlot[]): Clash[] {
  return findClashes([proposed, ...existing.filter((s) => s.id !== proposed.id)]).filter((c) => c.a === proposed.id || c.b === proposed.id);
}

/** Is a self check-in at `at` inside the window for this batch today? */
export function inCheckinWindow(slot: Pick<BatchSlot, "days" | "startMin" | "endMin">, at: number): boolean {
  if (!slot.days.includes(istWeekday(at) as Weekday)) return false;
  const m = istMinuteOfDay(at);
  return m >= slot.startMin - CHECKIN_EARLY_MIN && m <= slot.endMin;
}

/** Has today's session passed the absence cutoff? */
export function pastAbsenceCutoff(slot: Pick<BatchSlot, "days" | "startMin">, at: number): boolean {
  if (!slot.days.includes(istWeekday(at) as Weekday)) return false;
  return istMinuteOfDay(at) >= slot.startMin + ABSENCE_CUTOFF_MIN;
}

/** Pick the batch a student is checking in to: the one in window whose start is closest. */
export function pickCheckinBatch<T extends Pick<BatchSlot, "days" | "startMin" | "endMin">>(slots: T[], at: number): T | null {
  const m = istMinuteOfDay(at);
  const open = slots.filter((s) => inCheckinWindow(s, at));
  open.sort((a, b) => Math.abs(a.startMin - m) - Math.abs(b.startMin - m));
  return open[0] ?? null;
}
