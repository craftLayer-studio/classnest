/** Indian mobile numbers in E.164: +91 followed by 10 digits starting 6-9. */
const E164_IN = /^\+91[6-9]\d{9}$/;

/**
 * Normalise user input like "98260 11111", "098260-11111" or "+91 98260 11111" to "+919826011111".
 * Returns null when the input is not a valid Indian mobile number.
 */
export function normalizeIndianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let core: string;
  if (/^\+91\d{10}$/.test(digits)) core = digits.slice(3);
  else if (/^91\d{10}$/.test(digits)) core = digits.slice(2);
  else if (/^0\d{10}$/.test(digits)) core = digits.slice(1);
  else if (/^\d{10}$/.test(digits)) core = digits;
  else return null;
  const e164 = `+91${core}`;
  return E164_IN.test(e164) ? e164 : null;
}

/** "+919826011111" -> "+91 98260 11111". */
export function formatPhone(e164: string): string {
  if (!E164_IN.test(e164)) return e164;
  return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
}

/** Show only the last 4 digits, for public pages. */
export function maskPhone(e164: string): string {
  return `+91 ••••• •${e164.slice(-4)}`;
}
