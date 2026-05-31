"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { flightAPI, CalendarFareRequest, FlightSearchRequest, Airport } from "@/lib/api";
import { formatUserDate } from "@/lib/dateLocale";

interface CalendarFareResultsProps {
  results: any; // wrapped: { _calendarMeta, _data }
  passengers: { adults: number; children: number; infants: number };
  domainToken: string;
  onBack: () => void;
  onFlightSearch: (results: any, passengers: any, token: string, tripType: string) => void;
}

interface FareDay {
  fare: number;
  airlineName: string;
  isLowest: boolean;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const fmt = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// month = "YYYY-MM", results are positional (index 0 = day 1)
function parseFareMap(data: any, month: string): Map<string, FareDay> {
  const map = new Map<string, FareDay>();
  const response = data?.Response || data?.response || data;
  const results: any[] = response?.SearchResults || response?.Results || [];
  console.log("[CalendarFare] Parsing results count:", results.length);

  results.forEach((item: any) => {
    const rawDate: string = item?.DepartureDate || item?.DepartureTime || item?.Date || item?.date || "";
    if (!rawDate) return;

    const dateKey = rawDate.split("T")[0];

    const fare: number = item?.Fare ?? (item?.BaseFare ?? 0) + (item?.Tax ?? 0);

    const rawName: string = item?.AirlineName || item?.Airline?.AirlineName || "";
    const airlineName =
      rawName && rawName.toLowerCase() !== "default"
        ? rawName
        : item?.AirlineCode || item?.Airline?.AirlineCode || rawName;

    const isLowest: boolean = item?.IsLowestFareOfMonth === true;

    if (fare > 0) map.set(dateKey, { fare, airlineName, isLowest });
  });
  return map;
}

export default function CalendarFareResults({
  results,
  passengers,
  domainToken,
  onBack,
  onFlightSearch,
}: CalendarFareResultsProps) {
  const meta = results?._calendarMeta || {};
  const origin = meta.origin || {};
  const destination = meta.destination || {};

  const [currentMonth, setCurrentMonth] = useState<string>(meta.month || "");
  const [fareMap, setFareMap] = useState<Map<string, FareDay>>(() =>
    parseFareMap(results?._data, meta.month || "")
  );
  const [monthLoading, setMonthLoading] = useState(false);

  // ── Inline search form state ──
  const [fromOptions, setFromOptions] = useState<Airport[]>([]);
  const [toOptions, setToOptions] = useState<Airport[]>([]);
  const [fromLoading, setFromLoading] = useState(false);
  const [toLoading, setToLoading] = useState(false);
  const [fromQuery, setFromQuery] = useState(
    meta.origin ? `${meta.origin.cityName || meta.origin.airportName} (${meta.origin.airportCode})` : ""
  );
  const [toQuery, setToQuery] = useState(
    meta.destination ? `${meta.destination.cityName || meta.destination.airportName} (${meta.destination.airportCode})` : ""
  );
  const [selectedFrom, setSelectedFrom] = useState<Airport | null>(meta.origin || null);
  const [selectedTo, setSelectedTo]     = useState<Airport | null>(meta.destination || null);
  const [searchMonth, setSearchMonth]   = useState<string>(meta.month || "");
  const [searchCabin, setSearchCabin]   = useState<string>(meta.cabinClass || "economy");
  const [showFromDd, setShowFromDd]     = useState(false);
  const [showToDd, setShowToDd]         = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef   = useRef<HTMLDivElement>(null);
  const fromDebounceRef = useRef<number | null>(null);
  const toDebounceRef = useRef<number | null>(null);

  const searchFrom = (q: string) => {
    if (fromDebounceRef.current) window.clearTimeout(fromDebounceRef.current);
    const query = q.trim();
    if (query.length < 2) {
      setFromOptions([]);
      setFromLoading(false);
      return;
    }
    fromDebounceRef.current = window.setTimeout(async () => {
      try {
        setFromLoading(true);
        const data = await flightAPI.searchAirports(query, 10);
        setFromOptions(Array.isArray(data) ? data : []);
      } finally {
        setFromLoading(false);
      }
    }, 250);
  };

  const searchTo = (q: string) => {
    if (toDebounceRef.current) window.clearTimeout(toDebounceRef.current);
    const query = q.trim();
    if (query.length < 2) {
      setToOptions([]);
      setToLoading(false);
      return;
    }
    toDebounceRef.current = window.setTimeout(async () => {
      try {
        setToLoading(true);
        const data = await flightAPI.searchAirports(query, 10);
        setToOptions(Array.isArray(data) ? data : []);
      } finally {
        setToLoading(false);
      }
    }, 250);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fromRef.current && !fromRef.current.contains(e.target as Node)) setShowFromDd(false);
      if (toRef.current   && !toRef.current.contains(e.target as Node))   setShowToDd(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filterAirports = (_q: string) => [];

  const cabinClassMap: Record<string, number> = { economy: 2, premiumeconomy: 3, "premium economy": 3, business: 4, first: 6 };

  const handleInlineSearch = async () => {
    if (!selectedFrom || !selectedTo || !searchMonth) {
      alert("Please fill all fields"); return;
    }
    setSearchLoading(true);
    try {
      const token = await flightAPI.getDomainToken();
      const flightCabinClass = cabinClassMap[searchCabin.toLowerCase()] ?? 2;
      const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
      const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      const day = searchMonth === currentMonthStr ? String(today.getDate()).padStart(2, "0") : "01";
      const req: CalendarFareRequest = {
        JourneyType: 1,
        PreferredAirlines: null,
        Sources: null,
        Segments: [{ Origin: selectedFrom.airportCode, Destination: selectedTo.airportCode, FlightCabinClass: flightCabinClass, PreferredDepartureTime: `${searchMonth}-${day}T00:00:00` }],
      };
      const data = await flightAPI.getCalendarFare(req, domainToken || token);
      // Update calendar in-place without navigating away
      setFareMap(parseFareMap(data, searchMonth));
      setCurrentMonth(searchMonth);
    } catch (e) {
      console.error("Inline calendar search error:", e);
      alert("Search failed. Please try again.");
    }
    setSearchLoading(false);
  };

  // Passenger modal state
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalPax, setModalPax] = useState({ adults: passengers.adults, children: passengers.children, infants: passengers.infants });
  const [searching, setSearching] = useState(false);
  const [updatingDate, setUpdatingDate] = useState<string | null>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleUpdateDate = async (dateStr: string) => {
    if (!selectedFrom || !selectedTo) return;
    setUpdatingDate(dateStr);
    try {
      const token = await flightAPI.getDomainToken();
      const flightCabinClass = cabinClassMap[searchCabin.toLowerCase()] ?? 2;
      const req: CalendarFareRequest = {
        JourneyType: 1,
        PreferredAirlines: null,
        Sources: null,
        Segments: [{
          Origin: selectedFrom.airportCode,
          Destination: selectedTo.airportCode,
          FlightCabinClass: flightCabinClass,
          PreferredDepartureTime: `${dateStr}T00:00:00`,
        }],
      };
      const data = await flightAPI.getCalendarFareOfDay(req, domainToken || token);
      // Merge new fares into existing map
      const newMap = new Map(fareMap);
      parseFareMap(data, currentMonth).forEach((v, k) => newMap.set(k, v));
      setFareMap(newMap);
    } catch (e) {
      console.error("Update date fare error:", e);
    }
    setUpdatingDate(null);
  };

  // Year and month numbers
  const [year, monthIdx] = currentMonth
    ? [parseInt(currentMonth.split("-")[0]), parseInt(currentMonth.split("-")[1]) - 1]
    : [new Date().getFullYear(), new Date().getMonth()];

  const monthLabel = `${MONTHS[monthIdx]} ${year}`;
  const firstDayOfWeek = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  // Re-parse whenever results prop changes
  useEffect(() => {
    const m = meta.month || "";
    setFareMap(parseFareMap(results?._data, m));
    setCurrentMonth(m);
  }, [results]);

  const fetchMonthFares = useCallback(
    async (month: string) => {
      setMonthLoading(true);
      try {
        const req: CalendarFareRequest = {
          JourneyType: 1,
          PreferredAirlines: null,
          Sources: null,
          Segments: [
            {
              Origin: selectedFrom?.airportCode || origin.airportCode,
              Destination: selectedTo?.airportCode || destination.airportCode,
              FlightCabinClass: cabinClassMap[searchCabin.toLowerCase()] ?? meta.flightCabinClass ?? 2,
              PreferredDepartureTime: (() => {
                const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
                const day = month === currentMonth
                  ? String(today.getDate()).padStart(2, "0")
                  : "01";
                return `${month}-${day}T00:00:00`;
              })(),
            },
          ],
        };
        const data = await flightAPI.getCalendarFare(req, domainToken);
        setFareMap(parseFareMap(data, month));
      } catch (e) {
        console.error("Calendar fare fetch error:", e);
      } finally {
        setMonthLoading(false);
      }
    },
    [origin.airportCode, destination.airportCode, meta.flightCabinClass, domainToken]
  );

  const navigateMonth = (delta: number) => {
    const d = new Date(year, monthIdx + delta, 1);
    const newMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setCurrentMonth(newMonth);
    fetchMonthFares(newMonth);
  };

  const openModal = (dateStr: string) => {
    setModalPax({ adults: passengers.adults, children: passengers.children, infants: passengers.infants });
    setModalDate(dateStr);
  };

  const updatePax = (type: "adults" | "children" | "infants", delta: number) => {
    setModalPax((prev) => {
      const next = { ...prev, [type]: Math.max(type === "adults" ? 1 : 0, prev[type] + delta) };
      const total = next.adults + next.children + next.infants;
      if (total > 9) return prev;
      return next;
    });
  };

  const handleDaySearch = async () => {
    if (!modalDate) return;
    setSearching(true);
    try {
      const searchReq: FlightSearchRequest = {
        AdultCount: modalPax.adults.toString(),
        ChildCount: modalPax.children.toString(),
        InfantCount: modalPax.infants.toString(),
        JourneyType: "1",
        PreferredAirlines: [""],
        CabinClass: searchCabin
          ? searchCabin.charAt(0).toUpperCase() + searchCabin.slice(1)
          : "Economy",
        ResultFareType: "2",
        Segments: [
          {
            Origin: selectedFrom?.airportCode || origin.airportCode,
            Destination: selectedTo?.airportCode || destination.airportCode,
            DepartureDate: new Date(modalDate).toISOString(),
          },
        ],
      };
      const flightResults = await flightAPI.searchFlights(searchReq, domainToken);
      onFlightSearch(flightResults, modalPax, domainToken, "oneway");
    } catch (e) {
      console.error("Day search error:", e);
    } finally {
      setSearching(false);
      setModalDate(null);
    }
  };

  // Build calendar grid
  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);
  while (grid.length % 7 !== 0) grid.push(null);

