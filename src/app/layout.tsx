import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Appointment booking with calendar sync and video links",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.png?v=20260813e", type: "image/png", sizes: "192x192" },
      { url: "/favicon.ico?v=20260813e", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-icon.png?v=20260813e", sizes: "180x180" }],
    shortcut: "/icon.png?v=20260813e",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
