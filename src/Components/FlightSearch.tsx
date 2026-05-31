"use client";
import { useState, useEffect, useRef } from "react";
import { flightAPI, Airport, FlightSearchRequest, CalendarFareRequest } from "@/lib/api";
import FlightSearchLoading from "@/Components/FlightSearchLoading";
import { useDateLocale } from "@/Components/DateLocaleProvider";

const OG = "#FC6603";

interface FlightSearchProps {
  onSearchComplete: (
    results: any,
    passengers: any,
    token: string,
    tripType: string,
    searchMeta?: { request: FlightSearchRequest; searchApi: "search" | "advance" },
  ) => void;
  initialTripType?: string;
}

const SPECIAL_FARES = [
  { id: "regular", label: "Regular", sub: "Regular fares", discount: "", icon: "🎫" },
  { id: "student", label: "Student", sub: "Extra discounts/baggage", discount: "", icon: "🎓" },
  { id: "armed", label: "Armed Forces", sub: "Up to ₹600 off", discount: "₹600", icon: "🎖️" },
  { id: "senior", label: "Senior Citizen", sub: "Up to ₹600 off", discount: "₹600", icon: "👴" },
  { id: "doctor", label: "Doctor & Nurses", sub: "Up to ₹600 off", discount: "₹600", icon: "🩺" },
];

/** Display names for restrict-panel airline source codes (matches checkbox labels in the form). */
const FLIGHT_SOURCE_LABELS: Record<string, string> = {
  GDS: "GDS",
  G9: "Air Arabia",
  AK: "AirAsia",
  "6E": "IndiGo",
  IX: "Air India Express",
  SG: "SpiceJet",
  FZ: "FlyDubai",
  QP: "Akasa Air",
  J9: "Jazeera",
  EK: "Emirates",
  LH: "Lufthansa",
  WY: "Oman Air",
  EY: "Etihad Airways",
  GF: "Gulf Air",
  AI: "Air India",
};

const ALL_FLIGHT_SOURCE_CODES = [
  "GDS",
  "SG",
  "6E",
  "G9",
  "FZ",
  "IX",
  "AK",
  "QP",
  "J9",
  "EK",
  "LH",
  "WY",
  "EY",
  "GF",
  "AI",
];
const UNSUPPORTED_FLIGHT_SOURCE_CODES = new Set(["G8"]);

function sanitizeFlightSources(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [];
  return sources.filter(
    (code): code is string =>
      typeof code === "string" && !UNSUPPORTED_FLIGHT_SOURCE_CODES.has(code),
  );
}

function formatSourcesListForSummary(sources: string[]): string {
  return [...sources]
    .sort()
    .map((code) => FLIGHT_SOURCE_LABELS[code] || code)
    .join(", ");
}

/** Shown next to "Restrict my search to" when the panel is collapsed so users see active filters. */
function getRestrictSearchSummary(selectedFare: string, sources: string[]): string | null {
  const parts: string[] = [];
  if (selectedFare && selectedFare !== "regular") {
    const f = SPECIAL_FARES.find((x) => x.id === selectedFare);
    if (f) parts.push(`${f.label} fare`);
  }
  if (sources.length > 0) {
    parts.push(
      `${sources.length} airline source${sources.length === 1 ? "" : "s"} (${formatSourcesListForSummary(sources)})`,
    );
  }
  return parts.length ? parts.join(" · ") : null;
}

const SEARCH_KEY = "vivance_flight_search";

function todayIsoLocal(): string {
  return new Date().toISOString().split("T")[0];
}

function isValidEnabledDate(value: string): boolean {
  const s = String(value || "").trim();
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !isNaN(d.getTime());
}

/** Maps UI trip type to search journey shape (oneway vs roundtrip). */
function getEffectiveTripType(
  tripType: string,
  advanceSubType: "advanceOneway" | "advanceReturn",
): string {
  if (tripType === "advance") {
    return advanceSubType === "advanceReturn" ? "roundtrip" : "oneway";
  }
  if (tripType === "specialreturn") return "roundtrip";
  return tripType;
}

function isReturnDateRequired(
  tripType: string,
  advanceSubType: "advanceOneway" | "advanceReturn",
): boolean {
  return getEffectiveTripType(tripType, advanceSubType) === "roundtrip";
}