  const NAVY = "#1e3a5f";

const CALENDAR_FARE_DISCLAIMER =
  "Fare shown in the calendar is suggestive pricing for informational purpose only and is for a single adult. The information shown is based on the bookings done by the customers in the past. Due to rapidly changing airline prices & seat availability, these fares are not guaranteed.";

  const modalDateLabel = modalDate
    ? formatUserDate(modalDate + "T00:00:00", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
      })
    : "";

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Inline Search Bar */}
      <div className="border-b bg-orange-50 px-4 py-4">
        <div className="mb-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 hover:underline"
          >
            <span aria-hidden="true">←</span>
            Back to Search
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* From */}
          <div className="relative flex-1 min-w-[140px]" ref={fromRef}>
            <label className="block text-xs font-semibold text-gray-600 mb-1">From</label>
            <input
              type="text" value={fromQuery}
              onChange={e => { const v = e.target.value; setFromQuery(v); setShowFromDd(true); setSelectedFrom(null); searchFrom(v); }}
              onFocus={() => setShowFromDd(true)}
              placeholder="Departure city"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {showFromDd && (
              <div className="absolute z-20 w-full bg-white border rounded-lg mt-1 max-h-56 overflow-y-auto shadow-lg">
                {fromQuery.trim().length < 2 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Type at least 2 characters</div>
                ) : fromLoading ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
                ) : fromOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No airports found</div>
                ) : (
                  fromOptions.map(a => (
                    <div key={a.airportCode} onClick={() => { setSelectedFrom(a); setFromQuery(`${a.cityName || a.airportName} (${a.airportCode})`); setShowFromDd(false); }}
                      className="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm">
                      <div className="font-medium">{a.cityName || a.airportName} ({a.airportCode})</div>
                      <div className="text-xs text-gray-400">{a.airportName}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* To */}
          <div className="relative flex-1 min-w-[140px]" ref={toRef}>
            <label className="block text-xs font-semibold text-gray-600 mb-1">To</label>
            <input
              type="text" value={toQuery}
              onChange={e => { const v = e.target.value; setToQuery(v); setShowToDd(true); setSelectedTo(null); searchTo(v); }}
              onFocus={() => setShowToDd(true)}
              placeholder="Destination city"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {showToDd && (
              <div className="absolute z-20 w-full bg-white border rounded-lg mt-1 max-h-56 overflow-y-auto shadow-lg">
                {toQuery.trim().length < 2 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Type at least 2 characters</div>
                ) : toLoading ? (
                  <div className="px-3 py-2 text-sm text-gray-500">Searching…</div>
                ) : toOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500">No airports found</div>
                ) : (
                  toOptions.map(a => (
                    <div key={a.airportCode} onClick={() => { setSelectedTo(a); setToQuery(`${a.cityName || a.airportName} (${a.airportCode})`); setShowToDd(false); }}
                      className="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm">
                      <div className="font-medium">{a.cityName || a.airportName} ({a.airportCode})</div>
                      <div className="text-xs text-gray-400">{a.airportName}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Month */}
          <div className="min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Month & Year</label>
            <input type="month" value={searchMonth}
              onChange={e => setSearchMonth(e.target.value)}
              min={new Date().toISOString().slice(0, 7)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Cabin Class */}
          <div className="min-w-[130px]">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Cabin Class</label>
            <select value={searchCabin} onChange={e => setSearchCabin(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="economy">Economy</option>
              <option value="premium economy">Premium Economy</option>
              <option value="business">Business</option>
              <option value="first">First Class</option>
            </select>
          </div>

          {/* Search Button */}
          <button onClick={handleInlineSearch} disabled={searchLoading}
            className="px-5 py-2 rounded-lg text-white text-sm font-bold disabled:opacity-50 whitespace-nowrap"
            style={{ background: `linear-gradient(90deg, #FC6603, #ff8c38)` }}>
            {searchLoading ? "Searching…" : "🔍 Search"}
          </button>
        </div>
      </div>

      {/* Calendar header */}
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ backgroundColor: "#e8eef6" }}
      >
        <span className="font-semibold text-blue-800 text-base">
          {selectedFrom?.cityName || selectedFrom?.airportCode}({selectedFrom?.airportCode}) -{" "}
          {selectedTo?.cityName || selectedTo?.airportCode}({selectedTo?.airportCode}) {monthLabel}
        </span>
        <button
          onClick={() => navigateMonth(1)}
          className="text-blue-700 font-semibold hover:underline text-sm"
        >
          {MONTHS[(monthIdx + 1) % 12]} →
        </button>
      </div>

      {monthLoading && (
        <div className="text-center py-8 text-blue-700 font-medium">
          Loading fares for {monthLabel}...
        </div>
      )}

      {!monthLoading && (
        <div className="overflow-x-auto">
          {/* Day-of-week header */}
          <div className="grid grid-cols-7">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-white text-sm font-semibold py-2"
                style={{ backgroundColor: NAVY }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {Array.from({ length: grid.length / 7 }, (_, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
              {grid.slice(wi * 7, wi * 7 + 7).map((day, ci) => {
                if (!day) {
                  return <div key={ci} className="border-r last:border-r-0 h-20" />;
                }
                const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const fareDay = fareMap.get(dateStr);
                const cellDate = new Date(year, monthIdx, day);
                const isFuture = cellDate >= today;
                const isUpdating = updatingDate === dateStr;
                const label = formatUserDate(cellDate, {
                  month: "short",
                  day: "numeric",
                });

                const cellBg = fareDay?.isLowest
                  ? "#dcfce7"
                  : fareDay
                  ? "#fffbeb"
                  : undefined;

                return (
                  <div
                    key={ci}
                    className="relative group border-r last:border-r-0 h-20 flex flex-col items-start justify-start pt-1 px-1 cursor-pointer"
                    style={{ backgroundColor: cellBg }}
                  >
                    <span className="text-xs text-gray-500 pl-1">{label}</span>
                    {fareDay ? (
                      <div className="flex flex-col items-center w-full mt-1 gap-0.5">
                        {fareDay.isLowest && (
                          <span className="text-[9px] font-bold text-green-700 uppercase tracking-wide">
                            Lowest
                          </span>
                        )}
                        <span
                          className="text-sm font-bold"
                          style={{ color: fareDay.isLowest ? "#15803d" : NAVY }}
                        >
                          ₹{fmt.format(fareDay.fare)}
                        </span>
                        {fareDay.airlineName && (
                          <span className="text-[10px] text-gray-500 text-center leading-tight">
                            {fareDay.airlineName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center w-full mt-1">
                        {isFuture ? (
                          <button
                            onClick={e => { e.stopPropagation(); handleUpdateDate(dateStr); }}
                            disabled={isUpdating}
                            className="mt-1 px-2 py-0.5 text-[10px] font-semibold rounded border disabled:opacity-50"
                            style={{ borderColor: NAVY, color: isUpdating ? "#9ca3af" : NAVY, background: "white" }}
                          >
                            {isUpdating ? "…" : "Update"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400">—</span>
                        )}
                      </div>
                    )}

                    {/* Hover overlay: Search button — only when fare is available */}
                    {fareDay && (
                    <div className="absolute inset-0 flex items-end justify-center pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => openModal(dateStr)}
                        className="px-2 py-1 text-white text-[10px] font-semibold rounded shadow"
                        style={{ backgroundColor: NAVY }}
                      >
                        Search
                      </button>
                    </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <p
        className="px-4 sm:px-6 py-4 text-xs sm:text-sm text-gray-600 leading-relaxed border-t border-gray-100 bg-gray-50"
        role="note"
      >
        {CALENDAR_FARE_DISCLAIMER}
      </p>

      {/* Passenger Modal */}
      {modalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-1">Enter Number of Passengers</h2>
            <p className="text-sm text-gray-500 mb-5">{modalDateLabel}</p>

            {/* Passenger counters */}
            <div className="space-y-4 mb-6">
              {(
                [
                  { key: "adults", label: "Adults", sub: "12+ years" },
                  { key: "children", label: "Children", sub: "2–11 years" },
                  { key: "infants", label: "Infants", sub: "Under 2 years" },
                ] as const
              ).map(({ key, label, sub }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-800 text-sm">{label}</div>
                    <div className="text-xs text-gray-400">{sub}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => updatePax(key, -1)}
                      className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 text-lg font-bold flex items-center justify-center hover:bg-gray-100 disabled:opacity-40"
                      disabled={key === "adults" ? modalPax[key] <= 1 : modalPax[key] <= 0}
                    >
                      −
                    </button>
                    <span className="w-5 text-center font-semibold text-gray-800">{modalPax[key]}</span>
                    <button
                      onClick={() => updatePax(key, 1)}
                      className="w-8 h-8 rounded-full border border-gray-300 text-gray-600 text-lg font-bold flex items-center justify-center hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setModalDate(null)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-50"
              >
                Choose Another Day
              </button>
              <button
                onClick={handleDaySearch}
                disabled={searching}
                className="flex-1 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-60"
                style={{ backgroundColor: NAVY }}
              >
                {searching ? "Searching..." : "Search"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
