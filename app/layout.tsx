import type { Metadata } from "next";
import { Azeret_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

const mono = Azeret_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "Attio Cleanup Deck",
  description: "Swipe through Attio companies and delete the ones you do not want.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${mono.variable} ${serif.variable}`}>{children}</body>
    </html>
  );
}
