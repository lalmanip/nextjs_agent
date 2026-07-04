"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/Components/Header";
import FlightResults from "@/Components/FlightResults";
import AdvanceSearchResults from "@/Components/AdvanceSearchResults";
import CalendarFareResults from "@/Components/CalendarFareResults";
import Footer from "@/Components/Footer";
import AgentAssist from "@/Components/AgentAssist";
import { bookingState, type SearchState, type FlightSearchMeta } from "@/lib/bookingState";
import { isFlightHoldBookingActive } from "@/lib/flightHoldConfig";
import { flightAPI } from "@/lib/api";
import FlightSearchLoading from "@/Components/FlightSearchLoading";
import {
  shiftFlightSearchSegments,
  passengersAfterDateShift,
  syncSessionStoredFlightSearchForm,
  getFlightSearchLoadingPropsForState,
} from "@/lib/flightSearchDateShift";

export default function FlightResultsPage() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const [user, setUser] = useState<any>(null);
  const [dateShiftLoading, setDateShiftLoading] = useState(false);
  const [dateShiftDelta, setDateShiftDelta] = useState(0);

  useEffect(() => {
    setSearchState(bookingState.getSearch());
    try {
      const saved = localStorage.getItem("user");
      if (saved) setUser(JSON.parse(saved));
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !searchState) router.replace("/");
  }, [mounted, searchState, router]);

  const handleDateShift = useCallback(
    async (deltaDays: number) => {
      if (!searchState?.lastSearchMeta?.request) return;
      setDateShiftDelta(deltaDays);
      setDateShiftLoading(true);
      try {
        const meta = searchState.lastSearchMeta;
        const shifted = shiftFlightSearchSegments(meta.request, deltaDays);
        const token = await flightAPI.getDomainToken();
        const results =
          meta.searchApi === "advance"
            ? await flightAPI.searchAdvancedFlights(shifted, token)
            : await flightAPI.searchFlights(shifted, token);

        const nextPassengers = passengersAfterDateShift(
          searchState.passengers as Record<string, unknown>,
          shifted,
        );
        syncSessionStoredFlightSearchForm(nextPassengers);

        const updated: SearchState = {
          results,
          passengers: nextPassengers as SearchState["passengers"],
          domainToken: token,
          tripType: searchState.tripType,
          lastSearchMeta: { request: shifted, searchApi: meta.searchApi },
        };
        bookingState.saveSearch(updated);
        setSearchState(updated);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Search failed. Please try again.");
      } finally {
        setDateShiftLoading(false);
        setDateShiftDelta(0);
      }
    },
    [searchState],
  );

  if (!mounted || !searchState) return null;

  const { results, passengers, domainToken, tripType } = searchState;

  const handleSelectFlight = (flight: any) => {
    bookingState.saveFlight({
      flight,
      bookingTimeRemaining: 15 * 60,
      holdBooking: isFlightHoldBookingActive(flight),
    });
    router.push("/flights/booking");
  };

  const handleSearchComplete = (
    newResults: any,
    newPassengers: any,
    newToken: string,
    newTripType: string,
    searchMeta?: FlightSearchMeta,
  ) => {
    setSearchState((prev) => {
      const updated: SearchState = {
        results: newResults,
        passengers: newPassengers,
        domainToken: newToken,
        tripType: newTripType,
      };
      if (searchMeta) {
        updated.lastSearchMeta = searchMeta;
      } else if (newTripType !== "calendar" && prev?.tripType === newTripType && prev.lastSearchMeta) {
        updated.lastSearchMeta = prev.lastSearchMeta;
      }
      bookingState.saveSearch(updated);
      return updated;
    });
  };

  const showDateShift = Boolean(searchState.lastSearchMeta?.request);
  const dateShiftLoadingProps =
    dateShiftLoading && showDateShift
      ? getFlightSearchLoadingPropsForState(searchState, dateShiftDelta)
      : null;

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
      {dateShiftLoadingProps && <FlightSearchLoading {...dateShiftLoadingProps} />}
      <Header {...headerProps} />
      <main className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {tripType === "advance" ? (
            <AdvanceSearchResults
              results={results}
              passengers={passengers}
              domainToken={domainToken}
              onBack={() => router.push("/")}
              onSelectFlight={handleSelectFlight}
              onDateShift={showDateShift ? handleDateShift : undefined}
              dateShiftLoading={dateShiftLoading}
            />
          ) : tripType === "calendar" ? (
            <CalendarFareResults
              results={results}
              passengers={passengers}
              domainToken={domainToken}
              onBack={() => router.push("/")}
              onFlightSearch={handleSearchComplete}
            />
          ) : (
            <FlightResults
              results={results}
              passengers={passengers}
              domainToken={domainToken}
              tripType={tripType}
              onBack={() => router.push("/")}
              onSelectFlight={handleSelectFlight}
              onDateShift={showDateShift ? handleDateShift : undefined}
              dateShiftLoading={dateShiftLoading}
            />
          )}
        </div>
      </main>
      <Footer />
      <AgentAssist onSelectFlight={handleSelectFlight} />
    </>
  );
}
