import { describe, expect, it } from "vitest";
import { formatPhone, maskPhone, normalizeIndianPhone } from "./phone";

describe("phone", () => {
  it("normalises Indian mobile formats to E.164", () => {
    expect(normalizeIndianPhone("98260 11111")).toBe("+919826011111");
    expect(normalizeIndianPhone("+91 98260-11111")).toBe("+919826011111");
    expect(normalizeIndianPhone("09826011111")).toBe("+919826011111");
    expect(normalizeIndianPhone("919826011111")).toBe("+919826011111");
  });

  it("rejects landlines and junk", () => {
    expect(normalizeIndianPhone("022 12345678")).toBeNull();
    expect(normalizeIndianPhone("12345")).toBeNull();
    expect(normalizeIndianPhone("5826011111")).toBeNull();
  });

  it("formats and masks", () => {
    expect(formatPhone("+919826011111")).toBe("+91 98260 11111");
    expect(maskPhone("+919826011111")).toBe("+91 ••••• •1111");
  });
});
