# ClassNest

**Tagline:** Every student marked, every parent informed, every fee collected.

ClassNest is the front-desk app for coaching institutes, tuition centres and music, art and skill academies in India. A QR code at the entrance marks attendance and alerts parents on WhatsApp. UPI fee links and automatic reminders shrink the defaulter list. The same QR on posters and flyers books demo classes during admission season.

**Status:** MVP with demo data. WhatsApp messaging and UPI payments are simulated (no real API keys, no third-party calls). Live at [classnest.craftlayer.store](https://classnest.craftlayer.store) once deployed; product support: classnest@craftlayer.store.

## Who it is for (ICP)

| Segment | Size | Why they buy |
|---|---|---|
| Neighbourhood tuition and coaching centre (Class 6–12, boards, foundation) | 50–400 students, 2–10 teachers, 1 branch | Fee defaulters, parent trust, admission-season leads |
| Competitive-exam coaching (JEE/NEET/CA/banking/SSC) | 100–1,000 students, 1–3 branches | Attendance proof for parents, test results, batch management |
| Music, dance, art, chess, coding and language academies | 30–200 students, 1–6 instructors | Monthly fee collection, slot/batch scheduling, demo-class bookings |

Tier 2 and Tier 3 cities first (Jaipur, Indore, Lucknow, Patna, Nagpur, Coimbatore), then Tier 1 suburbs.

## Top features (MVP)

1. **QR attendance + parent WhatsApp alerts** — student scans the entrance QR (or teacher marks in one tap); parents of absent students get an alert within 15 minutes. Moves: retention.
2. **Fee collection with UPI and auto-reminders** — instalment plans, UPI payment links, reminders at D-3, D0, D+3, D+7, digital GST receipts, defaulter dashboard. Moves: revenue.
3. **Enquiry CRM + demo-class booking via QR** — QR on posters, flyers and banners opens a booking page; leads land in a pipeline with WhatsApp follow-up. Moves: acquisition.
4. **Batches and timetable** — batches, rooms, teachers, holidays, clash detection. Moves: activation.
5. **Tests, marks and report cards** — marks entry, rank, parent report card on WhatsApp. Moves: retention and referral.
6. **Homework and notes sharing** — PDFs and images per batch. Moves: retention.
7. **Teacher payout tracking** — per-batch or per-hour pay, monthly payout sheet. Moves: activation (owner stickiness).

## Pricing (summary)

| Plan | INR / month (billed yearly) | USD | Students |
|---|---|---|---|
| Starter | ₹799 (₹7,999/yr) | $12 | Up to 100 |
| Growth | ₹1,499 (₹14,999/yr) | $19 | Up to 300 |
| Pro | ₹2,999 (₹29,999/yr) | $39 | Up to 1,000, multi-branch |

WhatsApp messages beyond the plan's bundle are billed as credits. Zero platform fee on UPI fee collection. Details in [docs/05-pricing-and-revenue.md](docs/05-pricing-and-revenue.md).

Anchor: Classplus lists Starter at ₹19,999/year + GST and Grow at ₹22,999/year + GST ([Capterra](https://www.capterra.com/p/208852/Class-Plus/reviews/), accessed 2026-11-24). ClassNest Growth is about 25–35% cheaper and is built for the offline centre, not for selling online courses.

## How to run

Requirements: Node.js 22 and pnpm 11 (`corepack enable`).

```bash
pnpm install
cp .env.example .env.local   # optional; every value has a dev default
pnpm dev                     # next dev --webpack on http://localhost:3000 (use -p 3150 to pick a port)
```

The first request creates an embedded Postgres (PGlite) database in `./.data/pglite`, runs the migrations and seeds the fictional **Shikhar Demo Academy** (Indore). Set `DATABASE_URL` to use a real Postgres instead.

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js 16 with webpack |
| `pnpm typecheck && pnpm lint && pnpm test && pnpm build` | Quality gates (CI runs the same) |
| `pnpm db:seed` | Reset the demo institute in the dev database |
| `pnpm db:generate` | Generate a SQL migration after changing `src/server/db/schema.ts` |
| `pnpm exec astryx doctor --built .next` | Astryx design-system checks |

Background jobs (absence alerts 15 minutes after a batch starts, fee reminders at D-3/D0/D+3/D+7) run from `POST /api/cron` with `Authorization: Bearer $CRON_SECRET`, from the "Run jobs" buttons, and each time the attendance screen opens.

## Demo walkthrough

Sign in at `/login`. The OTP is shown on screen (demo mode).

| Who | Phone | Lands on |
|---|---|---|
| Owner, Rajesh Verma | 98260 11111 | `/app` dashboard |
| Front desk, Priya Joshi | 98260 22222 | `/app/attendance` |
| Teacher, Arjun Mehta | 98260 33333 | `/app/attendance` |

1. **Student check-in** – open `/q/demo-entrance-7Qm2xK9pLs` (the entrance QR) and enter card code `AARAV001`. The demo accepts any batch that meets today so it works at any hour.
2. **Kiosk** – on `/app/attendance`, type a card code (or open a card QR `/c/<code>` while signed in). Run the absence check: unmarked students become absent and opted-in parents get one WhatsApp alert (see `/app/messages`).
3. **Admission + parental consent** – add a student on `/app/students`. The guardian gets a consent link on WhatsApp (outbox). A pending example: `/consent/demo-consent-Meher-4kPz`.
4. **Fees** – `/app/fees` lists defaulters; send reminders with a UPI link, or record a UPI/cash payment on a student page to issue a GST receipt (`/receipt/<token>`).
5. **Parent page** – `/p/demo-parent-aarav-Xk29Lq`: report card with rank and class average, attendance, fees with a `upi://pay` link and QR, and consent choices (easy opt-out).
6. **Admissions** – parents scan the poster QR `/e/demo-poster-Vb4nT8rWc2` to book a demo class. Leads appear on `/app/enquiries`; move stages, admit in one tap, or send an offer to marketing opt-ins only.
7. **Tests** – `/app/tests`: enter marks, see ranks, publish to send report-card links.
8. **Owner** – `/app` (attendance %, collected vs due, conversion, follow-up results), `/app/qr` (printable entrance, poster and ID-card QR sheet), `/app/settings` (UPI ID, GSTIN, grace days, late fee, alert mode, demo reset).

## Features: built vs planned

| Feature | Status |
|---|---|
| Batches, courses, timetable with room/teacher clash detection | Built |
| Students and guardians, minimal fields, consent ledger (DPDP) | Built |
| Entrance QR self check-in, ID-card kiosk scan, one-tap staff marking | Built |
| Absence-only parent alerts (arrival alerts as opt-in setting) | Built (simulated WhatsApp) |
| Fee plans, instalments, discount, late fee, GST receipts | Built |
| UPI intent links and D-3/D0/D+3/D+7 reminders, defaulter list | Built (UPI intent; payment confirmed by staff) |
| Enquiry CRM, poster QR demo-class booking, one-tap admission | Built |
| Tests, marks, ranks, parent report-card page | Built |
| Owner dashboard and printable QR sheet | Built |
| Excel import, offline staff app, SMS fallback, Razorpay webhooks, AutoPay | Planned |
| Homework/notes, teacher payouts, Hindi and regional languages, multi-branch | Planned |

## Children's data

Students are treated as minors by default. Only name, class, batches, attendance, marks and fees are stored, plus the guardian's name and WhatsApp number; no date of birth, address, photo or student phone. The guardian consents from their own phone with separate, unticked choices (class record, service updates, offers); every choice is a `consent_records` row with purpose, notice version, channel and time. Utility messages need service-update consent, offers need marketing consent, and nothing is ever sent to students. No ads and no behavioural tracking. Parents can change choices on their page; owners can erase a student record.

## Documents

| Doc | What it covers |
|---|---|
| [AGENTS.md](AGENTS.md) | Brief for AI agents: context, glossary, decisions, open questions |
| [01 Product plan](docs/01-product-plan.md) | ICP, personas, journeys, features P0/P1/P2, data model, metrics |
| [02 Problems and benefits](docs/02-problems-and-benefits.md) | Problem, solution and benefit per stakeholder |
| [03 Pros, cons, risks](docs/03-pros-cons-risks.md) | Risks, mitigations, kill criteria |
| [04 Market research](docs/04-market-research.md) | Market size, competitors, regulation, sources |
| [05 Pricing and revenue](docs/05-pricing-and-revenue.md) | Tiers, add-ons, unit economics, 12-month scenarios |
| [06 Go-to-market and onboarding](docs/06-go-to-market-and-onboarding.md) | First 10 customers, sales script, onboarding checklist |

Built on the CraftLayer shared core: [core/README.md](https://github.com/craftLayer-studio/craftlayer-core/blob/main/README.md).

## Licence

Source-available under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). Personal, educational, research and non-profit use is free. **Any commercial use requires a paid licence or written permission from CraftLayer Studio.** See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

Part of the [CraftLayer Products](https://github.com/craftLayer-studio/craftlayer-products) portfolio.
