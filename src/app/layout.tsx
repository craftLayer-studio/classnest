import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "https://classnest.craftlayer.store"),
  title: { default: "ClassNest: attendance, fees and admissions for coaching institutes", template: "%s | ClassNest" },
  description: "QR attendance with parent WhatsApp alerts, UPI fee collection with reminders, report cards and a demo-class enquiry CRM for Indian coaching institutes, tuition centres and academies.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
