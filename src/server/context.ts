import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "./db/client";
import { BadRequest } from "./http";
import { decodeSession, SESSION_COOKIE, type Session } from "./session";
import type { Ctx, Role } from "./store/core";

/** Base URL for QR codes and WhatsApp links: APP_URL, else the request origin. */
export async function baseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3150";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function currentSession(): Promise<Session | null> {
  return decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
}

async function toCtx(s: Session): Promise<Ctx> {
  return { db: await getDb(), orgId: s.oid, userId: s.uid, role: s.role, now: Date.now(), baseUrl: await baseUrl() };
}

/** For staff pages: the session context, or a redirect to sign-in. Optionally restrict to roles. */
export async function pageCtx(...roles: Role[]): Promise<Ctx & { name: string }> {
  const s = await currentSession();
  if (!s) redirect("/login");
  if (roles.length && !roles.includes(s.role)) redirect("/app/attendance");
  return { ...(await toCtx(s)), name: s.name };
}

/** For staff API routes: the session context, or 401. Role checks happen in the store. */
export async function apiCtx(): Promise<Ctx> {
  const s = await currentSession();
  if (!s) throw new BadRequest("Please sign in", 401);
  return toCtx(s);
}

/** Request time. A function so server components can read the clock outside render purity rules. */
export function requestNow(): number {
  return Date.now();
}
