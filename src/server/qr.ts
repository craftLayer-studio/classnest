import QRCode from "qrcode";

/** Server-side QR as an SVG data URL, for <img> tags and printing. */
export async function qrDataUrl(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
