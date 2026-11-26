import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession } from "./session";

describe("session cookie", () => {
  it("round-trips and rejects tampering and expiry", () => {
    const now = Date.UTC(2026, 10, 25);
    const v = encodeSession({ uid: "u", oid: "o", role: "owner", name: "R" }, now);
    expect(decodeSession(v, now)?.role).toBe("owner");
    const [data, mac] = v.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "u", oid: "o", role: "owner", name: "R", exp: 9e9 })).toString("base64url");
    expect(decodeSession(`${forged}.${mac}`, now)).toBeNull();
    expect(decodeSession(`${data}.x`, now)).toBeNull();
    expect(decodeSession(v, now + 13 * 3600_000)).toBeNull();
  });
});
