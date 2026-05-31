"use client";
import { useMemo, useState } from "react";
import { LocationSearchInput, LocationSearchSelected } from "@/Components/LocationSearchInput";
import { useRouter } from "next/navigation";
import { HOTEL_MAX_ADULTS_PER_ROOM, HOTEL_MAX_CHILDREN_PER_ROOM } from "@/Components/hotel-search/types";

interface HotelSearchProps {
  onSearchComplete?: (results: any, params: any) => void;
}

const STEPS = ["Hotel Search", "Hotel Results", "Guest Details", "Review Booking", "Confirmation"];

const CITY_OPTIONS = [
  { city: "New Delhi", cityId: "130443", countryCode: "IN" },
  { city: "Mumbai", cityId: "130983", countryCode: "IN" },
  { city: "Bangalore", cityId: "126904", countryCode: "IN" },
  { city: "Chennai", cityId: "128960", countryCode: "IN" },
  { city: "Kolkata", cityId: "128961", countryCode: "IN" },
  { city: "Hyderabad", cityId: "129312", countryCode: "IN" },
  { city: "Goa", cityId: "129463", countryCode: "IN" },
  { city: "Jaipur", cityId: "129374", countryCode: "IN" },
];

const NATIONALITY_OPTIONS = [
  { label: "Indian", code: "IN" },
  { label: "American", code: "US" },
  { label: "British", code: "GB" },
  { label: "Australian", code: "AU" },
  { label: "Canadian", code: "CA" },
  { label: "German", code: "DE" },
  { label: "French", code: "FR" },
];

const STAR_RATINGS = [
  { value: "", label: "Show All" },
  { value: "5", label: "5 Star" },
  { value: "4", label: "4 Star" },
  { value: "3", label: "3 Star" },
  { value: "2", label: "2 Star" },
  { value: "1", label: "1 Star" },
];

function getISTDate(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function toInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toInputValue(d);
}

