"use client";

import {
  formatSeatsAvailableLabel,
  getSeatsAvailableForJourney,
} from "@/lib/flightSearchAttr";

/** Shows `noOfSeatAvailable` from search `segments` under route timing (per journey). */
export default function FlightSeatsAvailableHint({
  variant,
  journeyIndex = 0,
  className = "",
}: {
  variant: unknown;
  journeyIndex?: number;
  className?: string;
}) {
  const seats = getSeatsAvailableForJourney(variant, journeyIndex);
  if (seats == null) return null;

  const urgent = seats <= 5;

  return (
    <div
      className={`text-[10px] font-semibold text-center leading-tight ${className} ${
        urgent ? "text-red-600" : "text-gray-500"
      }`}
    >
      {formatSeatsAvailableLabel(seats)}
    </div>
  );
}
