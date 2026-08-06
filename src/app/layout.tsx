import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CANexus — A Skills-First Career Operating System for Canada",
  description:
    "Build a living Skills Passport, get explainable AI career guidance, and connect with mentors and employers hiring on capability, not just résumés.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-body">{children}</body>
    </html>
  );
}
