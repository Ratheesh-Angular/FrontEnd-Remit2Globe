import type { Metadata } from "next";
import { Inter, DM_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "Amigo - Send Money Abroad with Confidence",
  description:
    "Fast, secure international money transfers to 97+ countries. Send to bank accounts, mobile wallets, or cash pickup. Competitive exchange rates and transparent fees.",
  keywords: [
    "remittance",
    "money transfer",
    "send money",
    "international transfer",
    "cross border payments",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${dmSans.variable}`}>
      <body className="font-inter antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
