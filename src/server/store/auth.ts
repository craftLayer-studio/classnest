import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { normalizeIndianPhone } from "@/domain";
import type { Db } from "../db/client";
import { otpCodes, users } from "../db/schema";
import { newId, StoreError, type Role } from "./core";

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

const hash = (phone: string, code: string) => createHash("sha256").update(`${phone}:${code}`).digest("hex");

/**
 * Start phone + OTP sign-in for staff/owner. Returns the code only in demo mode, so the UI can show it
 * (labelled demo). In production it would go through the SMS/WhatsApp adapter. Unknown phones get the
 * same response, so the endpoint does not reveal who is a staff member.
 */
export async function requestOtp(db: Db, rawPhone: string, now: number, demo: boolean): Promise<{ phone: string; demoCode?: string }> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone) throw new StoreError(400, "Enter a valid 10-digit Indian mobile number");
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone));
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  if (user) {
    await db.insert(otpCodes).values({ id: newId("otp"), phone, codeHash: hash(phone, code), expiresAt: new Date(now + OTP_TTL_MS), createdAt: new Date(now) });
  }
  return { phone, demoCode: demo ? (user ? code : "no staff account for this number") : undefined };
}

export async function verifyOtp(db: Db, rawPhone: string, code: string, now: number): Promise<{ userId: string; orgId: string; role: Role; name: string }> {
  const phone = normalizeIndianPhone(rawPhone);
  if (!phone || !/^\d{6}$/.test(code)) throw new StoreError(400, "Enter the 6-digit code");
  const [otp] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), isNull(otpCodes.usedAt), gt(otpCodes.expiresAt, new Date(now))))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);
  if (!otp || otp.attempts >= MAX_ATTEMPTS) throw new StoreError(401, "Code expired. Request a new one.");
  const ok = timingSafeEqual(Buffer.from(otp.codeHash), Buffer.from(hash(phone, code)));
  if (!ok) {
    await db.update(otpCodes).set({ attempts: otp.attempts + 1 }).where(eq(otpCodes.id, otp.id));
    throw new StoreError(401, "Wrong code");
  }
  await db.update(otpCodes).set({ usedAt: new Date(now) }).where(eq(otpCodes.id, otp.id));
  const [user] = await db.select().from(users).where(eq(users.phone, phone));
  if (!user) throw new StoreError(401, "No staff account for this number");
  return { userId: user.id, orgId: user.orgId, role: user.role, name: user.name };
}
