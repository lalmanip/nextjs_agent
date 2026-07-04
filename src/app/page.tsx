"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/Components/Header";
import SearchTabs from "@/Components/SearchTabs";
import Services from "@/Components/Services";
import Footer from "@/Components/Footer";
import AgentAssist from "@/Components/AgentAssist";
import {
  bookingState,
  PENDING_BOOKING_KEY,
  PENDING_BOOKING_HOME_BANNER_DISMISSED_KEY,
  type FlightSearchMeta,
  type SearchState,
} from "@/lib/bookingState";
import { commitBooking } from "@/lib/commitBooking";
import { useAgentPortalLoginUrl } from "@/Components/AgentPortalConfigProvider";
import { getUserSessionRaw, syncUserSessionFromCookie } from "@/lib/authSession";

export default function Home() {
  const router = useRouter();
  const agentPortalLoginUrl = useAgentPortalLoginUrl();
  const [user, setUser] = useState<any>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("user");
      return saved ? JSON.parse(saved) : null;
    }
    return null;
  });
  const [showPendingBookingBanner, setShowPendingBookingBanner] = useState(false);

  // Auth gate: agents must sign in via the agent login screen before accessing
  // the B2C app. Skip the redirect on the HDFC payment return (handled below).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("hdfc_return") === "1") return;
    const saved = getUserSessionRaw();
    if (!saved && agentPortalLoginUrl) {
      window.location.href = agentPortalLoginUrl;
    }
  }, [router, agentPortalLoginUrl]);

  // Handle return from HDFC payment gateway (full-page redirect back to /)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("hdfc_return") !== "1") return;

    const orderId = params.get("orderId") || "";
    // Clean params from URL immediately to prevent re-processing on refresh
    window.history.replaceState({}, "", window.location.pathname);

    (async () => {
      try {
        const verifyRes = await fetch(
          `/api/payment/hdfc-verify?orderId=${encodeURIComponent(orderId)}`,
        );
        const orderData = await verifyRes.json();
        console.log("HDFC order verification:", orderData);

        const status: string = orderData?.status || orderData?.order_status || "";
        if (!["CHARGED", "SUCCESS", "PAID"].includes(status.toUpperCase())) {
          alert(
            `Payment was not completed successfully. Status: ${status || "unknown"}. Please try again or contact support.`,
          );
          return;
        }

        const saved = JSON.parse(sessionStorage.getItem("hdfc_pending_booking") || "{}");
        sessionStorage.removeItem("hdfc_pending_booking");

        if (!saved.selectedFlight || !saved.passengerDetails) {
          alert(
            "Booking session data not found. Please contact support with your order ID: " + orderId,
          );
          return;
        }

        const pData = {
          passengerDetails: saved.passengerDetails,
          guestEmail: saved.guestEmail,
          guestMobile: saved.guestMobile,
          cellCountryCode: saved.cellCountryCode || "+91",
          leadPassengerAddress: saved.leadPassengerAddress,
        };

        try {
          const result = await commitBooking(
            saved.selectedFlight,
            pData,
            saved.tripType || "oneway",
          );
          bookingState.saveTicket({
            ticketDetails: result.ticketDetails,
            pnr: result.pnr,
            appReference: result.appReference,
            domainToken: saved.selectedFlight?.domainToken || saved.domainToken || "",
          });
          localStorage.removeItem(PENDING_BOOKING_KEY);
          router.push("/flights/ticket");
        } catch (e) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          const pendingData = {
            flightData: saved.selectedFlight,
            pData,
            tripTypeLocal: saved.tripType || "oneway",
            paymentProof: { gateway: "hdfc" as const, orderId: saved.orderId },
            errorMessage,
          };
          localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(pendingData));
          router.push("/flights/payment/failed");
        }
      } catch (e) {
        console.error("HDFC return handling error:", e);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pending booking (payment ok, commit failed): offer recovery instead of hijacking /
  useEffect(() => {
    try {
      if (sessionStorage.getItem(PENDING_BOOKING_HOME_BANNER_DISMISSED_KEY) === "1") return;
      const saved = localStorage.getItem(PENDING_BOOKING_KEY);
      if (!saved) return;
      const pending = JSON.parse(saved);
      if (!pending?.flightData || !pending?.paymentProof) return;
      setShowPendingBookingBanner(true);
    } catch {}
  }, []);

  const handleSearchComplete = (
    results: any,
    passengers: any,
    token: string,
    tripTypeValue: string,
    searchMeta?: FlightSearchMeta,
  ) => {
    const state: SearchState = {
      results,
      passengers,
      domainToken: token,
      tripType: tripTypeValue,
    };
    if (searchMeta) state.lastSearchMeta = searchMeta;
    bookingState.saveSearch(state);
    router.push("/flights/results");
  };

  const handleHotelSearchComplete = (results: any, params: any) => {
    const maybeList =
      results?.data?.HotelResult ??
      results?.HotelResult ??
      results?.data ??
      results?.hotels ??
      [];
    bookingState.saveHotelSearch({
      results: Array.isArray(maybeList) ? maybeList : [],
      params,
    });
    router.push("/hotels/results");
  };

  const headerProps = {
    onShowProfile: (tab?: string) =>
      router.push(`/dashboard${tab ? `?tab=${tab}` : ""}`),
    onShowHome: () => router.push("/"),
    onSignInSuccess: (userData: any) => {
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
    },
  };

  return (
    <main className="min-h-screen">
      <Header {...headerProps} />
      {showPendingBookingBanner && (
        <div
          role="region"
          aria-label="Incomplete booking"
          className="bg-amber-50 border-b border-amber-200 px-4 py-3 flex flex-wrap items-center justify-center gap-3 text-sm text-amber-950"
        >
          <span className="text-center">
            You have an unfinished flight booking (payment may have gone through but ticketing did not
            complete). You can retry from the recovery page.
          </span>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              className="rounded-lg bg-amber-800 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-900"
              onClick={() => router.push("/flights/payment/failed")}
            >
              Open recovery
            </button>
            <button
              type="button"
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100"
              onClick={() => {
                sessionStorage.setItem(PENDING_BOOKING_HOME_BANNER_DISMISSED_KEY, "1");
                setShowPendingBookingBanner(false);
              }}
            >
              Not now
            </button>
          </div>
        </div>
      )}
      <SearchTabs
        onSearchComplete={handleSearchComplete}
        onHotelSearchComplete={handleHotelSearchComplete}
      />
      <Services />
      <Footer />
      <AgentAssist
        onSelectFlight={(flight) => {
          bookingState.saveFlight({ flight, bookingTimeRemaining: 15 * 60 });
          router.push("/flights/booking");
        }}
      />
    </main>
  );
}
