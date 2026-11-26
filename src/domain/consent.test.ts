import { describe, expect, it } from "vitest";
import { currentConsent, mayMessage } from "./consent";

describe("consent", () => {
  it("defaults to no consent", () => {
    expect(currentConsent([])).toEqual({ child_data: false, service_updates: false, marketing: false });
  });

  it("uses the latest event per purpose, so withdrawal wins", () => {
    const c = currentConsent([
      { purpose: "service_updates", granted: true, at: 1 },
      { purpose: "marketing", granted: true, at: 1 },
      { purpose: "marketing", granted: false, at: 2 },
    ]);
    expect(c).toEqual({ child_data: false, service_updates: true, marketing: false });
    expect(mayMessage(c, "utility")).toBe(true);
    expect(mayMessage(c, "marketing")).toBe(false);
  });
});
