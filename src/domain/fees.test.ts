import { describe, expect, it } from "vitest";
import { addMonths, allocatePayment, defaulters, financialYear, gstSplit, instalmentStatus, planInstalments, proRataRefund, receiptNumber, reminderDue, type Instalment } from "./fees";

const inst = (over: Partial<Instalment>): Instalment => ({ id: "i1", seq: 1, dueDate: "2026-11-10", amount: 500000, paid: 0, lateFee: 0, remindersSent: [], ...over });

describe("fee plans", () => {
  it("adds months with clamping", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });

  it("splits fees exactly with the remainder on the first instalment", () => {
    const plan = planInstalments({ total: 3600000, discount: 100001, count: 3, firstDue: "2026-12-05" });
    expect(plan.map((p) => p.amount)).toEqual([1166667, 1166666, 1166666]);
    expect(plan.reduce((s, p) => s + p.amount, 0)).toBe(3499999);
    expect(plan.map((p) => p.dueDate)).toEqual(["2026-12-05", "2027-01-05", "2027-02-05"]);
    expect(() => planInstalments({ total: 100, discount: 200, count: 1, firstDue: "2026-12-05" })).toThrow();
    expect(() => planInstalments({ total: 100, count: 0, firstDue: "2026-12-05" })).toThrow();
  });

  it("derives instalment status with a grace period", () => {
    expect(instalmentStatus(inst({ paid: 500000 }), "2026-12-30", 5)).toBe("paid");
    expect(instalmentStatus(inst({}), "2026-11-09", 5)).toBe("upcoming");
    expect(instalmentStatus(inst({}), "2026-11-10", 5)).toBe("due");
    expect(instalmentStatus(inst({}), "2026-11-15", 5)).toBe("overdue");
    expect(instalmentStatus(inst({}), "2026-11-16", 5)).toBe("defaulting");
  });

  it("allocates payments oldest first and rejects overpayment", () => {
    const list = [inst({ id: "a", seq: 1, amount: 1000, paid: 400 }), inst({ id: "b", seq: 2, amount: 1000 })];
    expect(allocatePayment(list, 900)).toEqual([
      { instalmentId: "a", amount: 600 },
      { instalmentId: "b", amount: 300 },
    ]);
    expect(() => allocatePayment(list, 1601)).toThrow();
    expect(() => allocatePayment(list, 0)).toThrow();
  });

  it("schedules reminders at D-3, D0, D+3, D+7 without repeats", () => {
    expect(reminderDue(inst({}), "2026-11-06")).toBeNull();
    expect(reminderDue(inst({}), "2026-11-07")).toBe("D-3");
    expect(reminderDue(inst({ remindersSent: ["D-3"] }), "2026-11-08")).toBeNull();
    expect(reminderDue(inst({ remindersSent: ["D-3"] }), "2026-11-10")).toBe("D0");
    expect(reminderDue(inst({}), "2026-11-20")).toBe("D+7"); // catch-up sends the latest stage only
    expect(reminderDue(inst({ remindersSent: ["D+7"] }), "2026-11-25")).toBeNull();
    expect(reminderDue(inst({ paid: 500000 }), "2026-11-10")).toBeNull();
  });

  it("splits GST-inclusive fees into CGST and SGST", () => {
    expect(gstSplit(118000)).toEqual({ taxable: 100000, cgst: 9000, sgst: 9000, gst: 18000 });
    const odd = gstSplit(100001);
    expect(odd.taxable + odd.cgst + odd.sgst).toBe(100001);
  });

  it("numbers receipts by financial year", () => {
    expect(financialYear("2026-11-25")).toBe("2026-27");
    expect(financialYear("2027-03-31")).toBe("2026-27");
    expect(financialYear("2027-04-01")).toBe("2027-28");
    expect(receiptNumber("SA", "2026-11-25", 42)).toBe("SA/2026-27/00042");
  });

  it("computes pro-rata refunds", () => {
    expect(proRataRefund({ paid: 1200000, total: 1200000, months: 12, monthsUsed: 3 })).toBe(900000);
    expect(proRataRefund({ paid: 200000, total: 1200000, months: 12, monthsUsed: 3 })).toBe(0);
  });

  it("lists defaulters worst first", () => {
    const rows = [
      { studentId: "s1", instalments: [inst({ dueDate: "2026-11-01" }), inst({ dueDate: "2026-11-20", amount: 1000 })] },
      { studentId: "s2", instalments: [inst({ dueDate: "2026-11-22" })] },
      { studentId: "s3", instalments: [inst({ dueDate: "2026-10-01", amount: 900000 })] },
    ];
    const list = defaulters(rows, "2026-11-25", 5);
    expect(list.map((d) => d.studentId)).toEqual(["s3", "s1"]);
    expect(list[1]).toEqual({ studentId: "s1", overdue: 501000, oldestDue: "2026-11-01", daysLate: 24 });
  });
});
