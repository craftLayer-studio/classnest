/* pnpm db:seed — reset the demo institute in the dev database (PGlite file or DATABASE_URL). */
import { getDb } from "./client";
import { resetDemo } from "../seed";

async function main() {
  const db = await getDb();
  await resetDemo(db);
  console.log("Seeded Shikhar Demo Academy (demo data).");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
