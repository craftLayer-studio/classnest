import { describe, expect, it } from "vitest";
import { attendancePercent, chronicAbsentees, shouldAlert, unmarked } from "./attendance";

describe("attendance", () => {
  it("finds unmarked students", () => {
    expect(unmarked(["a", "b", "c"], ["b"])).toEqual(["a", "c"]);
  });

  it("computes attendance percent", () => {
    expect(attendancePercent([])).toBeNull();
    expect(attendancePercent([{ status: "present" }, { status: "present" }, { status: "absent" }])).toBe(67);
  });

  it("flags chronic absentees", () => {
    const marks = ["a", "a", "a", "b"].map((studentId) => ({ studentId, status: "absent" as const }));
    expect(chronicAbsentees(marks)).toEqual([{ studentId: "a", absences: 3 }]);
  });

  it("alerts on absence only by default", () => {
    expect(shouldAlert("absence_only", "absent")).toBe(true);
    expect(shouldAlert("absence_only", "present")).toBe(false);
    expect(shouldAlert("all", "present")).toBe(true);
  });
});
