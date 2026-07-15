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
  "Send money to family, pay overseas suppliers, or transfer tuition fees securely from one powerful app. Fast, competitive, and trusted since 2013.";

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
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Flex Money",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/images/flex-money-og.jpeg",
        secureUrl: "/images/flex-money-og.jpeg",
        type: "image/jpeg",
        width: 1600,
        height: 840,
        alt: "Flex Money Transfer — Global payments, made simple",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/images/flex-money-og.jpeg"],
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
