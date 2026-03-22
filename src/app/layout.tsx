import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vivance Travel Agent Portal",
  description: "B2B Agent Module for Travel Professionals",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-orange-950 via-orange-900 to-stone-900">
        {children}
      </body>
    </html>
  );
}
