import type { Metadata } from "next";
import "./globals.css";
import { WebMCPToolRegistry } from "@/components/webmcp/ToolRegistry";
import { AgentChat } from "@/components/AgentChat";

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
      <body className="antialiased">
        {/* Registers the 8 WebMCP tools on every page (not just home). */}
        <WebMCPToolRegistry />
        {children}
        {/* In-app agent chatbox, available on every page. */}
        <AgentChat />
      </body>
    </html>
  );
}
