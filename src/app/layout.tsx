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

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "https://flex-money.app";

const siteTitle = "Flex Money - Send Money Abroad with Confidence";
const siteDescription =
  "Fast, secure international money transfers to 100+ countries. Send to bank accounts, mobile wallets, or cash pickup. Competitive exchange rates and transparent fees.";

export const metadata: Metadata = {
  metadataBase: new URL(
    siteUrl.startsWith("http://") || siteUrl.startsWith("https://")
      ? siteUrl
      : `https://${siteUrl}`,
  ),
  title: siteTitle,
  description: siteDescription,
  keywords: [
    "remittance",
    "money transfer",
    "send money",
    "international transfer",
    "cross border payments",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Flex Money",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/images/og-thumbnail.jpeg",
        width: 1200,
        height: 630,
        alt: "Flex Money Transfer — Global payments, made simple",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/images/og-thumbnail.jpeg"],
  },
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
