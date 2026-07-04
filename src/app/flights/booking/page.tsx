"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/Components/Header";
import FlightBooking from "@/Components/FlightBooking";
import Footer from "@/Components/Footer";
import AgentAssist from "@/Components/AgentAssist";
import {
  bookingState,
  type SelectedFlightState,
  type SearchState,
  type PaymentDataState,
} from "@/lib/bookingState";
import { isFlightHoldFeatureEnabled } from "@/lib/flightHoldConfig";

export default function FlightBookingPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [flightState, setFlightState] = useState<SelectedFlightState | null>(null);
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const [bookingTimeRemaining, setBookingTimeRemaining] = useState(15 * 60);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const flight = bookingState.getFlight();
    setFlightState(flight);
    setSearchState(bookingState.getSearch());
    setBookingTimeRemaining(flight?.bookingTimeRemaining ?? 15 * 60);
    try {
      const saved = localStorage.getItem("user");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !flightState?.flight) router.replace("/");
  }, [mounted, flightState, router]);

  if (!mounted || !flightState?.flight) return null;

  const passengers = searchState?.passengers ?? { adults: 1, children: 0, infants: 0 };
  const tripType = searchState?.tripType ?? "oneway";

  const handleGoToPayment = (
    data: PaymentDataState,
    options?: { holdBooking?: boolean; holdFeeInr?: number | null },
  ) => {
    const hold = isFlightHoldFeatureEnabled() && options?.holdBooking === true;
    const feeRaw = options?.holdFeeInr;
    const holdFeeInr =
      hold && feeRaw != null && Number.isFinite(Number(feeRaw)) && Number(feeRaw) > 0
        ? Math.round(Number(feeRaw))
        : hold
          ? null
          : undefined;
    const current = bookingState.getFlight();
    if (current?.flight) {
      bookingState.saveFlight({
        ...current,
        flight: {
          ...current.flight,
          holdBooking: hold,
          ...(hold ? { holdFeeInr: holdFeeInr ?? undefined } : { holdFeeInr: undefined }),
        },
        holdBooking: hold,
        holdFeeInr: hold ? holdFeeInr ?? null : undefined,
      });
    }
    bookingState.savePayment(data);
    router.push("/flights/payment");
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
    <>
      <Header {...headerProps} />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FlightBooking
            selectedFlight={flightState.flight}
            passengers={passengers}
            user={user}
            tripType={tripType}
            onBack={() => router.push("/flights/results")}
            onGoToPayment={handleGoToPayment}
            timeRemaining={bookingTimeRemaining}
            onTimeUpdate={setBookingTimeRemaining}
          />
        </div>
      </main>
      <Footer />
      <AgentAssist
        onSelectFlight={(flight) => {
          bookingState.saveFlight({ flight, bookingTimeRemaining });
          setFlightState((prev) =>
            prev ? { ...prev, flight, bookingTimeRemaining } : { flight, bookingTimeRemaining },
          );
        }}
      />
    </>
  );
}
