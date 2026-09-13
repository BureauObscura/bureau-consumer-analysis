import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Bureau Obscura | Consumer Analysis Division",
  description:
    "Simulate how a heterogeneous consumer population responds to an Instagram ad, product page, cart, and checkout.",
  icons: { icon: "/favicon.svg" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
