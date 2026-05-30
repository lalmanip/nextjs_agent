import type { Metadata } from "next";
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
      <head>
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      </head>
      <body className="antialiased">
        <DateLocaleProvider>{children}</DateLocaleProvider>
      </body>
    </html>
  );
}