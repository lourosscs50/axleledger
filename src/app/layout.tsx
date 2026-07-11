import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Axleledger",
    template: "%s | Axleledger",
  },
  description:
    "A mobile-first profitability dashboard for owner-operators and lease-purchase truck drivers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}