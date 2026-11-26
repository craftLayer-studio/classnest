import { and, eq } from "drizzle-orm";
import { isValidVpa } from "@/domain";
import { orgs, users } from "../db/schema";
import { notFound, requireRole, StoreError, type Ctx, type Q } from "./core";

export async function getOrg(q: Q, orgId: string) {
  const [org] = await q.select().from(orgs).where(eq(orgs.id, orgId));
  return org ?? notFound("Institute");
}

export async function getMe(ctx: Ctx) {
  const [me] = await ctx.db.select().from(users).where(and(eq(users.id, ctx.userId), eq(users.orgId, ctx.orgId)));
  return me ?? notFound("User");
}

export async function listStaff(ctx: Ctx) {
  return ctx.db.select().from(users).where(eq(users.orgId, ctx.orgId)).orderBy(users.role, users.name);
}

export interface SettingsInput {
  name?: string;
  upiVpa?: string;
  upiPayee?: string;
  gstin?: string | null;
  alertMode?: "absence_only" | "all";
  graceDays?: number;
  lateFeePaise?: number;
}

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export async function updateSettings(ctx: Ctx, input: SettingsInput) {
  requireRole(ctx, "owner");
  if (input.upiVpa !== undefined && !isValidVpa(input.upiVpa)) throw new StoreError(400, "Enter a valid UPI ID like name@bank");
  if (input.gstin && !GSTIN_RE.test(input.gstin)) throw new StoreError(400, "GSTIN must be 15 characters, for example 23ABCDE1234F1Z5");
  if (input.graceDays !== undefined && (!Number.isInteger(input.graceDays) || input.graceDays < 0 || input.graceDays > 60)) throw new StoreError(400, "Grace period must be 0 to 60 days");
  if (input.lateFeePaise !== undefined && (!Number.isInteger(input.lateFeePaise) || input.lateFeePaise < 0 || input.lateFeePaise > 1_000_000)) throw new StoreError(400, "Late fee must be ₹0 to ₹10,000");
  const patch = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (Object.keys(patch).length === 0) return getOrg(ctx.db, ctx.orgId);
  await ctx.db.update(orgs).set(patch).where(eq(orgs.id, ctx.orgId));
  return getOrg(ctx.db, ctx.orgId);
}
