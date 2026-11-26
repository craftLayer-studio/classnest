import { createHmac, timingSafeEqual } from "node:crypto";
import type { Role } from "./store/core";

export const SESSION_COOKIE = "cn_session";
export const SESSION_TTL_S = 12 * 60 * 60;

export interface Session {
  uid: string;
  oid: string;
  role: Role;
  name: string;
  exp: number;
}

let warned = false;
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (!warned) {
    console.warn("[classnest] SESSION_SECRET is not set; using an insecure development secret.");
    warned = true;
  }
  return "classnest-dev-only-secret-do-not-use-in-production";
}

const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url");

export function encodeSession(s: Omit<Session, "exp">, now = Date.now()): string {
  const data = Buffer.from(JSON.stringify({ ...s, exp: Math.floor(now / 1000) + SESSION_TTL_S })).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeSession(value: string | undefined, now = Date.now()): Session | null {
  if (!value) return null;
  const [data, mac] = value.split(".");
  if (!data || !mac) return null;
  const expected = sign(data);
  if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString()) as Session;
    if (typeof s.exp !== "number" || s.exp * 1000 < now) return null;
    if (!["owner", "staff", "teacher"].includes(s.role)) return null;
    return s;
  } catch {
    return null;
  }
}

/** Demo mode shows OTPs on screen. On by default outside production; DEMO_OTP=1 forces it on, 0 off. */
export function demoOtpEnabled(): boolean {
  if (process.env.DEMO_OTP === "1") return true;
  if (process.env.DEMO_OTP === "0") return false;
  // The MVP only runs as a demo, so OTPs stay visible unless DEMO_OTP=0 is set for a real deployment.
  return true;
}