function daysBetween(from: string, to: string): number {
  const d1 = new Date(from + "T00:00:00");
  const d2 = new Date(to + "T00:00:00");
  return Math.max(1, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}

export default function HotelSearch({ onSearchComplete }: HotelSearchProps) {
  const router = useRouter();
  const today = getISTDate();
  const todayStr = toInputValue(today);
  const tomorrowStr = addDays(todayStr, 1);

  const [checkIn, setCheckIn] = useState(todayStr);
  const [checkOut, setCheckOut] = useState(tomorrowStr);
  const [nights, setNights] = useState(1);
  const [rooms, setRooms] = useState(1);
  const [roomGuests, setRoomGuests] = useState<
    Array<{ adults: number; children: number; childrenAges: number[] }>
  >([{ adults: 1, children: 0, childrenAges: [] }]);
  const [starRating, setStarRating] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchSelected | null>(null);
  const [nationality, setNationality] = useState("IN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    const list = Array.isArray(roomGuests) ? roomGuests : [];
    return {
      adults: list.reduce((s, r) => s + Math.max(1, Number(r?.adults || 1)), 0),
      children: list.reduce((s, r) => s + Math.max(0, Number(r?.children || 0)), 0),
    };
  }, [roomGuests]);

  const handleCheckInChange = (val: string) => {
    setCheckIn(val);
    setCheckOut(addDays(val, nights));
  };

  const handleNightsChange = (val: string) => {
    const n = Math.max(1, parseInt(val) || 1);
    setNights(n);
    setCheckOut(addDays(checkIn, n));
  };

  const handleCheckOutChange = (val: string) => {
    if (val <= checkIn) return;
    setCheckOut(val);
    setNights(daysBetween(checkIn, val));
  };

  const handleSearch = async () => {
    if (!selectedLocation) {
      setError("Please select a city or hotel.");
      return;
    }
    setError("");

    setLoading(true);
    try {
      const stars = starRating ? [Number(starRating)] : [];
      const safeRoomGuests = Array.isArray(roomGuests) && roomGuests.length
        ? roomGuests
        : [{ adults: 1, children: 0, childrenAges: [] }];
      const roomsPayload = safeRoomGuests.slice(0, Math.max(1, rooms)).map((r) => {
        const adults = Math.max(1, Math.min(HOTEL_MAX_ADULTS_PER_ROOM, Number(r?.adults || 1)));
        const childrenCount = Math.max(0, Math.min(HOTEL_MAX_CHILDREN_PER_ROOM, Number(r?.children || 0)));
        const ages = Array.isArray(r?.childrenAges) ? r.childrenAges : [];
        return {
          adults,
          children: Array.from({ length: childrenCount }, (_, i) => {
            const v = Number(ages[i]);
            return Number.isFinite(v) ? Math.max(0, Math.min(17, v)) : 8;
          }),
        };
      });

      const payload: any = {
        ...(selectedLocation.type === "city" ? { destinationId: Number(selectedLocation.id) } : {}),
        ...(selectedLocation.type === "hotel" ? { hotelCode: String(selectedLocation.id) } : {}),
        checkIn,
        checkOut,
        rooms: roomsPayload,
        filters: {
          priceMin: 0,
          priceMax: 0,
          stars,
        },
        pagination: {
          page: 1,
          size: 20,
        },
      };

      const response = await fetch("/api/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      const params = {
        location: selectedLocation,
        checkIn,
        checkOut,
        nights,
        rooms,
        roomGuests,
        adults: totals.adults,
        children: totals.children,
        guestNationality: nationality,
        starRating,
      };
      try {
        sessionStorage.setItem("vivance_hotel_rooms", JSON.stringify(payload.rooms));
      } catch {}
      onSearchComplete?.(data, params);
    } catch (err: any) {
      console.error("[HotelSearch] API error:", err);
      setError(err.message || "Failed to search hotels. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Stepper */}
      <div className="flex items-center mb-6 overflow-x-auto pb-1">
        {STEPS.map((step, i) => (
          <div key={step} className="flex items-center flex-shrink-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 ${
                  i === 0
                    ? "border-orange-500 text-orange-500"
                    : "border-gray-300 text-gray-400"
                }`}
              >
                {i + 1}
              </span>
              <span
                className={`text-sm font-medium whitespace-nowrap ${
                  i === 0 ? "text-orange-500" : "text-gray-400"
                }`}
              >
                {step}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className="mx-2 text-gray-300 text-xs tracking-widest select-none">
                ·········
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {/* City Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Enter City or Hotel Name
          </label>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <LocationSearchInput
                onSelect={(sel) => {
                  setSelectedLocation(sel);
                  setError("");
                }}
              />
            </div>
            <span className="text-gray-500 text-sm font-semibold flex-shrink-0">OR</span>
            <button
              type="button"
              onClick={() => router.push("/hotels?openMap=1")}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline flex-shrink-0"
            >
              <span className="text-orange-500">📍</span>
              Search On Map
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>

        {/* Check In | Nights | Check Out | Nationality */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check In</label>
            <input
              type="date"
              value={checkIn}
              min={todayStr}
              onChange={(e) => handleCheckInChange(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nights</label>
            <input
              type="number"
              value={nights}
              min={1}
              onChange={(e) => handleNightsChange(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check Out</label>
            <input
              type="date"
              value={checkOut}
              min={addDays(checkIn, 1)}
              onChange={(e) => handleCheckOutChange(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nationality</label>
            <select
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {NATIONALITY_OPTIONS.map((n) => (
                <option key={n.code} value={n.code}>
                  {n.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Rooms | Adults | Children */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rooms</label>
            <select
              value={rooms}
              onChange={(e) => {
                const nextRooms = Math.max(1, Math.min(9, Number(e.target.value) || 1));
                setRooms(nextRooms);
                setRoomGuests((prev) => {
                  const base = Array.isArray(prev) && prev.length ? [...prev] : [{ adults: 1, children: 0, childrenAges: [] }];
                  const next = Array.from({ length: nextRooms }, (_, idx) => base[idx] || { adults: 1, children: 0, childrenAges: [] });
                  return next;
                });
              }}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Adults</label>
            <div className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-700">
              {totals.adults}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Total Children</label>
            <div className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-700">
              {totals.children}
            </div>
          </div>
        </div>

        <div className="mt-1">
          <label className="block text-xs font-semibold text-gray-600 mb-2">Guests per room</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roomGuests.slice(0, Math.max(1, rooms)).map((r, roomIdx) => (
              <div key={roomIdx} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="text-sm font-semibold text-gray-800">Room {roomIdx + 1}</div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Adults</label>
                    <select
                      value={Math.max(1, Number(r?.adults || 1))}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(HOTEL_MAX_ADULTS_PER_ROOM, Number(e.target.value) || 1));
                        setRoomGuests((prev) => {
                          const next = [...prev];
                          const cur = next[roomIdx] || { adults: 1, children: 0, childrenAges: [] };
                          next[roomIdx] = { ...cur, adults: v };
                          return next;
                        });
                      }}
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {Array.from({ length: HOTEL_MAX_ADULTS_PER_ROOM }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Children</label>
                    <select
                      value={Math.max(0, Number(r?.children || 0))}
                      onChange={(e) => {
                        const count = Math.max(0, Math.min(HOTEL_MAX_CHILDREN_PER_ROOM, Number(e.target.value) || 0));
                        setRoomGuests((prev) => {
                          const next = [...prev];
                          const cur = next[roomIdx] || { adults: 1, children: 0, childrenAges: [] };
                          const prevAges = Array.isArray(cur.childrenAges) ? cur.childrenAges : [];
                          const nextAges = prevAges.slice(0, count);
                          while (nextAges.length < count) nextAges.push(8);
                          next[roomIdx] = { ...cur, children: count, childrenAges: nextAges };
                          return next;
                        });
                      }}
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      {Array.from({ length: HOTEL_MAX_CHILDREN_PER_ROOM + 1 }, (_, n) => n).map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {Number(r?.children || 0) > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] font-semibold text-gray-600 mb-1">Children ages</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: Math.max(0, Number(r?.children || 0)) }).map((_, idx) => (
                        <input
                          key={idx}
                          type="number"
                          min={0}
                          max={17}
                          placeholder="Age"
                          value={Array.isArray(r?.childrenAges) ? (r.childrenAges[idx] ?? "") : ""}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setRoomGuests((prev) => {
                              const next = [...prev];
                              const cur = next[roomIdx] || { adults: 1, children: 0, childrenAges: [] };
                              const ages = Array.isArray(cur.childrenAges) ? [...cur.childrenAges] : [];
                              ages[idx] = Number.isFinite(v) ? Math.max(0, Math.min(17, v)) : 8;
                              next[roomIdx] = { ...cur, childrenAges: ages };
                              return next;
                            });
                          }}
                          className="w-20 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-gray-400">Enter each child’s age (0–17)</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Star Rating + Search Button */}
        <div className="flex items-end gap-4">
          <div className="w-full md:w-64">
            <label className="block text-sm font-medium text-gray-700 mb-1">Star Rating</label>
            <select
              value={starRating}
              onChange={(e) => setStarRating(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {STAR_RATINGS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 flex justify-end">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-8 py-2.5 text-white text-sm font-semibold rounded hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ backgroundColor: "#1e3a5f" }}
            >
              {loading && (
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              {loading ? "Searching..." : "Hotel Search"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
