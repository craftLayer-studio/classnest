import { describe, expect, it } from "vitest";
import { classAverage, grade, percent, rankScores, trend, validateScore } from "./marks";

describe("marks", () => {
  it("ranks with ties (1, 2, 2, 4)", () => {
    const ranked = rankScores([
      { studentId: "a", score: 70 },
      { studentId: "b", score: 90 },
      { studentId: "c", score: 70 },
      { studentId: "d", score: 50 },
    ]);
    expect(ranked.map((r) => [r.studentId, r.rank])).toEqual([["b", 1], ["a", 2], ["c", 2], ["d", 4]]);
  });

  it("validates scores", () => {
    expect(validateScore(101, 100)).toMatch(/more than/);
    expect(validateScore(-1, 100)).toMatch(/negative/);
    expect(validateScore(40.3, 100)).toMatch(/half/);
    expect(validateScore(40.5, 100)).toBeNull();
  });

  it("computes percent, grade, average and trend", () => {
    expect(percent(37, 50)).toBe(74);
    expect(grade(74)).toBe("B");
    expect(grade(20)).toBe("Needs support");
    expect(classAverage([{ studentId: "a", score: 10 }, { studentId: "b", score: 15 }])).toBe(12.5);
    expect(trend([60, 70])).toBe("up");
    expect(trend([60])).toBeNull();
  });
});
