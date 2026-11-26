import { StoreError } from "./store/core";

/** Run a store call and turn the result or a StoreError into a JSON response. */
export async function handle(fn: () => unknown): Promise<Response> {
  try {
    return Response.json((await fn()) ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof StoreError || err instanceof BadRequest) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return Response.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export class BadRequest extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MAX_BODY_BYTES = 32_000;

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new BadRequest("Request too large");
  let value: unknown;
  try {
    value = text ? JSON.parse(text) : {};
  } catch {
    throw new BadRequest("Body must be JSON");
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new BadRequest("Body must be a JSON object");
  return value as Record<string, unknown>;
}

export function str(body: Record<string, unknown>, key: string, max = 200): string {
  const v = body[key];
  if (typeof v !== "string" || v.trim().length === 0 || v.length > max) throw new BadRequest(`${key} is required`);
  return v;
}

export function optStr(body: Record<string, unknown>, key: string, max = 500): string | undefined {
  const v = body[key];
  if (v === undefined || v === null || v === "") return undefined;
  if (typeof v !== "string" || v.length > max) throw new BadRequest(`${key} must be text up to ${max} characters`);
  return v;
}

export function num(body: Record<string, unknown>, key: string): number {
  const v = body[key];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new BadRequest(`${key} must be a number`);
  return v;
}

export function int(body: Record<string, unknown>, key: string): number {
  const v = num(body, key);
  if (!Number.isInteger(v)) throw new BadRequest(`${key} must be a whole number`);
  return v;
}

/** Rupees from the client (a number, up to 2 decimals) to integer paise. */
export function paise(body: Record<string, unknown>, key: string): number {
  const v = num(body, key);
  if (v < 0 || v > 10_000_000) throw new BadRequest(`${key} is out of range`);
  const p = Math.round(v * 100);
  if (Math.abs(p - v * 100) > 1e-6) throw new BadRequest(`${key} can have at most 2 decimals`);
  return p;
}

export function bool(body: Record<string, unknown>, key: string): boolean {
  const v = body[key];
  if (v === undefined) return false;
  if (typeof v !== "boolean") throw new BadRequest(`${key} must be true or false`);
  return v;
}

export function oneOf<T extends string>(body: Record<string, unknown>, key: string, allowed: readonly T[]): T {
  const v = body[key];
  if (typeof v !== "string" || !allowed.includes(v as T)) throw new BadRequest(`${key} must be one of ${allowed.join(", ")}`);
  return v as T;
}

export function strList(body: Record<string, unknown>, key: string, maxItems = 50): string[] {
  const v = body[key];
  if (!Array.isArray(v) || v.length > maxItems || !v.every((x) => typeof x === "string" && x.length > 0 && x.length < 100)) throw new BadRequest(`${key} must be a list`);
  return v as string[];
}
