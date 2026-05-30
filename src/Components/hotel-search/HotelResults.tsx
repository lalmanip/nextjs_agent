"use client";

import React from "react";
import { HotelApiItem } from "./types";
import { HotelCard } from "./HotelCard";

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden animate-pulse">
      <div className="flex">
        <div className="w-40 min-h-[140px] bg-gradient-to-br from-orange-100 to-orange-200 flex-shrink-0" />
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
              <div className="h-3 bg-gray-100 rounded-lg w-1/3" />
              <div className="h-3 bg-gray-100 rounded-lg w-2/3" />
              <div className="flex gap-2 mt-3">
                <div className="h-5 w-16 bg-orange-100 rounded-full" />
                <div className="h-5 w-20 bg-orange-100 rounded-full" />
                <div className="h-5 w-14 bg-orange-100 rounded-full" />
              </div>
            </div>
            <div className="flex-shrink-0 text-right space-y-1.5">
              <div className="h-3 w-12 bg-gray-100 rounded ml-auto" />
              <div className="h-7 w-24 bg-orange-100 rounded-lg ml-auto" />
              <div className="h-3 w-14 bg-gray-100 rounded ml-auto" />
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3 space-y-2">
        <div className="h-3 w-24 bg-gray-200 rounded" />
        <div className="h-12 bg-gray-100 rounded-xl" />
        <div className="h-12 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

export function HotelResults({
  hotels,
  loading,
  error,
  selectedRooms,
  onSelectRoom,
}: {
  hotels: HotelApiItem[];
  loading: boolean;
  error: string | null;
  selectedRooms: Record<string, string | undefined>;
  onSelectRoom: (hotelCode: string, bookingCode: string) => void;
}) {
  if (!loading && error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-5 flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">⚠️</div>
        <div>
          <div className="text-sm font-semibold text-red-700">Search failed</div>
          <div className="text-sm text-red-600 mt-0.5">{error}</div>
        </div>
      </div>
    );
  }

  if (!loading && hotels.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-14 text-center shadow-sm">
        <div className="mx-auto h-16 w-16 rounded-full bg-orange-50 flex items-center justify-center">
          <span className="text-3xl">🏨</span>
        </div>
        <div className="mt-4 text-base font-bold text-gray-800">No hotels found</div>
        <div className="mt-1 text-sm text-gray-500">Try adjusting your filters, dates, or location.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loading && hotels.length === 0 && (
        <>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </>
      )}

      {hotels.map((h) => (
        <HotelCard
          key={h.hotelCode}
          hotel={h}
          selectedBookingCode={selectedRooms[h.hotelCode] || null}
          onSelectRoom={onSelectRoom}
        />
      ))}
    </div>
  );
}
