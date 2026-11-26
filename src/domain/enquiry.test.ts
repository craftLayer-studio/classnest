import { describe, expect, it } from "vitest";
import { canMoveEnquiry, funnel } from "./enquiry";

describe("enquiry pipeline", () => {
  it("allows only forward moves (and reopening lost leads)", () => {
    expect(canMoveEnquiry("new", "demo_booked")).toBe(true);
    expect(canMoveEnquiry("admitted", "lost")).toBe(false);
    expect(canMoveEnquiry("lost", "new")).toBe(true);
    expect(canMoveEnquiry("fee_discussed", "demo_booked")).toBe(false);
  });

  it("computes conversion", () => {
    const f = funnel(["new", "demo_booked", "admitted", "admitted", "lost"]);
    expect(f.total).toBe(5);
    expect(f.demoBooked).toBe(3);
    expect(f.conversionPercent).toBe(40);
    expect(funnel([]).conversionPercent).toBeNull();
  });
});
