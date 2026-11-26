import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import * as schema from "./schema";

/**
 * One Drizzle type for both drivers. PGlite (file in dev, memory in tests) and node-postgres share the
 * same query builder API; we type against the PGlite flavour.
 */
export type Db = PgliteDatabase<typeof schema>;

const MIGRATIONS = path.join(process.cwd(), "src/server/db/migrations");

/** In-memory PGlite with migrations applied. Used by tests. */
export async function createMemoryDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db;
}

async function createAppDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: 5 });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as Db;
  }
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data/pglite");
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db;
}

const globalForDb = globalThis as unknown as { classnestDb?: Promise<Db> };

/** Shared app database. Migrates on first use and seeds the demo institute when the database is empty. */
export function getDb(): Promise<Db> {
  if (!globalForDb.classnestDb) {
    globalForDb.classnestDb = (async () => {
      const db = await createAppDb();
      const { seedIfEmpty } = await import("../seed");
      await seedIfEmpty(db);
      return db;
    })().catch((err) => {
      globalForDb.classnestDb = undefined;
      throw err;
    });
  }
  return globalForDb.classnestDb;
}
