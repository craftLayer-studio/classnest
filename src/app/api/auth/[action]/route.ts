import { cookies } from "next/headers";
import { getDb } from "@/server/db/client";
import { BadRequest, handle, readBody, str } from "@/server/http";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { demoOtpEnabled, encodeSession, SESSION_COOKIE, SESSION_TTL_S } from "@/server/session";
import { requestOtp, verifyOtp } from "@/server/store";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return handle(async () => {
    if (!rateLimit(`auth:${clientKey(request)}`, 20, 10 * 60_000)) throw new BadRequest("Too many attempts. Try again in a few minutes.", 429);
    const body = await readBody(request);
    const db = await getDb();
    if (action === "otp") {
      const phone = str(body, "phone", 20);
      if (!rateLimit(`otp:${phone}`, 5, 10 * 60_000)) throw new BadRequest("Too many codes requested for this number", 429);
      return requestOtp(db, phone, Date.now(), demoOtpEnabled());
    }
    if (action === "verify") {
      const s = await verifyOtp(db, str(body, "phone", 20), str(body, "code", 6), Date.now());
      (await cookies()).set(SESSION_COOKIE, encodeSession({ uid: s.userId, oid: s.orgId, role: s.role, name: s.name }), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production" && !process.env.APP_URL?.startsWith("http://"),
        path: "/",
        maxAge: SESSION_TTL_S,
      });
      return { role: s.role, next: s.role === "owner" ? "/app" : "/app/attendance" };
    }
    if (action === "logout") {
      (await cookies()).delete(SESSION_COOKIE);
      return { ok: true };
    }
    throw new BadRequest("Unknown action", 404);
  });
}
