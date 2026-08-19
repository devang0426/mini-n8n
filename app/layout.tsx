import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NhostProviderWrapper } from "@/components/providers/NhostProviderWrapper";
import { OrganizationProvider } from "@/lib/auth/org-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Workflo AI — Agent Workflow Builder",
  description: "Multi-tenant AI Agent Workflow Automation Engine & Builder",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F5EFE6] text-[#111111]">
        <NhostProviderWrapper>
          <OrganizationProvider>{children}</OrganizationProvider>
        </NhostProviderWrapper>
      </body>
    </html>
  );
}
