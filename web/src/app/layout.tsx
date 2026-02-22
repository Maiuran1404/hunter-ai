import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HunterAI — Find Startup Credits & Grants",
  description: "Find and apply for software credits, startup programs, and diversity grants.",
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
