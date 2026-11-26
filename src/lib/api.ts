/** POST JSON to an API route; throws an Error with the server's message on failure. */
export async function post<T = Record<string, unknown>>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export const rupeesInput = (paise: number) => Math.round(paise) / 100;
