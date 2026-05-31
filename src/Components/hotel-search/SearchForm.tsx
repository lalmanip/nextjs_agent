"use client";

import React, { useMemo, useState } from "react";
import { LocationSearchInput, LocationSearchSelected } from "@/Components/LocationSearchInput";
import {
  HOTEL_MAX_ADULTS_PER_ROOM,
  HOTEL_MAX_CHILDREN_PER_ROOM,
  normalizeHotelRooms,
  RoomRequest,
} from "./types";

function cx(...c: Array<string | false | undefined>) {
  return c.filter(Boolean).join(" ");
}

const STEPS = ["Hotel Search", "Hotel Results", "Guest Details", "Review Booking", "Confirmation"];

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(from: string, to: string): number {
  if (!from || !to) return 1;
  const d1 = new Date(from + "T00:00:00");
  const d2 = new Date(to + "T00:00:00");
  const diff = Math.round((d2.getTime() - d1.getTime()) / 86400000);
  return Math.max(1, diff);
}

export function SearchForm({
  location,
  checkIn,
  checkOut,
  rooms,
  onChange,
  onSearch,
  onOpenMap,
  loading,
}: {
  location: LocationSearchSelected | null;
  checkIn: string;
  checkOut: string;
  rooms: RoomRequest[];
  onChange: (next: {
    location?: LocationSearchSelected | null;
    checkIn?: string;
    checkOut?: string;
    rooms?: RoomRequest[];
  }) => void;
  onSearch: () => void;
  onOpenMap?: () => void;
  loading: boolean;
}) {
  const minDate = useMemo(() => todayIso(), []);
  const [error, setError] = useState<string | null>(null);

  const safeRooms: RoomRequest[] = useMemo(() => normalizeHotelRooms(rooms), [rooms]);

  const nights = useMemo(() => daysBetween(checkIn || minDate, checkOut || addDays(checkIn || minDate, 1)), [checkIn, checkOut, minDate]);

  const setRoomsCount = (count: number) => {
    const nextCount = Math.max(1, Math.min(4, count));
    const next: RoomRequest[] = Array.from({ length: nextCount }, (_, i) => safeRooms[i] || { adults: 2, children: [] });
    onChange({ rooms: next });
  };

  const setAdults = (roomIdx: number, n: number) => {
    const next = [...safeRooms];
    next[roomIdx] = { ...next[roomIdx], adults: Math.max(1, Math.min(HOTEL_MAX_ADULTS_PER_ROOM, n)) };
    onChange({ rooms: next });
  };

  const setChildrenCount = (roomIdx: number, n: number) => {
    const next = [...safeRooms];
    const count = Math.max(0, Math.min(HOTEL_MAX_CHILDREN_PER_ROOM, n));
    const prevAges = Array.isArray(next[roomIdx]?.children) ? next[roomIdx].children : [];
    next[roomIdx] = {
      ...next[roomIdx],
      children: Array.from({ length: count }, (_, i) => (Number.isFinite(prevAges[i]) ? prevAges[i] : 8)),
    };
    onChange({ rooms: next });
  };

  const setChildAge = (roomIdx: number, childIdx: number, age: number) => {
    const next = [...safeRooms];
    const ages = [...(next[roomIdx]?.children || [])];
    ages[childIdx] = Math.max(0, Math.min(17, age));
    next[roomIdx] = { ...next[roomIdx], children: ages };
    onChange({ rooms: next });
  };

  const validateAndSearch = () => {
    if (!location) return setError("Please select a city or hotel.");
    if (!checkIn || !checkOut) return setError("Please select dates.");
    if (checkOut <= checkIn) return setError("Check-out must be after check-in.");
    if (!safeRooms.length) return setError("Please add at least one room.");
    for (let i = 0; i < safeRooms.length; i++) {
      const r = safeRooms[i];
      if (!r?.adults || r.adults < 1) return setError(`Room ${i + 1}: please select at least 1 adult.`);
      if (r.adults > HOTEL_MAX_ADULTS_PER_ROOM)
        return setError(`Room ${i + 1}: at most ${HOTEL_MAX_ADULTS_PER_ROOM} adults per room.`);
      if (!Array.isArray(r.children)) return setError(`Room ${i + 1}: invalid children ages.`);
      if (r.children.length > HOTEL_MAX_CHILDREN_PER_ROOM)
        return setError(`Room ${i + 1}: at most ${HOTEL_MAX_CHILDREN_PER_ROOM} children per room.`);
    }
    setError(null);
    onSearch();
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Stepper (same look as legacy HotelSearch.tsx) */}
      <div className="flex items-center mb-6 overflow-x-auto pb-1">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${
                  i === 0 ? "border-orange-500 text-orange-500" : "border-gray-300 text-gray-400"
                }`}
              >
                {i + 1}
              </span>
              <span className={`text-sm font-medium whitespace-nowrap ${i === 0 ? "text-orange-500" : "text-gray-400"}`}>
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="mx-2 text-gray-300 text-xs tracking-widest select-none">·········</span>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {/* City Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Enter City or Hotel Name</label>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <LocationSearchInput
                initialSelected={location}
                onSelect={(sel) => {
                  onChange({ location: sel });
                  setError(null);
                }}
              />
            </div>
            {onOpenMap && (
              <>
                <span className="text-gray-500 text-sm font-semibold flex-shrink-0">OR</span>
                <button
                  type="button"
                  onClick={onOpenMap}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline flex-shrink-0"
                >
                  <span className="text-orange-500">📍</span>
                  Search On Map
                </button>
              </>
            )}
          </div>
        </div>

        {/* Check In | Nights | Check Out */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check In</label>
            <input
              type="date"
              value={checkIn}
              min={minDate}
              onChange={(e) => {
                const next = e.target.value;
                onChange({ checkIn: next, checkOut: checkOut && checkOut > next ? checkOut : addDays(next, 1) });
                setError(null);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nights</label>
            <input
              type="number"
              value={nights}
              min={1}
              onChange={(e) => {
                const nextNights = Math.max(1, Number(e.target.value || 1));
                const base = checkIn || minDate;
                onChange({ checkOut: addDays(base, nextNights) });
                setError(null);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check Out</label>
            <input
              type="date"
              value={checkOut}
              min={addDays(checkIn || minDate, 1)}
              onChange={(e) => {
                onChange({ checkOut: e.target.value });
                setError(null);
              }}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Guests */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Guests</label>
          <div className="rounded border border-gray-200 bg-white px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">Rooms</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRoomsCount(safeRooms.length - 1)}
                  className="h-7 w-7 rounded border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  −
                </button>
                <div className="w-6 text-center text-sm font-semibold text-gray-900">{safeRooms.length}</div>
                <button
                  type="button"
                  onClick={() => setRoomsCount(safeRooms.length + 1)}
                  className="h-7 w-7 rounded border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                >
                  +
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-3">
              {safeRooms.map((r, roomIdx) => {
                const childrenCount = r.children.length;
                return (
                  <div key={roomIdx} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="text-sm font-semibold text-gray-800">Room {roomIdx + 1}</div>

                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">Adults</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAdults(roomIdx, r.adults - 1)}
                            className="h-8 w-8 rounded border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                          >
                            −
                          </button>
                          <div className="w-8 text-center text-sm font-semibold text-gray-900">{r.adults}</div>
                          <button
                            type="button"
                            onClick={() => setAdults(roomIdx, r.adults + 1)}
                            className="h-8 w-8 rounded border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-semibold text-gray-600 mb-1">Children</div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setChildrenCount(roomIdx, childrenCount - 1)}
                            className="h-8 w-8 rounded border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                          >
                            −
                          </button>
                          <div className="w-8 text-center text-sm font-semibold text-gray-900">{childrenCount}</div>
                          <button
                            type="button"
                            onClick={() => setChildrenCount(roomIdx, childrenCount + 1)}
                            className="h-8 w-8 rounded border border-gray-200 text-sm font-bold text-gray-700 hover:bg-gray-50"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {childrenCount > 0 && (
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold text-gray-600 mb-1">Children ages</div>
                        <div className="flex flex-wrap gap-2">
                          {r.children.map((age, childIdx) => (
                            <input
                              key={childIdx}
                              type="number"
                              inputMode="numeric"
                              min={0}
                              max={17}
                              value={Number.isFinite(age) ? age : ""}
                              placeholder="Age"
                              onChange={(e) => setChildAge(roomIdx, childIdx, Number(e.target.value || 0))}
                              className="w-16 border border-gray-300 rounded px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={validateAndSearch}
          disabled={loading}
          className={cx(
            "w-full md:w-auto md:min-w-[220px] px-6 py-3 rounded font-semibold text-white",
            "disabled:opacity-60 disabled:cursor-not-allowed",
            "bg-[#1e3a5f] hover:opacity-95"
          )}
        >
          {loading ? "Searching..." : "Hotel Search"}
        </button>

        {error && <div className="text-xs text-red-600">{error}</div>}
      </div>
    </div>
  );
}

