import { describe, expect, it } from "vitest";
import { addDays, daysBetween, formatClock, formatDate, istDateKey, istInstant, istMinuteOfDay, istWeekday, isDateKey, parseClock } from "./time";

describe("time (IST)", () => {
  it("maps UTC instants to IST dates and minutes", () => {
    const at = Date.UTC(2026, 10, 24, 19, 0); // 24 Nov 19:00 UTC = 25 Nov 00:30 IST
    expect(istDateKey(at)).toBe("2026-11-25");
    expect(istMinuteOfDay(at)).toBe(30);
    expect(istWeekday(at)).toBe(3); // Wednesday
  });

  it("round-trips IST wall-clock instants", () => {
    const at = istInstant("2026-11-25", 17 * 60);
    expect(istDateKey(at)).toBe("2026-11-25");
    expect(istMinuteOfDay(at)).toBe(1020);
  });

  it("does date arithmetic and validation", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(daysBetween("2026-11-20", "2026-11-25")).toBe(5);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("2026-02-28")).toBe(true);
  });

  it("parses and formats clock times", () => {
    expect(parseClock("17:30")).toBe(1050);
    expect(parseClock("24:00")).toBeNull();
    expect(formatClock(1050)).toBe("5:30 pm");
    expect(formatClock(0)).toBe("12:00 am");
    expect(formatDate("2026-11-05")).toBe("5 Nov 2026");
  });
});
