import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { DateLocaleProvider } from "@/Components/DateLocaleProvider";

export const metadata: Metadata = {
  title: "Vivance Travels - Book Flights, Hotels, Cruises & Holiday Packages",
  description: "Your trusted travel partner for flights, hotels, cruises, and holiday packages worldwide.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        <DateLocaleProvider>{children}</DateLocaleProvider>
      </body>
    </html>
  );
}