export default function FlightSearch({ onSearchComplete, initialTripType }: FlightSearchProps) {
  const { inputLang } = useDateLocale();
  // All states initialise with defaults so server-rendered HTML matches the
  // initial client render (prevents hydration mismatch). Persisted values are
  // restored from sessionStorage in a useEffect after hydration.
  const [selectedFare, setSelectedFare] = useState("regular");
  const [tripType, setTripType] = useState(initialTripType || "oneway");
  const [advanceSubType, setAdvanceSubType] = useState<"advanceOneway" | "advanceReturn">("advanceOneway");
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const [fromOptions, setFromOptions] = useState<Airport[]>([]);
  const [toOptions, setToOptions] = useState<Airport[]>([]);
  const [fromLoading, setFromLoading] = useState(false);
  const [toLoading, setToLoading] = useState(false);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [selectedFrom, setSelectedFrom] = useState<Airport | null>(null);
  const [selectedTo, setSelectedTo] = useState<Airport | null>(null);
  const [passengers, setPassengers] = useState({ adults: 1, children: 0, infants: 0 });
  const [cabinClass, setCabinClass] = useState("economy");
  const [sources, setSources] = useState<string[]>([]);
  const [showSources, setShowSources] = useState(false);
  const [departureDate, setDepartureDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [preferredAirline, setPreferredAirline] = useState("");
  const [restored, setRestored] = useState(false);
  const [multiCityLegs, setMultiCityLegs] = useState<Array<{
    fromQuery: string; toQuery: string;
    selectedFrom: Airport | null; selectedTo: Airport | null; date: string;
  }>>([
    { fromQuery: "", toQuery: "", selectedFrom: null, selectedTo: null, date: "" },
    { fromQuery: "", toQuery: "", selectedFrom: null, selectedTo: null, date: "" },
  ]);
  const [mcDropdown, setMcDropdown] = useState<{ legIdx: number; field: "from" | "to" } | null>(null);
  const [mcOptions, setMcOptions] = useState<Array<{ from: Airport[]; to: Airport[] }>>([
    { from: [], to: [] },
    { from: [], to: [] },
  ]);
  const [mcLoading, setMcLoading] = useState<Array<{ from: boolean; to: boolean }>>([
    { from: false, to: false },
    { from: false, to: false },
  ]);
  const mcDebounceRef = useRef<Record<string, number>>({});
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
  const mcFormRef = useRef<HTMLDivElement>(null);
  const fromAbortRef = useRef<AbortController | null>(null);
  const toAbortRef = useRef<AbortController | null>(null);
  const fromDebounceRef = useRef<number | null>(null);
  const toDebounceRef = useRef<number | null>(null);

  // Restore persisted search criteria after hydration (client-only)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SEARCH_KEY) || "{}");
      if (!saved || !Object.keys(saved).length) return;
      if (saved.selectedFare)   setSelectedFare(saved.selectedFare);
      if (saved.tripType)       setTripType(saved.tripType);
      if (saved.advanceSubType) setAdvanceSubType(saved.advanceSubType);
      if (saved.calendarMonth)  setCalendarMonth(saved.calendarMonth);
      if (saved.fromQuery)      setFromQuery(saved.fromQuery);
      if (saved.toQuery)        setToQuery(saved.toQuery);
      if (saved.selectedFrom)   setSelectedFrom(saved.selectedFrom);
      if (saved.selectedTo)     setSelectedTo(saved.selectedTo);
      if (saved.passengers)     setPassengers(saved.passengers);
      if (saved.cabinClass)     setCabinClass(saved.cabinClass);
      if (saved.sources)        setSources(sanitizeFlightSources(saved.sources));
      if (saved.departureDate)  setDepartureDate(saved.departureDate);
      if (saved.returnDate)     setReturnDate(saved.returnDate);
      if (Array.isArray(saved.multiCityLegs) && saved.multiCityLegs.length > 0) {
        setMultiCityLegs(saved.multiCityLegs);
      }
    } catch {}
    finally {
      // Ensure we don't overwrite restored values with defaults.
      setRestored(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If user updates departure date later than return date, clear return date
  // so they must select a valid return date again (applies to all search modes).
  useEffect(() => {
    if (!departureDate || !returnDate) return;
    if (departureDate > returnDate) setReturnDate("");
  }, [departureDate, returnDate]);


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
    const handleClickOutside = (event: MouseEvent) => {
      if (fromRef.current && !fromRef.current.contains(event.target as Node))
        setShowFromDropdown(false);
      if (toRef.current && !toRef.current.contains(event.target as Node))
        setShowToDropdown(false);
      if (mcFormRef.current && !mcFormRef.current.contains(event.target as Node))
        setMcDropdown(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Keep multi-city options/loading aligned with legs length
    setMcOptions((prev) => {
      const next = [...prev];
      while (next.length < multiCityLegs.length) next.push({ from: [], to: [] });
      return next.slice(0, multiCityLegs.length);
    });
    setMcLoading((prev) => {
      const next = [...prev];
      while (next.length < multiCityLegs.length) next.push({ from: false, to: false });
      return next.slice(0, multiCityLegs.length);
    });
  }, [multiCityLegs.length]);

  const filterAirports = (_query: string) => {
    // kept for minimal change surface; dropdown now uses server-backed options
    return [];
  };

  const RECENT_KEY = "vivance_recent_airports";
  const MAX_RECENT = 5;

  const getRecentAirports = (): Airport[] => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const saveRecentAirport = (airport: Airport) => {
    const recent = getRecentAirports().filter(a => a.airportCode !== airport.airportCode);
    recent.unshift(airport);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  };

  const handleFromSelect = (airport: Airport) => {
    if (selectedTo && airport.airportCode === selectedTo.airportCode) {
      alert("Departure and arrival airports cannot be the same.");
      return;
    }
    setSelectedFrom(airport);
    setFromQuery(`${airport.cityName || airport.airportName} (${airport.airportCode})`);
    setShowFromDropdown(false);
    saveRecentAirport(airport);
  };

  const handleToSelect = (airport: Airport) => {
    if (selectedFrom && airport.airportCode === selectedFrom.airportCode) {
      alert("Departure and arrival airports cannot be the same.");
      return;
    }
    setSelectedTo(airport);
    setToQuery(`${airport.cityName || airport.airportName} (${airport.airportCode})`);
    setShowToDropdown(false);
    saveRecentAirport(airport);
  };

  const handleSwap = () => {
    const tmpAirport = selectedFrom;
    const tmpQuery = fromQuery;
    setSelectedFrom(selectedTo);
    setFromQuery(toQuery);
    setSelectedTo(tmpAirport);
    setToQuery(tmpQuery);
  };

  const updatePassengers = (type: string, value: number) => {
    const newPassengers = { ...passengers, [type]: Math.max(0, value) };
    const total = newPassengers.adults + newPassengers.children + newPassengers.infants;
    if (total > 9) {
      alert("Total passengers cannot exceed 9");
      return;
    }
    setPassengers(newPassengers);
  };

  const toggleSource = (source: string) => {
    setSources((prev) => {
      if (prev.includes(source)) return prev.filter((s) => s !== source);
      return [...prev, source];
    });
  };

  // Persist search criteria to sessionStorage so it survives back-navigation
  useEffect(() => {
    if (!restored) return;
    try {
      sessionStorage.setItem(SEARCH_KEY, JSON.stringify({
        selectedFare, tripType, advanceSubType, calendarMonth,
        fromQuery, toQuery, selectedFrom, selectedTo,
        passengers, cabinClass, sources, departureDate, returnDate,
        multiCityLegs,
      }));
    } catch {}
  }, [selectedFare, tripType, advanceSubType, calendarMonth,
      fromQuery, toQuery, selectedFrom, selectedTo,
      passengers, cabinClass, sources, departureDate, returnDate, multiCityLegs, restored]);

  // Clear invalid sources when a fare type restricts supported airline sources.
  useEffect(() => {
    if (selectedFare === "student") {
      const allowedForStudent = ["6E", "SG", "GDS"];
      setSources((prev) => prev.filter((s) => allowedForStudent.includes(s)));
    } else if (selectedFare === "senior") {
      const allowedForSenior = ["6E", "SG"];
      setSources((prev) => prev.filter((s) => allowedForSenior.includes(s)));
    }
  }, [selectedFare, sources]);

  const updateMcLeg = (idx: number, updates: Partial<typeof multiCityLegs[0]>) => {
    setMultiCityLegs(prev => prev.map((leg, i) => i === idx ? { ...leg, ...updates } : leg));
  };

  const swapMcLeg = (idx: number) => {
    setMultiCityLegs(prev => prev.map((leg, i) =>
      i === idx
        ? { ...leg, fromQuery: leg.toQuery, toQuery: leg.fromQuery, selectedFrom: leg.selectedTo, selectedTo: leg.selectedFrom }
        : leg
    ));
  };

  const addMcCity = () => {
    if (multiCityLegs.length >= 5) return;
    setMultiCityLegs(prev => {
      const lastLeg = prev[prev.length - 1];
      return [...prev, {
        fromQuery: lastLeg?.toQuery || "",
        toQuery: "",
        selectedFrom: lastLeg?.selectedTo || null,
        selectedTo: null,
        date: "",
      }];
    });
  };

  const removeMcLeg = (idx: number) => {
    setMultiCityLegs(prev => prev.filter((_, i) => i !== idx));
  };

  const searchMcAirport = (legIdx: number, field: "from" | "to", q: string) => {
    const query = (q || "").trim();
    const key = `${legIdx}-${field}`;
    const existing = mcDebounceRef.current[key];
    if (existing) window.clearTimeout(existing);

    if (query.length < 2) {
      setMcOptions((prev) => prev.map((o, i) => (i === legIdx ? { ...o, [field]: [] } : o)));
      setMcLoading((prev) => prev.map((o, i) => (i === legIdx ? { ...o, [field]: false } : o)));
      return;
    }

    mcDebounceRef.current[key] = window.setTimeout(async () => {
      try {
        setMcLoading((prev) => prev.map((o, i) => (i === legIdx ? { ...o, [field]: true } : o)));
        const data = await flightAPI.searchAirports(query, 10);
        setMcOptions((prev) =>
          prev.map((o, i) => (i === legIdx ? { ...o, [field]: Array.isArray(data) ? data : [] } : o))
        );
      } finally {
        setMcLoading((prev) => prev.map((o, i) => (i === legIdx ? { ...o, [field]: false } : o)));
      }
    }, 250);
  };

  const handleSearch = async () => {
    const today = todayIsoLocal();

    if (tripType === "calendar") {
      if (!selectedFrom || !selectedTo || !calendarMonth) {
        alert("Please fill all required fields");
        return;
      }
      if (!/^\d{4}-\d{2}$/.test(String(calendarMonth).trim())) {
        alert("Please select a valid month.");
        return;
      }
    } else if (tripType === "multicity") {
      for (let i = 0; i < multiCityLegs.length; i++) {
        const leg = multiCityLegs[i];
        const hasAny =
          leg.selectedFrom ||
          leg.selectedTo ||
          leg.date ||
          leg.fromQuery.trim() ||
          leg.toQuery.trim();
        if (!hasAny) continue;
        if (!leg.selectedFrom || !leg.selectedTo || !leg.date) {
          alert(`Please complete origin, destination, and date for city leg ${i + 1}.`);
          return;
        }
        if (!isValidEnabledDate(leg.date)) {
          alert(`Please select a valid date for city leg ${i + 1}.`);
          return;
        }
        if (leg.date < today) {
          alert(`Date for city leg ${i + 1} cannot be in the past.`);
          return;
        }
        const prevDate = multiCityLegs[i - 1]?.date;
        if (i > 0 && prevDate && leg.date < prevDate) {
          alert(`Date for city leg ${i + 1} cannot be before city leg ${i}.`);
          return;
        }
      }
      const validLegs = multiCityLegs.filter((l) => l.selectedFrom && l.selectedTo && l.date);
      if (validLegs.length < 2) {
        alert("Please fill at least 2 city legs with origin, destination and date");
        return;
      }
    } else {
      if (!selectedFrom || !selectedTo) {
        alert("Please fill all required fields");
        return;
      }
      if (!isValidEnabledDate(departureDate)) {
        alert("Please select a departure date.");
        return;
      }
      if (departureDate < today) {
        alert("Departure date cannot be in the past.");
        return;
      }
      if (isReturnDateRequired(tripType, advanceSubType)) {
        if (!isValidEnabledDate(returnDate)) {
          alert("Please select a return date.");
          return;
        }
        if (returnDate < today) {
          alert("Return date cannot be in the past.");
          return;
        }
        if (departureDate > returnDate) {
          alert("Departure date cannot be later than the return date.");
          return;
        }
      }
    }

    setLoading(true);
    try {
      const token = await flightAPI.getDomainToken();

      // --- Calendar Fare: distinct request format ---
      if (tripType === "calendar") {
        const cabinClassMap: Record<string, number> = {
          economy: 2,
          premiumeconomy: 3,
          "premium economy": 3,
          business: 4,
          first: 6,
        };
        const flightCabinClass = cabinClassMap[cabinClass.toLowerCase()] ?? 2;

        const calendarSources = sanitizeFlightSources(sources);
        const calendarRequest: CalendarFareRequest = {
          JourneyType: 1,
          PreferredAirlines: null,
          Sources: calendarSources.length > 0 ? calendarSources : null,
          Segments: [
            {
              Origin: selectedFrom!.airportCode,
              Destination: selectedTo!.airportCode,
              FlightCabinClass: flightCabinClass,
              PreferredDepartureTime: (() => {
                const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
                const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
                const day = calendarMonth === currentMonth
                  ? String(today.getDate()).padStart(2, "0")
                  : "01";
                return `${calendarMonth}-${day}T00:00:00`;
              })(),
            },
          ],
        };

        console.log('[Calendar Fare] Request:', JSON.stringify(calendarRequest, null, 2));
        const results = await flightAPI.getCalendarFare(calendarRequest, token);
        onSearchComplete(
          {
            _calendarMeta: {
              origin: selectedFrom,
              destination: selectedTo,
              month: calendarMonth,
              cabinClass,
              flightCabinClass,
            },
            _data: results,
          },
          passengers,
          token,
          "calendar"
        );
        setLoading(false);
        return;
      }

      // --- All other trip types ---
      const effectiveTripType = getEffectiveTripType(tripType, advanceSubType);

      const journeyTypeMap: Record<string, string> = {
        oneway: "1",
        roundtrip: "2",
        multicity: "3",
        specialreturn: "5",
      };

      const journeyType =
        tripType === "advance" ? "4"
        : tripType === "specialreturn" ? "5"
        : journeyTypeMap[effectiveTripType] || "1";

      const fareTypeMap: Record<string, string> = {
        regular: "2",
        student: "3",
        armed: "4",
        senior: "5",
        doctor: "2",
      };

      const mcValidLegs = multiCityLegs.filter(l => l.selectedFrom && l.selectedTo && l.date);
      const searchRequest: FlightSearchRequest = {
        AdultCount: passengers.adults.toString(),
        ChildCount: passengers.children.toString(),
        InfantCount: passengers.infants.toString(),
        JourneyType: journeyType,
        PreferredAirlines: effectiveTripType === "multicity" ? [""] : (preferredAirline ? [preferredAirline] : [""]),
        CabinClass: cabinClass.charAt(0).toUpperCase() + cabinClass.slice(1),
        ResultFareType: fareTypeMap[selectedFare],
        Sources: sanitizeFlightSources(sources).length > 0 ? sanitizeFlightSources(sources) : undefined,
        Segments: effectiveTripType === "multicity"
          ? mcValidLegs.map(l => ({
              Origin: l.selectedFrom!.airportCode,
              Destination: l.selectedTo!.airportCode,
              DepartureDate: new Date(l.date).toISOString(),
            }))
          : [
              {
                Origin: selectedFrom!.airportCode,
                Destination: selectedTo!.airportCode,
                DepartureDate: new Date(departureDate).toISOString(),
              },
            ],
      };
      if (effectiveTripType === "roundtrip" && returnDate) {
        searchRequest.Segments.push({
          Origin: selectedTo!.airportCode,
          Destination: selectedFrom!.airportCode,
          DepartureDate: new Date(returnDate).toISOString(),
        });
      }
      const results = tripType === "advance"
        ? await flightAPI.searchAdvancedFlights(searchRequest, token)
        : await flightAPI.searchFlights(searchRequest, token);

      // Preserve Special Return so downstream can apply JourneyType=5 behaviors.
      const tripTypeForResults =
        tripType === "specialreturn"
          ? "specialreturn"
          : tripType === "advance"
            ? "advance"
            : effectiveTripType;

      onSearchComplete(
        results,
        {
          ...passengers,
          cabinClass,
          departureDate,
          returnDate,
          origin: selectedFrom?.airportCode,
          destination: selectedTo?.airportCode,
          ...(effectiveTripType === "multicity" && {
            multiCityLegs: mcValidLegs.map(l => ({
              origin: l.selectedFrom!.airportCode,
              destination: l.selectedTo!.airportCode,
              date: l.date,
            })),
          }),
        },
        token,
        tripTypeForResults,
        { request: searchRequest, searchApi: tripType === "advance" ? "advance" : "search" },
      );
    } catch (error) {
      console.error("Search error:", error);
      alert("Search failed. Please try again.");
    }
    setLoading(false);
  };

  const AirportDropdown = ({
    query,
    loading,
    options,
    onSelect,
  }: {
    query: string;
    loading: boolean;
    options: Airport[];
    onSelect: (a: Airport) => void;
  }) => {
    const recentAirports = getRecentAirports();
    const showRecent = !query && recentAirports.length > 0;
    const list = query ? options : [];
    return (
      <div className="absolute z-10 w-full bg-white border rounded-lg mt-1 max-h-72 overflow-y-auto shadow-lg">
        {showRecent && (
          <>
            <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
              Recent Searches
            </div>
            {recentAirports.map((airport) => (
              <div
                key={`recent-${airport.airportCode}`}
                onClick={() => onSelect(airport)}
                className="px-3 py-2 hover:bg-orange-50 cursor-pointer flex items-center gap-2"
              >
                <span className="text-gray-400 text-sm">🕐</span>
                <div>
                  <div className="font-medium text-sm">
                    {airport.cityName || airport.airportName} ({airport.airportCode})
                  </div>
                  <div className="text-xs text-gray-500">{airport.airportName}</div>
                </div>
              </div>
            ))}
            <div className="border-t mx-3 my-1" />
            <div className="px-3 pt-1 pb-2 text-[11px] text-gray-400">
              Start typing to search airports
            </div>
          </>
        )}
        {query.trim().length < 2 ? (
          <div className="p-3 text-gray-500">Type at least 2 characters</div>
        ) : loading ? (
          <div className="p-3 text-gray-500">Searching…</div>
        ) : list.length === 0 ? (
          <div className="p-3 text-gray-500">No airports found</div>
        ) : (
          list.map((airport) => (
            <div
              key={airport.airportCode}
              onClick={() => onSelect(airport)}
              className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
            >
              <div className="font-medium">
                {airport.cityName || airport.airportName} ({airport.airportCode})
              </div>
              <div className="text-sm text-gray-600">{airport.airportName}</div>
            </div>
          ))
        )}
      </div>
    );
  };

  const renderRestrictSearchSources = (className = "mt-4 mb-2 text-sm") => (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2 gap-y-2">
        <button onClick={() => setShowSources(v => !v)} className="flex items-center gap-1 font-semibold text-orange-600 hover:text-orange-700">
          <span>Restrict my search to</span>
          <span className="text-xs">{showSources ? "▲" : "▼"}</span>
        </button>
        {!showSources &&
          (() => {
            const summary = getRestrictSearchSummary(selectedFare, sources);
            if (!summary) return null;
            return (
              <span
                className="text-xs text-gray-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 max-w-full"
                title="These restrictions apply to your next search. Expand to change."
              >
                <span className="text-gray-500 font-medium">Applied:</span> {summary}
              </span>
            );
          })()}
        {showSources && <>
          <button onClick={() => setSources(ALL_FLIGHT_SOURCE_CODES)} className="text-blue-600 hover:underline text-sm">Select All</button>
          <span className="text-gray-400">/</span>
          <button onClick={() => setSources([])} className="text-blue-600 hover:underline text-sm">Unselect All</button>
        </>}
      </div>

      {showSources && <>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2 mb-3">
          {([["GDS","GDS"],["G9","Air Arabia"],["AK","AirAsia"]] as [string,string][]).map(([code, name]) => {
            const isDisabled = (selectedFare === "student" && !["6E","SG","GDS"].includes(code)) ||
                               (selectedFare === "senior" && !["6E","SG"].includes(code));
            return (
              <label key={code} className={`flex items-center space-x-2 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input type="checkbox" checked={sources.includes(code)} onChange={() => toggleSource(code)} disabled={isDisabled} className="text-primary disabled:cursor-not-allowed" />
                <span className="text-sm">{name}</span>
              </label>
            );
          })}
        </div>

        <div className="mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LCC Airlines</span>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-1">
            {([["6E","IndiGo"],["IX","Air India Express"],["SG","SpiceJet"],["FZ","FlyDubai"],["QP","Akasa Air"],["J9","Jazeera"]] as [string,string][]).map(([code, name]) => {
              const isDisabled = (selectedFare === "student" && !["6E","SG","GDS"].includes(code)) ||
                                 (selectedFare === "senior" && !["6E","SG"].includes(code));
              return (
                <label key={code} className={`flex items-center space-x-2 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={sources.includes(code)} onChange={() => toggleSource(code)} disabled={isDisabled} className="text-primary disabled:cursor-not-allowed" />
                  <span className="text-sm">{name}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NDC Airlines</span>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-1">
            {([["EK","Emirates"],["LH","Lufthansa"],["WY","Oman Air"],["EY","Etihad Airways"],["GF","Gulf Air"],["AI","Air India"]] as [string,string][]).map(([code, name]) => {
              const isDisabled = (selectedFare === "student" && !["6E","SG","GDS"].includes(code)) ||
                                 (selectedFare === "senior" && !["6E","SG"].includes(code));
              return (
                <label key={code} className={`flex items-center space-x-2 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={sources.includes(code)} onChange={() => toggleSource(code)} disabled={isDisabled} className="text-primary disabled:cursor-not-allowed" />
                  <span className="text-sm">{name}</span>
                </label>
              );
            })}
          </div>
        </div>
      </>}
    </div>
  );

  if (loading) {
    const isMc = tripType === "multicity";
    const mcFirst = isMc ? multiCityLegs[0] : null;
    const mcLast = isMc ? multiCityLegs[multiCityLegs.length - 1] : null;

    const loadingFrom = isMc ? mcFirst?.selectedFrom : selectedFrom;
    const loadingTo = isMc ? mcLast?.selectedTo : selectedTo;
    const loadingFromQuery = isMc ? mcFirst?.fromQuery || "" : fromQuery;
    const loadingToQuery = isMc ? mcLast?.toQuery || "" : toQuery;

    const fromLabel = loadingFrom
      ? `${loadingFrom.airportName || ""} (${loadingFrom.airportCode})`
      : loadingFromQuery || "—";
    const fromCity = loadingFrom?.cityName || loadingFrom?.countryName || "";
    const toLabel = loadingTo
      ? `${loadingTo.airportName || ""} (${loadingTo.airportCode})`
      : loadingToQuery || "—";
    const toCity = loadingTo?.cityName || loadingTo?.countryName || "";
    return (
      <FlightSearchLoading
        from={loadingFrom?.airportCode || loadingFromQuery || "—"}
        fromCity={fromLabel}
        to={loadingTo?.airportCode || loadingToQuery || "—"}
        toCity={toLabel}
        departureDate={isMc ? mcFirst?.date || departureDate : departureDate}
        returnDate={returnDate}
        adults={passengers.adults}
        children={passengers.children}
        infants={passengers.infants}
        tripType={tripType}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-stretch">

    {/* ── Search Form ── */}
    <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 flex-1 min-w-0">
      {/* Trip Type */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 mb-4">
        {[
          { id: "oneway", label: "One Way" },
          { id: "roundtrip", label: "Round Trip" },
          { id: "multicity", label: "Multi City" },
          { id: "advance", label: "Advance Search" },
          { id: "specialreturn", label: "Special Return" },
          { id: "calendar", label: "Calendar Fare" },
        ].map((type) => (
          <label key={type.id} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="radio"
              name="tripType"
              value={type.id}
              checked={tripType === type.id}
              onChange={(e) => setTripType(e.target.value)}
              className="text-primary"
            />
            <span>{type.label}</span>
          </label>
        ))}
      </div>

      {/* Advance Search Sub-type */}
      {tripType === "advance" && (
        <div className="flex gap-4 mb-5 pl-1">
          {[
            { id: "advanceOneway", label: "Advance Oneway" },
            { id: "advanceReturn", label: "Advance Return" },
          ].map((sub) => (
            <label key={sub.id} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="radio"
                name="advanceSubType"
                value={sub.id}
                checked={advanceSubType === sub.id}
                onChange={(e) => setAdvanceSubType(e.target.value as "advanceOneway" | "advanceReturn")}
                className="text-primary"
              />
              <span className="text-sm font-medium" style={{ color: OG }}>{sub.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Advance Search compact form */}
      {tripType === "advance" && (
        <div className="border border-orange-200 rounded-xl bg-orange-50/40 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            {/* From */}
            <div className="md:col-span-1 relative" ref={fromRef}>
              <label className="block text-sm font-medium mb-1">Departure</label>
              <input
                type="text"
                value={fromQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setFromQuery(v);
                  setShowFromDropdown(true);
                  setSelectedFrom(null);
                  searchFrom(v);
                }}
                onFocus={() => setShowFromDropdown(true)}
                placeholder="Departure City"
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {showFromDropdown && (
                <AirportDropdown
                  query={fromQuery}
                  loading={fromLoading}
                  options={fromOptions}
                  onSelect={handleFromSelect}
                />
              )}
            </div>

            {/* To */}
            <div className="md:col-span-1 relative" ref={toRef}>
              <label className="block text-sm font-medium mb-1">Arrival</label>
              <input
                type="text"
                value={toQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setToQuery(v);
                  setShowToDropdown(true);
                  setSelectedTo(null);
                  searchTo(v);
                }}
                onFocus={() => setShowToDropdown(true)}
                placeholder="Destination City"
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {showToDropdown && (
                <AirportDropdown query={toQuery} loading={toLoading} options={toOptions} onSelect={handleToSelect} />
              )}
            </div>

            {/* Departure Date */}
            <div>
              <label className="block text-sm font-medium mb-1">Departure Date</label>
              <input
                type="date"
                lang={inputLang}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Return Date – only for Advance Return */}
            <div>
              <label className="block text-sm font-medium mb-1">Return Date</label>
              <input
                type="date"
                lang={inputLang}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                min={departureDate || new Date().toISOString().split("T")[0]}
                disabled={advanceSubType === "advanceOneway"}
                className={`w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary ${
                  advanceSubType === "advanceOneway" ? "bg-gray-100 text-gray-400 cursor-not-allowed" : ""
                }`}
              />
            </div>
          </div>

          {renderRestrictSearchSources("mt-2 mb-4 text-sm")}

          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search Flights"}
          </button>
        </div>
      )}

      {/* Calendar Fare compact form */}
      {tripType === "calendar" && (
        <div className="border border-orange-200 rounded-xl bg-orange-50/40 p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* From */}
            <div className="relative" ref={fromRef}>
              <label className="block text-sm font-medium mb-1">Departure</label>
              <input
                type="text"
                value={fromQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setFromQuery(v);
                  setShowFromDropdown(true);
                  setSelectedFrom(null);
                  searchFrom(v);
                }}
                onFocus={() => setShowFromDropdown(true)}
                placeholder="Departure City"
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {showFromDropdown && (
                <AirportDropdown query={fromQuery} loading={fromLoading} options={fromOptions} onSelect={handleFromSelect} />
              )}
            </div>

            {/* To */}
            <div className="relative" ref={toRef}>
              <label className="block text-sm font-medium mb-1">Arrival</label>
              <input
                type="text"
                value={toQuery}
                onChange={(e) => {
                  const v = e.target.value;
                  setToQuery(v);
                  setShowToDropdown(true);
                  setSelectedTo(null);
                  searchTo(v);
                }}
                onFocus={() => setShowToDropdown(true)}
                placeholder="Destination City"
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {showToDropdown && (
                <AirportDropdown query={toQuery} loading={toLoading} options={toOptions} onSelect={handleToSelect} />
              )}
            </div>

            {/* Month & Year */}
            <div>
              <label className="block text-sm font-medium mb-1">Month & Year</label>
              <input
                type="month"
                value={calendarMonth}
                onChange={(e) => setCalendarMonth(e.target.value)}
                min={new Date().toISOString().slice(0, 7)}
                className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {renderRestrictSearchSources("mt-2 mb-4 text-sm")}

          <button
            onClick={handleSearch}
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search Flights"}
          </button>
        </div>
      )}

      {/* Multi City Form */}
      {tripType === "multicity" && (
        <div ref={mcFormRef} className="mb-4">
          {multiCityLegs.map((leg, idx) => (
            <div key={idx} className="flex items-end gap-0 mb-3">
              {/* Departure */}
              <div className="flex-1 relative">
                {idx === 0 && <label className="block text-xs font-medium text-gray-600 mb-1">Departure</label>}
                <input
                  type="text"
                  value={leg.fromQuery}
                  onChange={e => {
                    const v = e.target.value;
                    updateMcLeg(idx, { fromQuery: v, selectedFrom: null });
                    setMcDropdown({ legIdx: idx, field: "from" });
                    searchMcAirport(idx, "from", v);
                  }}
                  onFocus={() => setMcDropdown({ legIdx: idx, field: "from" })}
                  placeholder="Enter Origin"
                  className="w-full border border-r-0 rounded-l-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {mcDropdown?.legIdx === idx && mcDropdown?.field === "from" && (
                  <AirportDropdown
                    query={leg.fromQuery}
                    loading={!!mcLoading[idx]?.from}
                    options={mcOptions[idx]?.from || []}
                    onSelect={a => {
                    if (leg.selectedTo && a.airportCode === leg.selectedTo.airportCode) { alert("Departure and arrival cannot be the same."); return; }
                    updateMcLeg(idx, { selectedFrom: a, fromQuery: `${a.cityName || a.airportName} (${a.airportCode})` });
                    setMcDropdown(null);
                    saveRecentAirport(a);
                  }} />
                )}
              </div>

              {/* Swap */}
              <button
                type="button"
                onClick={() => swapMcLeg(idx)}
                title="Swap cities"
                className={`w-9 flex-shrink-0 bg-white border-t border-b border-gray-300 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors text-lg font-bold ${idx === 0 ? "mt-5" : ""}`}
                style={{ height: "42px" }}
              >
                ⇄
              </button>

              {/* Arrival */}
              <div className="flex-1 relative">
                {idx === 0 && <label className="block text-xs font-medium text-gray-600 mb-1">Arrival</label>}
                <input
                  type="text"
                  value={leg.toQuery}
                  onChange={e => {
                    const v = e.target.value;
                    updateMcLeg(idx, { toQuery: v, selectedTo: null });
                    setMcDropdown({ legIdx: idx, field: "to" });
                    searchMcAirport(idx, "to", v);
                  }}
                  onFocus={() => setMcDropdown({ legIdx: idx, field: "to" })}
                  placeholder="Enter Destination"
                  className="w-full border border-l-0 rounded-r-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {mcDropdown?.legIdx === idx && mcDropdown?.field === "to" && (
                  <AirportDropdown
                    query={leg.toQuery}
                    loading={!!mcLoading[idx]?.to}
                    options={mcOptions[idx]?.to || []}
                    onSelect={a => {
                    if (leg.selectedFrom && a.airportCode === leg.selectedFrom.airportCode) { alert("Departure and arrival cannot be the same."); return; }
                    updateMcLeg(idx, { selectedTo: a, toQuery: `${a.cityName || a.airportName} (${a.airportCode})` });
                    // Auto-fill next leg's departure with this arrival
                    if (idx + 1 < multiCityLegs.length) {
                      updateMcLeg(idx + 1, { selectedFrom: a, fromQuery: `${a.cityName || a.airportName} (${a.airportCode})` });
                    }
                    setMcDropdown(null);
                    saveRecentAirport(a);
                  }} />
                )}
              </div>

              {/* Date */}
              <div className={`ml-2 ${idx === 0 ? "mt-5" : ""}`} style={{ width: 180 }}>
                <input
                  type="date"
                  lang={inputLang}
                  value={leg.date}
                  onChange={e => {
                    const newDate = e.target.value;
                    updateMcLeg(idx, { date: newDate });
                    // Clear dates on later legs that are now before this date
                    setMultiCityLegs(prev => prev.map((l, i) =>
                      i > idx && l.date && l.date < newDate ? { ...l, date: "" } : l
                    ));
                  }}
                  min={idx === 0
                    ? new Date().toISOString().split("T")[0]
                    : multiCityLegs[idx - 1].date || new Date().toISOString().split("T")[0]}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* ADD CITY / Remove */}
              <div className={`ml-2 flex-shrink-0 ${idx === 0 ? "mt-5" : ""}`} style={{ width: 110 }}>
                {idx === multiCityLegs.length - 1 && multiCityLegs.length < 5 ? (
                  <button
                    onClick={addMcCity}
                    className="w-full border border-gray-400 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-700 hover:border-primary hover:text-primary transition-colors whitespace-nowrap"
                  >
                    ADD CITY
                  </button>
                ) : idx >= 2 ? (
                  <button
                    onClick={() => removeMcLeg(idx)}
                    className="w-full border border-red-300 rounded-lg px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Remove
                  </button>
                ) : <div />}
              </div>
            </div>
          ))}

          {/* Passengers, Class, Search */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 items-end">
            {[
              { label: "Adult (12+ Yrs)", key: "adults" as const, icon: "👤" },
              { label: "Children (2-12 Yrs)", key: "children" as const, icon: "🧒" },
              { label: "Infant (< 2 Yrs)", key: "infants" as const, icon: "👶" },
            ].map(({ label, key, icon }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  <span className="mr-1">{icon}</span>{label}
                </label>
                <select
                  value={passengers[key]}
                  onChange={e => updatePassengers(key, Number(e.target.value))}
                  className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {(key === "adults" ? [1,2,3,4,5,6,7,8,9] : [0,1,2,3,4,5,6,7,8,9]).map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            ))}

            {/* Class */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Class</label>
              <select
                value={cabinClass}
                onChange={e => setCabinClass(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="economy">Economy</option>
                <option value="premiumeconomy">Premium Economy</option>
                <option value="business">Business</option>
                <option value="first">First</option>
              </select>
            </div>

            {/* Search */}
            <div className="flex items-end">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-lg text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#1e3a5f" }}
              >
                {loading ? "Searching..." : <><span>SEARCH</span><span>→</span></>}
              </button>
            </div>
          </div>

          {/* Sources */}
          <div className="mt-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 gap-y-2">
              <button onClick={() => setShowSources(v => !v)} className="flex items-center gap-1 font-semibold text-orange-600 hover:text-orange-700">
                <span>Restrict my search to</span>
                <span className="text-xs">{showSources ? "▲" : "▼"}</span>
              </button>
              {!showSources &&
                (() => {
                  const summary = getRestrictSearchSummary(selectedFare, sources);
                  if (!summary) return null;
                  return (
                    <span
                      className="text-xs text-gray-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 max-w-full"
                      title="These restrictions apply to your next search. Expand to change."
                    >
                      <span className="text-gray-500 font-medium">Applied:</span> {summary}
                    </span>
                  );
                })()}
              {showSources && <>
                <button onClick={() => setSources(ALL_FLIGHT_SOURCE_CODES)} className="text-blue-600 hover:underline text-sm">Select All</button>
                <span className="text-gray-400">/</span>
                <button onClick={() => setSources([])} className="text-blue-600 hover:underline text-sm">Unselect All</button>
              </>}
            </div>

            {showSources && <>
              {/* GDS */}
              <div className="flex flex-wrap gap-4 mt-2 w-full">
                {([["GDS","GDS"],["G9","Air Arabia"],["AK","AirAsia"]] as [string,string][]).map(([code, name]) => (
                  <label key={code} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="checkbox" checked={sources.includes(code)} onChange={() => toggleSource(code)} className="text-primary" />
                    <span>{name}</span>
                  </label>
                ))}
              </div>

              {/* LCC Airlines */}
              <div className="w-full mt-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LCC Airlines</span>
                <div className="flex flex-wrap gap-4 mt-1">
                  {([["6E","IndiGo"],["IX","Air India Express"],["SG","SpiceJet"],["FZ","FlyDubai"],["QP","Akasa Air"],["J9","Jazeera"]] as [string,string][]).map(([code, name]) => (
                    <label key={code} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="checkbox" checked={sources.includes(code)} onChange={() => toggleSource(code)} className="text-primary" />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* NDC Airlines */}
              <div className="w-full mt-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NDC Airlines</span>
                <div className="flex flex-wrap gap-4 mt-1">
                  {([["EK","Emirates"],["LH","Lufthansa"],["WY","Oman Air"],["EY","Etihad Airways"],["GF","Gulf Air"],["AI","Air India"]] as [string,string][]).map(([code, name]) => (
                    <label key={code} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="checkbox" checked={sources.includes(code)} onChange={() => toggleSource(code)} className="text-primary" />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>}
          </div>
        </div>
      )}

      {/* Standard Search Fields */}
      {tripType !== "advance" && tripType !== "calendar" && tripType !== "multicity" && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* From + Swap + To */}
        <div className="md:col-span-2 flex items-end gap-0 relative">
          {/* From */}
          <div className="relative flex-1" ref={fromRef}>
            <label className="block text-sm font-medium mb-1">From</label>
            <input
              type="text"
              value={fromQuery}
              onChange={(e) => {
                const v = e.target.value;
                setFromQuery(v);
                setShowFromDropdown(true);
                setSelectedFrom(null);
                searchFrom(v);
              }}
              onFocus={() => setShowFromDropdown(true)}
              placeholder="Departure City"
              className="w-full border border-r-0 rounded-l-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {showFromDropdown && (
              <AirportDropdown query={fromQuery} loading={fromLoading} options={fromOptions} onSelect={handleFromSelect} />
            )}
          </div>

          {/* Swap Button */}
          <button
            type="button"
            onClick={handleSwap}
            title="Swap cities"
            className="relative z-10 mb-0 w-9 h-[46px] flex-shrink-0 bg-white border-t border-b border-gray-300 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors text-lg font-bold"
            style={{ marginBottom: "0px" }}
          >
            ⇄
          </button>

          {/* To */}
          <div className="relative flex-1" ref={toRef}>
            <label className="block text-sm font-medium mb-1">To</label>
            <input
              type="text"
              value={toQuery}
              onChange={(e) => {
                const v = e.target.value;
                setToQuery(v);
                setShowToDropdown(true);
                setSelectedTo(null);
                searchTo(v);
              }}
              onFocus={() => setShowToDropdown(true)}
              placeholder="Destination City"
              className="w-full border border-l-0 rounded-r-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {showToDropdown && (
              <AirportDropdown query={toQuery} loading={toLoading} options={toOptions} onSelect={handleToSelect} />
            )}
          </div>
        </div>

        {/* Departure Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Departure</label>
          <input
            type="date"
            lang={inputLang}
            value={departureDate}
            onChange={(e) => setDepartureDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Return Date */}
        <div>
          <label className="block text-sm font-medium mb-1">Return</label>
          {tripType === "oneway" ? (
            <div
              onClick={() => setTripType("roundtrip")}
              className="w-full border rounded-lg px-4 py-3 bg-gray-50 text-gray-400 cursor-pointer select-none flex items-center text-sm hover:border-primary hover:text-primary transition-colors"
              title="Click to switch to Round Trip"
            >
              Click to add return date
            </div>
          ) : (
            <input
              type="date"
              lang={inputLang}
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              min={departureDate || new Date().toISOString().split("T")[0]}
              className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>
      </div>

      {/* Passengers and Class */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Passengers</label>
          <div className="space-y-3">
            {[
              { key: "adults", label: "Adults (12+)", min: 1 },
              { key: "children", label: "Children (2-11)", min: 0 },
              { key: "infants", label: "Infants (0-2)", min: 0 },
            ].map(({ key, label, min }) => (
              <div key={key} className="flex justify-between items-center">
                <span>{label}</span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => updatePassengers(key, (passengers as any)[key] - 1)}
                    disabled={(passengers as any)[key] <= min}
                    className="w-8 h-8 border rounded-full flex items-center justify-center disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="w-8 text-center">{(passengers as any)[key]}</span>
                  <button
                    onClick={() => updatePassengers(key, (passengers as any)[key] + 1)}
                    disabled={passengers.adults + passengers.children + passengers.infants >= 9}
                    className="w-8 h-8 border rounded-full flex items-center justify-center disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Cabin Class</label>
          <select
            value={cabinClass}
            onChange={(e) => setCabinClass(e.target.value)}
            className="w-full border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="economy">Economy</option>
            <option value="premium-economy">Premium Economy</option>
            <option value="business">Business</option>
            <option value="first">First Class</option>
          </select>
        </div>
      </div>

      {/* Restrict my search to — full width */}
      <div className="mt-4 mb-2 text-sm">
        <div className="flex flex-wrap items-center gap-2 gap-y-2">
          <button onClick={() => setShowSources(v => !v)} className="flex items-center gap-1 font-semibold text-orange-600 hover:text-orange-700">
            <span>Restrict my search to</span>
            <span className="text-xs">{showSources ? "▲" : "▼"}</span>
          </button>
          {!showSources &&
            (() => {
              const summary = getRestrictSearchSummary(selectedFare, sources);
              if (!summary) return null;
              return (
                <span
                  className="text-xs text-gray-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 max-w-full"
                  title="These restrictions apply to your next search. Expand to change."
                >
                  <span className="text-gray-500 font-medium">Applied:</span> {summary}
                </span>
              );
            })()}
          {showSources && <>
            <button
              onClick={() => setSources(ALL_FLIGHT_SOURCE_CODES)}
              className="text-blue-600 hover:underline"
            >Select All</button>
            <span className="text-gray-400">/</span>
            <button onClick={() => setSources([])} className="text-blue-600 hover:underline">Unselect All</button>
          </>}
        </div>

        {showSources && <>
          {/* GDS / Others */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-2 mb-3">
            {([["GDS","GDS"],["G9","Air Arabia"],["AK","AirAsia"]] as [string,string][]).map(([code, name]) => {
              const isDisabled = (selectedFare === "student" && !["6E","SG","GDS"].includes(code)) ||
                                 (selectedFare === "senior" && !["6E","SG"].includes(code));
              return (
                <label key={code} className={`flex items-center space-x-2 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input type="checkbox" checked={sources.includes(code)} onChange={() => toggleSource(code)} disabled={isDisabled} className="text-primary disabled:cursor-not-allowed" />
                  <span className="text-sm">{name}</span>
                </label>
              );
            })}
          </div>

          {/* LCC Airlines */}
          <div className="mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">LCC Airlines</span>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-1">
              {([["6E","IndiGo"],["IX","Air India Express"],["SG","SpiceJet"],["FZ","FlyDubai"],["QP","Akasa Air"],["J9","Jazeera"]] as [string,string][]).map(([code, name]) => {
                const isDisabled = (selectedFare === "student" && !["6E","SG","GDS"].includes(code)) ||
                                   (selectedFare === "senior" && !["6E","SG"].includes(code));
                return (
                  <label key={code} className={`flex items-center space-x-2 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input type="checkbox" checked={sources.includes(code)} onChange={() => toggleSource(code)} disabled={isDisabled} className="text-primary disabled:cursor-not-allowed" />
                    <span className="text-sm">{name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* NDC Airlines */}
          <div className="mb-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">NDC Airlines</span>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-1">
              {([["EK","Emirates"],["LH","Lufthansa"],["WY","Oman Air"],["EY","Etihad Airways"],["GF","Gulf Air"],["AI","Air India"]] as [string,string][]).map(([code, name]) => {
                const isDisabled = (selectedFare === "student" && !["6E","SG","GDS"].includes(code)) ||
                                   (selectedFare === "senior" && !["6E","SG"].includes(code));
                return (
                  <label key={code} className={`flex items-center space-x-2 ${isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                    <input type="checkbox" checked={sources.includes(code)} onChange={() => toggleSource(code)} disabled={isDisabled} className="text-primary disabled:cursor-not-allowed" />
                    <span className="text-sm">{name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </>}
      </div>

      {/* Special Fares */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Special Fares</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SPECIAL_FARES.map((fare) => (
            <button
              key={fare.id}
              onClick={() => setSelectedFare(fare.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                selectedFare === fare.id
                  ? "border-primary bg-primary/5 text-primary font-semibold"
                  : "border-gray-200 text-gray-600 hover:border-primary hover:text-primary"
              }`}
            >
              <span className="text-sm">{fare.icon}</span>
              <div className="text-left">
                <div className="text-xs font-medium leading-tight">{fare.label}</div>
                <div className="text-[10px] text-gray-400 leading-tight">{fare.sub}</div>
              </div>
              {fare.discount && (
                <span className="text-[10px] bg-green-100 text-green-700 px-1 py-0.5 rounded font-semibold">
                  {fare.discount} off
                </span>
              )}
              {selectedFare === fare.id && <span className="text-primary text-[10px]">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Search Button */}
      <button
        onClick={handleSearch}
        disabled={loading}
        className="w-full bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-50"
      >
        {loading ? "Searching..." : "Search Flights"}
      </button>
      </>
      )}
    </div>
    {/* ── end Search Form ── */}

    {/* ── App Download Card ── */}
    <div className="w-full lg:w-[260px] lg:flex-shrink-0" style={{
      borderRadius: 12,
      overflow: "hidden",
      boxShadow: "0 2px 12px rgba(252,102,3,0.18)",
      border: "1px solid #fed7aa",
      display: "flex",
      flexDirection: "column",
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${OG} 0%, #ff8c38 100%)`,
        padding: "22px 14px 18px",
        textAlign: "center",
      }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>✈️</div>
        <div style={{ color: "white", fontWeight: 800, fontSize: 13, marginTop: 6, letterSpacing: 0.3 }}>
          Vivance Travels App
        </div>
        <div style={{ color: "rgba(255,255,255,0.82)", fontSize: 10, marginTop: 3 }}>
          Book faster. Travel smarter.
        </div>
      </div>
      <div style={{ background: "white", padding: "16px 16px 20px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        {[
          ["⚡", "Instant booking & e-ticket"],
          ["🔔", "Real-time flight alerts"],
          ["💸", "App-exclusive deals"],
          ["📍", "Live trip tracking"],
        ].map(([icon, text]) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <span style={{ fontSize: 13 }}>{icon}</span>
            <span style={{ fontSize: 11, color: "#374151" }}>{text}</span>
          </div>
        ))}
        <div style={{ height: 1, background: "#f3f4f6", margin: "10px 0" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          <a href="#" style={{ display: "flex", alignItems: "center", gap: 8, background: "#111827", borderRadius: 8, padding: "7px 10px", textDecoration: "none" }}
            onMouseOver={e => (e.currentTarget.style.opacity = "0.85")} onMouseOut={e => (e.currentTarget.style.opacity = "1")}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>🍎</span>
            <div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 8, lineHeight: 1, marginBottom: 2 }}>Download on the</div>
              <div style={{ color: "white", fontSize: 12, fontWeight: 700, lineHeight: 1 }}>App Store</div>
            </div>
          </a>
          <a href="#" style={{ display: "flex", alignItems: "center", gap: 8, background: "#111827", borderRadius: 8, padding: "7px 10px", textDecoration: "none" }}
            onMouseOver={e => (e.currentTarget.style.opacity = "0.85")} onMouseOut={e => (e.currentTarget.style.opacity = "1")}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>▶️</span>
            <div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 8, lineHeight: 1, marginBottom: 2 }}>Get it on</div>
              <div style={{ color: "white", fontSize: 12, fontWeight: 700, lineHeight: 1 }}>Google Play</div>
            </div>
          </a>
        </div>
        <div style={{ marginTop: 10, background: "#fff7ed", borderRadius: 8, padding: "7px 10px", display: "flex", alignItems: "center", gap: 7, border: "1px dashed #fed7aa" }}>
          <span style={{ fontSize: 22 }}>📲</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: OG }}>Scan to Download</div>
            <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 1 }}>vivancetravels.com/app</div>
          </div>
        </div>
      </div>
    </div>
    {/* ── end App Download Card ── */}

  </div>
);
}
