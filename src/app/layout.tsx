import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinBridge · Your financial workspace",
  description: "Your money, your decisions. Track your everyday finances with FinBridge.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/mascots/finbridge-penguin-logo-32.png", sizes: "32x32", type: "image/png" },
      { url: "/mascots/finbridge-penguin-logo-64.png", sizes: "64x64", type: "image/png" },
      { url: "/finbridge-icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/favicon.ico",
    apple: "/mascots/finbridge-penguin-logo-128.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
