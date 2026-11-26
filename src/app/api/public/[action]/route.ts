import { getDb } from "@/server/db/client";
import { BadRequest, bool, handle, oneOf, optStr, readBody, str } from "@/server/http";
import { clientKey, rateLimit } from "@/server/rate-limit";
import { bookDemo, parentSetConsent, selfCheckIn, submitConsent } from "@/server/store";
import { CONSENT_PURPOSES } from "@/domain";

/** Public endpoints reached from QR codes and WhatsApp links. No login; rate-limited per client and token. */
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  return handle(async () => {
    const ip = clientKey(request);
    if (!rateLimit(`public:${ip}`, 60, 60_000)) throw new BadRequest("Too many requests. Please wait a minute.", 429);
    const body = await readBody(request);
    const token = str(body, "token", 100);
    const db = await getDb();
    const now = Date.now();
    switch (action) {
      case "checkin": {
        // Card codes are short, so guessing is limited hard per client.
        if (!rateLimit(`checkin:${ip}`, 12, 10 * 60_000)) throw new BadRequest("Too many check-in attempts. Ask the front desk.", 429);
        return selfCheckIn(db, token, str(body, "code", 20), now);
      }
      case "enquiry": {
        if (!rateLimit(`enquiry:${ip}`, 5, 10 * 60_000)) throw new BadRequest("Too many bookings from this device. Please call the institute.", 429);
        const batchId = optStr(body, "batchId", 100);
        const date = optStr(body, "date", 10);
        return bookDemo(
          db,
          token,
          {
            guardianName: str(body, "guardianName", 80),
            phone: str(body, "phone", 20),
            studentName: str(body, "studentName", 80),
            grade: str(body, "grade", 40),
            courseId: str(body, "courseId", 100),
            slot: batchId && date ? { batchId, date } : undefined,
            isGuardian: bool(body, "isGuardian"),
            consentUpdates: bool(body, "consentUpdates"),
            consentMarketing: bool(body, "consentMarketing"),
          },
          now,
        );
      }
      case "consent":
        return submitConsent(db, token, { child_data: bool(body, "child_data"), service_updates: bool(body, "service_updates"), marketing: bool(body, "marketing") }, now);
      case "parent-consent":
        return parentSetConsent(db, token, oneOf(body, "purpose", CONSENT_PURPOSES), bool(body, "granted"), now);
      default:
        throw new BadRequest("Unknown action", 404);
    }
  });
}
