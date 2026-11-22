import type { Metadata } from "next";
import { Bebas_Neue, Inter } from "next/font/google";
import { RouteLoaderHold } from "@/components/ui/loader";
import "./globals.css";

// Display font for titles and the logo; Inter for everything you read.
const display = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "Marquee Cinemas",
  description: "See what's showing and book your seats online.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} dark`}>
      <body className="min-h-screen bg-neutral-950 font-sans text-neutral-100 antialiased">
        {children}
        {/* Keeps page-to-page loaders on screen for at least 1.2 s. */}
        <RouteLoaderHold />
      </body>
    </html>
  );
}
