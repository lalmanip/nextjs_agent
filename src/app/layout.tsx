import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { DateLocaleProvider } from "@/Components/DateLocaleProvider";
import EnvRibbon from "@/Components/EnvRibbon";
import { HeaderNavConfigProvider } from "@/Components/HeaderNavConfigProvider";
import { getAllHeaderNavModes } from "@/lib/headerNavConfig";
import { parseEnvRibbonLabel } from "@/lib/envRibbon";

/** Pod env (APP_ENVIRONMENT, HEADER_NAV_*) is applied at runtime — do not bake at build only. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vivance Travels - Book Flights, Hotels, Cruises & Holiday Packages",
  description: "Your trusted travel partner for flights, hotels, cruises, and holiday packages worldwide.",
  icons: {
    icon: [{ url: "/vivance-logo.png", type: "image/png" }],
    apple: [{ url: "/vivance-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const envRibbonLabel = parseEnvRibbonLabel();
  const headerNavModes = getAllHeaderNavModes();
  const ribbonStyle = envRibbonLabel
    ? ({ ["--env-ribbon-height" as string]: "2rem" } as React.CSSProperties)
    : undefined;

  return (
    <html lang="en" style={ribbonStyle}>
      <body className="antialiased overflow-x-clip">
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        {envRibbonLabel ? <EnvRibbon label={envRibbonLabel} /> : null}
        <HeaderNavConfigProvider modes={headerNavModes}>
          <DateLocaleProvider>{children}</DateLocaleProvider>
        </HeaderNavConfigProvider>
      </body>
    </html>
  );
}