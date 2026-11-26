import { describe, expect, it } from "vitest";
import { absenceAlert, feeReminder } from "./messages";

describe("message templates", () => {
  it("renders an absence alert", () => {
    expect(absenceAlert({ student: "Aarav", batch: "Class 10 Physics", startMin: 1020, institute: "Demo Academy", date: "2026-11-25" })).toBe(
      "Demo Academy: Aarav was marked absent for Class 10 Physics (5:00 pm) on 25 Nov 2026. Reply 1 if you know, 2 for a call from the institute.",
    );
  });

  it("renders a fee reminder with a UPI link", () => {
    const text = feeReminder({ student: "Aarav", amount: 500000, due: "2026-11-10", institute: "Demo", link: "https://x/f/abc", overdue: true });
    expect(text).toContain("₹5,000");
    expect(text).toContain("was due on 10 Nov 2026");
  });
});
