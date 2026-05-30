"use client";
import FlightSearch from "./FlightSearch";

interface SearchTabsProps {
  onSearchComplete: (
    results: any,
    passengers: any,
    token: string,
    tripType: string,
    searchMeta?: { request: import("@/lib/api").FlightSearchRequest; searchApi: "search" | "advance" },
  ) => void;
  onHotelSearchComplete?: (results: any, params: any) => void;
  initialTripType?: string;
}

export default function SearchTabs({ onSearchComplete, initialTripType }: SearchTabsProps) {

  return (
    <section className="py-12 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FlightSearch onSearchComplete={onSearchComplete} initialTripType={initialTripType} />
      </div>
    </section>
  );
}