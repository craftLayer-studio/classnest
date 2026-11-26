import { describe, expect, it } from "vitest";
import { clashesFor, findClashes, inCheckinWindow, parseDays, pastAbsenceCutoff, pickCheckinBatch, validateSlot, type BatchSlot } from "./schedule";
import { istInstant } from "./time";

const slot = (over: Partial<BatchSlot>): BatchSlot => ({ id: "b1", name: "B1", days: [1, 3, 5], startMin: 1020, endMin: 1110, room: "Room 1", teacherId: "t1", ...over });

describe("schedule", () => {
  it("parses days", () => {
    expect(parseDays("5,1,3,3,9")).toEqual([1, 3, 5]);
  });

  it("validates slots", () => {
    expect(validateSlot({ days: [], startMin: 600, endMin: 500 })).toHaveLength(2);
    expect(validateSlot({ days: [1], startMin: 600, endMin: 660 })).toEqual([]);
  });

  it("finds room and teacher clashes only when days and times overlap", () => {
    const a = slot({ id: "a" });
    const b = slot({ id: "b", startMin: 1080, endMin: 1170, room: "room 1", teacherId: "t2" });
    const c = slot({ id: "c", days: [2, 4], teacherId: "t1" });
    const d = slot({ id: "d", startMin: 1170, endMin: 1200, room: "Room 1" });
    expect(findClashes([a, b, c, d])).toEqual([{ a: "a", b: "b", reason: "room" }]);
    expect(clashesFor(slot({ id: "new", room: "Lab" }), [a])).toEqual([{ a: "new", b: "a", reason: "teacher" }]);
  });

  it("opens check-in 30 minutes early and marks absent 15 minutes after start", () => {
    const wed = "2026-11-25";
    const s = slot({});
    expect(inCheckinWindow(s, istInstant(wed, 1020 - 31))).toBe(false);
    expect(inCheckinWindow(s, istInstant(wed, 1000))).toBe(true);
    expect(inCheckinWindow(s, istInstant("2026-11-24", 1030))).toBe(false); // Tuesday
    expect(pastAbsenceCutoff(s, istInstant(wed, 1034))).toBe(false);
    expect(pastAbsenceCutoff(s, istInstant(wed, 1035))).toBe(true);
  });

  it("picks the batch closest to now", () => {
    const early = slot({ id: "early", startMin: 960, endMin: 1050 });
    const late = slot({ id: "late", startMin: 1050, endMin: 1140 });
    expect(pickCheckinBatch([early, late], istInstant("2026-11-25", 1045))?.id).toBe("late");
    expect(pickCheckinBatch([early, late], istInstant("2026-11-26", 1045))).toBeNull();
  });
});
