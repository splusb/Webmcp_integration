import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenSource Discovery Hub",
  description: "Find your next open source contribution in minutes, not hours. Powered by WebMCP.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
