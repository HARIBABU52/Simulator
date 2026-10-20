import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NIFTY Trading Simulator | Strategy Backtester",
  description: "Professional NIFTY 50 candlestick chart simulator with order placement and strategy P&L backtesting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="" style={{ height: '100vh', overflow: 'hidden' }} suppressHydrationWarning>{children}</body>
    </html>
  );
}
