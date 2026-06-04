"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/Components/Header";
import PaymentScreen from "@/Components/PaymentScreen";
import Footer from "@/Components/Footer";
import {
  bookingState,
  PENDING_BOOKING_KEY,
  HDFC_PENDING_MY_BOOKINGS_GET_TICKET_KEY,
  type SelectedFlightState,
  type SearchState,
  type PaymentDataState,
} from "@/lib/bookingState";
import { commitBooking, commitBookingSkipBook } from "@/lib/commitBooking";
import { isFlightHoldFeatureEnabled } from "@/lib/flightHoldConfig";
import { redeemCoupon } from "@/lib/couponClient";

export default function PaymentPage() {
  const router = useRouter();

  // All state starts as null on both server and client to avoid hydration mismatch.
  // sessionStorage and localStorage are only read inside useEffect (client-only).
  const [mounted, setMounted] = useState(false);
  const [flightState, setFlightState] = useState<SelectedFlightState | null>(null);
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentDataState | null>(null);
  const [bookingTimeRemaining, setBookingTimeRemaining] = useState(15 * 60);
  const [user, setUser] = useState<any>(null);
  const [hdfcProcessing, setHdfcProcessing] = useState(false);
  const [hdfcError, setHdfcError] = useState("");

  useEffect(() => {
    // Read all browser storage after hydration so server and initial client renders match.
    const flight = bookingState.getFlight();
    const search = bookingState.getSearch();
    const payment = bookingState.getPayment();

    setFlightState(flight);
    setSearchState(search);
    setPaymentData(payment);
    setBookingTimeRemaining(flight?.bookingTimeRemaining ?? 15 * 60);

    try {
      const savedUser = localStorage.getItem("user");
      if (savedUser) setUser(JSON.parse(savedUser));
    } catch {}

    setMounted(true);
  }, []);

  // Redirect away if no booking data and this is not an HDFC return (must run before the handler
  // that strips `hdfc_return` from the URL, otherwise we cannot detect return vs. deep-link).
  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    const isHdfcReturn = params.get("hdfc_return") === "1";
    if (!isHdfcReturn && (!flightState?.flight || !paymentData)) {
      router.replace("/");
    }
  }, [mounted, flightState, paymentData, router]);

  // Handle HDFC return redirect: /flights/payment?hdfc_return=1&orderId=X
  useEffect(() => {
    if (!mounted) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("hdfc_return") !== "1") return;

    const orderId = params.get("orderId") || "";
    window.history.replaceState({}, "", window.location.pathname);

    setHdfcProcessing(true);

    (async () => {
      try {
        const myBookingsRaw = sessionStorage.getItem(HDFC_PENDING_MY_BOOKINGS_GET_TICKET_KEY);
        if (myBookingsRaw) {
          let savedMb: Record<string, unknown>;
          try {
            savedMb = JSON.parse(myBookingsRaw) as Record<string, unknown>;
          } catch {
            sessionStorage.removeItem(HDFC_PENDING_MY_BOOKINGS_GET_TICKET_KEY);
            setHdfcError("Invalid payment recovery session. Please try Get Ticket again from My Bookings.");
            setHdfcProcessing(false);
            return;
          }
          sessionStorage.removeItem(HDFC_PENDING_MY_BOOKINGS_GET_TICKET_KEY);

          const pnr = String(savedMb.pnr ?? "").trim();
          const bookingId = Number(savedMb.bookingId);
          if (!pnr || !Number.isFinite(bookingId) || bookingId <= 0) {
            setHdfcError(
              "Booking session data not found. Please contact support with your order ID: " + orderId,
            );
            setHdfcProcessing(false);
            return;
          }

          const domainToken: string = String(savedMb.domainToken || "");
          const validRes = await fetch("/api/payment/validate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${domainToken}`,
            },
            body: JSON.stringify({ orderId, pgateway: "hdfc" }),
          });
          const validData = await validRes.json();
          console.log("HDFC payment validation (My Bookings get ticket):", validData);

          if (validData.validationResult !== "VALID") {
            setHdfcError(
              `Payment validation failed: ${validData.validationResult || validData.status || "unknown"}. Please contact support with order ID: ${orderId}`,
            );
            setHdfcProcessing(false);
            return;
          }

          try {
            const result = await commitBookingSkipBook(pnr, bookingId);
            bookingState.saveTicket({
              ticketDetails: result.ticketDetails,
              pnr: result.pnr,
              appReference: result.appReference,
              domainToken: result.domainToken ?? domainToken,
            });
            localStorage.removeItem(PENDING_BOOKING_KEY);
            router.push("/flights/ticket");
          } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            setHdfcError(errorMessage || "Ticketing failed after payment. Please contact support.");
            setHdfcProcessing(false);
          }
          return;
        }

        const saved = JSON.parse(sessionStorage.getItem("hdfc_pending_booking") || "{}");
        sessionStorage.removeItem("hdfc_pending_booking");

        if (!saved.selectedFlight || !saved.passengerDetails) {
          setHdfcError(
            "Booking session data not found. Please contact support with your order ID: " + orderId,
          );
          setHdfcProcessing(false);
          return;
        }

        const domainToken: string = saved.domainToken || "";
        const validRes = await fetch("/api/payment/validate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${domainToken}`,
          },
          body: JSON.stringify({ orderId, pgateway: "hdfc" }),
        });
        const validData = await validRes.json();
        console.log("HDFC payment validation:", validData);

        if (validData.validationResult !== "VALID") {
          setHdfcError(
            `Payment validation failed: ${validData.validationResult || validData.status || "unknown"}. Please contact support with order ID: ${orderId}`,
          );
          setHdfcProcessing(false);
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
            paymentValidation: validData ?? null,
            appReference: (e as { appReference?: string })?.appReference || "",
            partialPnr: (e as { pnr?: string })?.pnr || "",
            failedAt: new Date().toISOString(),
            errorMessage,
          };
          localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(pendingData));
          router.push("/flights/payment/failed");
        }
      } catch (e) {
        console.error("HDFC return handling error:", e);
        setHdfcError("An unexpected error occurred. Please contact support.");
        setHdfcProcessing(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Render nothing until client hydration is complete (prevents SSR mismatch)
  if (!mounted) return null;

  // Show processing state while HDFC return is being handled
  if (hdfcProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-gray-600 text-lg font-medium">Confirming your payment…</p>
          <p className="text-gray-400 text-sm mt-1">Please do not close or refresh this page.</p>
        </div>
      </div>
    );
  }

  if (hdfcError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-4">
          <p className="text-red-600 font-medium mb-4">{hdfcError}</p>
          <button
            onClick={() => router.push("/")}
            className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  if (!flightState?.flight || !paymentData) return null;

  const tripType = searchState?.tripType ?? "oneway";
  const passengers = searchState?.passengers ?? { adults: 1, children: 0, infants: 0 };

  const handlePaymentSuccess = async (
    validationData: any,
    paymentProof: {
      gateway: "razorpay" | "hdfc" | "wallet";
      payId?: string;
      orderId?: string;
      appReference?: string;
    },
  ) => {
    const pData = {
      passengerDetails: paymentData.passengerDetails,
      guestEmail: paymentData.guestEmail,
      guestMobile: paymentData.guestMobile,
      cellCountryCode: paymentData.cellCountryCode || "+91",
      leadPassengerAddress: paymentData.leadPassengerAddress,
    };
    try {
      const result = await commitBooking(flightState.flight, pData, tripType);
      const userOid = Number(user?.userId);
      if (paymentData.appliedToken && userOid > 0) {
        void redeemCoupon({
          appliedToken: paymentData.appliedToken,
          userOid,
          appReference: result.appReference,
          paymentOrderId: paymentProof.orderId,
        }).catch((err) => console.warn("[coupon] redeem failed:", err));
      }
      bookingState.saveTicket({
        ticketDetails: result.ticketDetails,
        pnr: result.pnr,
        appReference: result.appReference,
        domainToken: flightState.flight?.domainToken || searchState?.domainToken || "",
      });
      localStorage.removeItem(PENDING_BOOKING_KEY);
      router.push("/flights/ticket");
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const pendingData = {
        flightData: flightState.flight,
        pData,
        tripTypeLocal: tripType,
        paymentProof,
        paymentValidation: validationData ?? null,
        appReference: (e as { appReference?: string })?.appReference || "",
        partialPnr: (e as { pnr?: string })?.pnr || "",
        failedAt: new Date().toISOString(),
        errorMessage,
      };
      localStorage.setItem(PENDING_BOOKING_KEY, JSON.stringify(pendingData));
      router.push("/flights/payment/failed");
    }
  };

  const headerProps = {
    onShowProfile: (tab?: string) =>
      router.push(`/dashboard${tab ? `?tab=${tab}` : ""}`),
    onShowHolidays: () => router.push("/holidays"),
    onShowHome: () => router.push("/"),
    onSignInSuccess: (userData: any) => {
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
    },
  };

  return (
    <>
      <Header {...headerProps} />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {isFlightHoldFeatureEnabled() && flightState.holdBooking && (
            <div className="mb-6 rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-3 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">🔒</span>
              <div>
                <div className="font-bold text-sm text-blue-800">Hold Booking</div>
                <div className="text-xs text-blue-700 mt-0.5">
                  Your seat will be reserved but the ticket will <strong>not</strong> be issued immediately.
                  Complete payment to confirm and receive your ticket.
                </div>
              </div>
            </div>
          )}
          <PaymentScreen
            selectedFlight={flightState.flight}
            passengers={passengers}
            passengerDetails={paymentData.passengerDetails}
            guestEmail={paymentData.guestEmail}
            guestMobile={paymentData.guestMobile}
            cellCountryCode={paymentData.cellCountryCode || "+91"}
            discount={paymentData.discount}
            promoCode={paymentData.promoCode}
            leadPassengerAddress={paymentData.leadPassengerAddress}
            tripType={tripType}
            timeRemaining={bookingTimeRemaining}
            onPaymentSuccess={handlePaymentSuccess}
            onBack={() => router.push("/flights/booking")}
            user={user}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
