"use client";

import React from "react";
import { HotelApiItem } from "./types";

function cx(...c: Array<string | false | undefined>) {
  return c.filter(Boolean).join(" ");
}

function StarBar({ rating, starRating }: { rating: number; starRating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(starRating || rating)));
  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            className={cx("h-3.5 w-3.5", i <= filled ? "text-amber-400" : "text-gray-200")}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      {rating > 0 && (
        <span className="text-[11px] font-semibold text-amber-600">{rating.toFixed(1)}</span>
      )}
    </div>
  );
}

export function HotelCard({
  hotel,
  selectedBookingCode,
  onSelectRoom,
}: {
  hotel: HotelApiItem;
  selectedBookingCode?: string | null;
  onSelectRoom?: (hotelCode: string, bookingCode: string) => void;
}) {
  const cheapest = hotel.rooms?.[0];

  return (
    <div className="w-full rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-lg hover:border-orange-100 transition-all duration-200 overflow-hidden group">

      {/* Top section */}
      <div className="flex">

        {/* Image panel */}
        <div className="relative w-40 flex-shrink-0 bg-gradient-to-br from-orange-400 via-primary to-orange-600 flex flex-col items-center justify-center min-h-[140px]">
          <div className="text-5xl select-none drop-shadow">🏨</div>
          {hotel.starRating > 0 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center">
              <span className="bg-black/30 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                {"★".repeat(Math.min(5, hotel.starRating))}
              </span>
            </div>
          )}
        </div>

        {/* Info panel */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-gray-900 text-base leading-snug line-clamp-2">
                {hotel.name || `Hotel ${hotel.hotelCode}`}
              </div>
              <div className="mt-1.5">
                <StarBar rating={hotel.rating} starRating={hotel.starRating} />
              </div>
              {hotel.address && (
                <div className="mt-1.5 flex items-start gap-1 text-xs text-gray-500">
                  <svg className="h-3.5 w-3.5 flex-shrink-0 mt-px text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="line-clamp-1">{hotel.address}</span>
                </div>
              )}
            </div>

            {/* Price */}
            <div className="flex-shrink-0 text-right">
              <div className="text-[10px] uppercase tracking-wide text-gray-400 font-medium">From</div>
              <div className="text-2xl font-extrabold text-primary leading-none mt-0.5">
                {Math.round(hotel.startingPrice).toLocaleString()}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">{hotel.currency} / night</div>
            </div>
          </div>

          {/* Amenity pills */}
          {hotel.amenities?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hotel.amenities.slice(0, 5).map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-orange-50 border border-orange-100 px-2.5 py-0.5 text-[11px] font-medium text-orange-700"
                >
                  {a}
                </span>
              ))}
              {hotel.amenities.length > 5 && (
                <span className="rounded-full bg-gray-50 border border-gray-200 px-2.5 py-0.5 text-[11px] text-gray-500">
                  +{hotel.amenities.length - 5} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Room options */}
      {hotel.rooms?.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/60 px-4 pt-3 pb-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Room Options</div>
            {cheapest && (
              <div className="text-xs text-gray-400">
                Best from{" "}
                <span className="font-semibold text-primary">
                  {hotel.currency} {Math.round(cheapest.totalFare).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {hotel.rooms.slice(0, 4).map((r) => {
              const checked = selectedBookingCode === r.bookingCode;
              return (
                <label
                  key={r.bookingCode}
                  className={cx(
                    "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-150",
                    checked
                      ? "border-primary bg-orange-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/40"
                  )}
                >
                  <input
                    type="radio"
                    name={`room-${hotel.hotelCode}`}
                    checked={checked}
                    onChange={() => onSelectRoom?.(hotel.hotelCode, r.bookingCode)}
                    className="accent-primary mt-0.5 flex-shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-gray-900 truncate">{r.name}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {[r.mealType, r.inclusion].filter(Boolean).join(" · ") || "Standard room"}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span
                        className={cx(
                          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
                          r.refundable
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-600 border border-red-200"
                        )}
                      >
                        {r.refundable ? "✓ Refundable" : "Non-refundable"}
                      </span>
                      {r.totalTax > 0 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          +{hotel.currency} {Math.round(r.totalTax).toLocaleString()} tax
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="font-bold text-gray-900 text-base">
                      {hotel.currency} {Math.round(r.totalFare).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-400">total</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
