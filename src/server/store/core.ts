import { randomBytes, randomUUID } from "node:crypto";
import type { Db } from "../db/client";

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Q = Db | Tx;

export type Role = "owner" | "staff" | "teacher";

/** Everything a staff/owner use case needs: the tenant, the actor, the clock and the base URL for links. */
export interface Ctx {
  db: Db;
  orgId: string;
  userId: string;
  role: Role;
  now: number;
  baseUrl: string;
}

export class StoreError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "StoreError";
  }
}

export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;

/** Unguessable token for QR codes and parent links (128 bits, URL safe). */
export const newToken = () => randomBytes(16).toString("base64url");

/** Short card code printed under the ID-card QR (also unguessable enough with rate limiting: 40 bits). */
export const newCardCode = () => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
};

export function requireRole(ctx: Pick<Ctx, "role">, ...roles: Role[]): void {
  if (!roles.includes(ctx.role)) throw new StoreError(403, "You do not have access to this action");
}

export function notFound(what: string): never {
  throw new StoreError(404, `${what} not found`);
}
