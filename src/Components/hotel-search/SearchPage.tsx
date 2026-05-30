"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { LocationSearchSelected } from "@/Components/LocationSearchInput";
import { FiltersSidebar } from "./FiltersSidebar";
import { HotelResults } from "./HotelResults";
import {
  BackendHotelSearchResponse,
  FiltersState,
  HotelApiItem,
  PaginationState,
  RoomRequest,
  SearchState,
  normalizeHotelRooms,
} from "./types";
import { SearchForm } from "./SearchForm";

// Leaflet touches `window` at import-time; avoid SSR/prerender crashes.
const HotelMapModal = dynamic(() => import("./HotelMapModal"), {
  ssr: false,
  loading: () => null,
});

const FILTER_DEBOUNCE_MS = 300;

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

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildUrlFromState(state: Pick<SearchState, "location" | "checkIn" | "checkOut" | "rooms" | "filters" | "pagination">) {
  const sp = new URLSearchParams();
  if (state.location) {
    sp.set("locType", state.location.type);
    sp.set("locId", String(state.location.id));
    sp.set("locName", state.location.name);
  }
  if (state.checkIn) sp.set("checkIn", state.checkIn);
  if (state.checkOut) sp.set("checkOut", state.checkOut);
  sp.set("rooms", JSON.stringify(state.rooms));
  sp.set("filters", JSON.stringify({ ...state.filters, sort: state.filters.sort }));
  sp.set("page", String(state.pagination.page));
  sp.set("size", String(state.pagination.size));
  return `?${sp.toString()}`;
}

function stateFromUrl(params: URLSearchParams) {
  const locType = params.get("locType") as LocationSearchSelected["type"] | null;
  const locId = params.get("locId");
  const locName = params.get("locName");
  const location: LocationSearchSelected | null =
    locType && locId && locName ? { type: locType, id: isNaN(Number(locId)) ? locId : Number(locId), name: locName } : null;

  const checkIn = params.get("checkIn") || "";
  const checkOut = params.get("checkOut") || "";
  const rooms = normalizeHotelRooms(safeJsonParse<RoomRequest[]>(params.get("rooms")) || [{ adults: 2, children: [] }]);
  const filtersFromUrl = safeJsonParse<Partial<FiltersState>>(params.get("filters")) || {};
  const filters: FiltersState = {
    priceMin: Number(filtersFromUrl.priceMin || 0),
    priceMax: Number(filtersFromUrl.priceMax || 0),
    stars: Array.isArray(filtersFromUrl.stars) ? filtersFromUrl.stars.map(Number).filter(Boolean) : [],
    sort: (filtersFromUrl.sort as any) || "price_asc",
  };
  const pagination: PaginationState = {
    page: Math.max(1, Number(params.get("page") || 1)),
    size: Math.max(1, Number(params.get("size") || 20)),
    total: 0,
  };

  return { location, checkIn, checkOut, rooms, filters, pagination };
}

function buildSearchPayload(state: SearchState) {
  const loc = state.location;
  const base: any = {
    checkIn: state.checkIn,
    checkOut: state.checkOut,
    rooms: normalizeHotelRooms(state.rooms),
    filters: {
      priceMin: state.filters.priceMin || 0,
      priceMax: state.filters.priceMax || 0,
      stars: state.filters.stars || [],
    },
    pagination: {
      page: state.pagination.page,
      size: state.pagination.size,
    },
  };
  if (loc?.type === "city") base.destinationId = Number(loc.id);
  if (loc?.type === "hotel") base.hotelCode = String(loc.id);
  return base;
}

function applyClientSort(hotels: HotelApiItem[], sort: FiltersState["sort"]) {
  const list = [...hotels];
  if (sort === "price_asc") list.sort((a, b) => (a.startingPrice || 0) - (b.startingPrice || 0));
  if (sort === "rating_desc") list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return list;
}

function mapBackendResponseToHotels(raw: any): HotelApiItem[] {
  const resp = raw as BackendHotelSearchResponse;
  const list = resp?.data?.HotelResult;
  if (!Array.isArray(list)) return [];

  return list.map((h) => {
    const rooms = Array.isArray(h.Rooms) ? h.Rooms : [];
    const currency = h.Currency || "INR";

    const uiRooms = rooms
      .filter((r) => !!r?.BookingCode)
      .map((r) => ({
        bookingCode: r.BookingCode,
        name: Array.isArray(r.Name) ? r.Name.join(" · ") : "Room option",
        inclusion: r.Inclusion || "",
        mealType: r.MealType || "",
        refundable: !!r.IsRefundable,
        totalFare: Number(r.TotalFare || 0),
        totalTax: Number(r.TotalTax || 0),
      }))
      .filter((r) => r.totalFare > 0)
      .sort((a, b) => a.totalFare - b.totalFare);

    const startingPrice = uiRooms.length ? uiRooms[0].totalFare : 0;

    const latRaw: any = (h as any).Latitude ?? (h as any).Lat ?? (h as any).latitude ?? (h as any).lat;
    const lngRaw: any = (h as any).Longitude ?? (h as any).Lng ?? (h as any).longitude ?? (h as any).lng;
    const latNum = latRaw === undefined || latRaw === null || latRaw === "" ? undefined : Number(latRaw);
    const lngNum = lngRaw === undefined || lngRaw === null || lngRaw === "" ? undefined : Number(lngRaw);
    const hasGeo = Number.isFinite(latNum) && Number.isFinite(lngNum) && Math.abs(latNum as number) <= 90 && Math.abs(lngNum as number) <= 180;

    return {
      hotelCode: h.HotelCode,
      name: h.HotelName || h.Name || `Hotel ${h.HotelCode}`,
      currency,
      startingPrice,
      rating: Number(h.Rating || 0),
      starRating: Number(h.StarRating || 0),
      address: h.Address || "",
      amenities: Array.isArray(h.Amenities) ? h.Amenities : [],
      rooms: uiRooms,
      lat: hasGeo ? (latNum as number) : undefined,
      lng: hasGeo ? (lngNum as number) : undefined,
    };
  });
}

export function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initial = useMemo(() => {
    const base = stateFromUrl(new URLSearchParams(searchParams?.toString() || ""));
    const t = todayIso();
    const defaultCheckIn = base.checkIn || t;
    const defaultCheckOut = base.checkOut || addDays(defaultCheckIn, 1);
    return {
      location: base.location,
      checkIn: defaultCheckIn,
      checkOut: defaultCheckOut,
      rooms: base.rooms,
      filters: base.filters,
      pagination: { ...base.pagination, page: base.pagination.page || 1, size: base.pagination.size || 20 },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [location, setLocation] = useState<LocationSearchSelected | null>(initial.location);
  const [checkIn, setCheckIn] = useState(initial.checkIn);
  const [checkOut, setCheckOut] = useState(initial.checkOut);
  const [rooms, setRooms] = useState<RoomRequest[]>(initial.rooms);
  const [filters, setFilters] = useState<FiltersState>(initial.filters);
  const [pagination, setPagination] = useState<PaginationState>(initial.pagination);

  const [hotels, setHotels] = useState<HotelApiItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string | undefined>>({});
  const [selectedBooking, setSelectedBooking] = useState<{ hotelCode: string; bookingCode: string } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  // Allow deep-linking from the home header "Search On Map" link.
  useEffect(() => {
    const openMap = searchParams?.get("openMap");
    if (openMap === "1" || openMap === "true") setMapOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abortRef = useRef<AbortController | null>(null);
  const lastRequestKeyRef = useRef<string>("");
  const filterDebounceRef = useRef<number | null>(null);
  const lastSearchWasLoadMoreRef = useRef(false);

  const state: SearchState = useMemo(
    () => ({
      location,
      checkIn,
      checkOut,
      rooms,
      filters,
      pagination,
    }),
    [location, checkIn, checkOut, rooms, filters, pagination]
  );

  const hasMore = pagination.total ? hotels.length < pagination.total : false;

  const pushUrl = (next: SearchState) => {
    router.replace(buildUrlFromState(next), { scroll: false });
  };

  const runSearch = async ({
    mode,
    locationOverride,
  }: {
    mode: "new" | "loadMore" | "filters";
    locationOverride?: LocationSearchSelected;
  }) => {
    const effectiveLocation = locationOverride ?? state.location;
    if (!effectiveLocation) return;

    const nextPagination = mode === "loadMore"
      ? { ...pagination, page: pagination.page + 1 }
      : { ...pagination, page: 1 };

    const nextState: SearchState = {
      ...state,
      location: effectiveLocation,
      pagination: nextPagination,
    };

    const payload = buildSearchPayload(nextState);
    const requestKey = JSON.stringify(payload);
    if (requestKey === lastRequestKeyRef.current) return;
    lastRequestKeyRef.current = requestKey;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    lastSearchWasLoadMoreRef.current = mode === "loadMore";
    setLoading(true);
    setError(null);

    pushUrl(nextState);

    try {
      const res = await fetch("/api/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ac.signal,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Search failed (${res.status})`);
      }

      const data = (await res.json()) as any;
      const mapped = Array.isArray((data as any)?.hotels)
        ? ((data as any).hotels as HotelApiItem[])
        : mapBackendResponseToHotels(data);

      const pageHotels = mapped;
      const total = Number((data as any)?.pagination?.total || mapped.length || 0);
      const page = Number((data as any)?.pagination?.page || nextPagination.page);

      const sorted = applyClientSort(pageHotels, nextState.filters.sort);

      setPagination((p) => ({ ...p, page, total, size: nextPagination.size }));
      setHotels((prev) => (mode === "loadMore" ? [...prev, ...sorted] : sorted));

      // Keep any previous room selections that still exist; otherwise clear.
      setSelectedRooms((prev) => {
        const next: Record<string, string | undefined> = {};
        sorted.forEach((h) => {
          const existing = prev[h.hotelCode];
          const stillValid = existing && h.rooms.some((r) => r.bookingCode === existing);
          if (stillValid) next[h.hotelCode] = existing;
        });
        return next;
      });
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (filterDebounceRef.current) window.clearTimeout(filterDebounceRef.current);
    };
  }, []);

  // Debounced filters → new API call, keeping previous hotels while loading.
  useEffect(() => {
    if (!location) return;
    if (filterDebounceRef.current) window.clearTimeout(filterDebounceRef.current);
    filterDebounceRef.current = window.setTimeout(() => {
      runSearch({ mode: "filters" });
    }, FILTER_DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.priceMin, filters.priceMax, JSON.stringify(filters.stars), filters.sort]);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero banner */}
      <div className="bg-gradient-to-r from-orange-600 via-primary to-orange-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <div>
              <div className="flex items-center gap-2 text-orange-100 text-sm mb-1">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Hotels
              </div>
              <h1 className="text-2xl font-extrabold text-white">
                {location ? `Hotels in ${location.name}` : "Find your perfect stay"}
              </h1>
              {location && (
                <div className="text-orange-100 text-sm mt-1">
                  {checkIn && checkOut ? `${checkIn} → ${checkOut}` : "Select dates"}{" "}
                  {rooms.length > 0 && `· ${rooms.reduce((s, r) => s + r.adults, 0)} adults`}
                </div>
              )}
            </div>
            {hotels.length > 0 && (
              <div className="bg-white/20 backdrop-blur-sm text-white rounded-2xl px-4 py-2 text-center">
                <div className="text-2xl font-extrabold">{pagination.total || hotels.length}</div>
                <div className="text-xs text-orange-100">hotels found</div>
              </div>
            )}
          </div>

          <SearchForm
            location={location}
            checkIn={checkIn}
            checkOut={checkOut}
            rooms={rooms}
            loading={loading && hotels.length === 0}
            onOpenMap={() => setMapOpen(true)}
            onChange={(next) => {
              if ("location" in next) setLocation(next.location ?? null);
              if ("checkIn" in next && next.checkIn) setCheckIn(next.checkIn);
              if ("checkOut" in next && next.checkOut) setCheckOut(next.checkOut);
              if ("rooms" in next && next.rooms) {
                setRooms(next.rooms);
                try {
                  sessionStorage.setItem("vivance_hotel_rooms", JSON.stringify(next.rooms));
                } catch {}
              }
              setPagination((p) => ({ ...p, page: 1 }));
              setError(null);
              const nextState: SearchState = {
                ...state,
                location: "location" in next ? (next.location ?? null) : state.location,
                checkIn: "checkIn" in next && next.checkIn ? next.checkIn : state.checkIn,
                checkOut: "checkOut" in next && next.checkOut ? next.checkOut : state.checkOut,
                rooms: "rooms" in next && next.rooms ? next.rooms : state.rooms,
                pagination: { ...state.pagination, page: 1 },
              };
              pushUrl(nextState);
            }}
            onSearch={() => runSearch({ mode: "new" })}
          />
        </div>
      </div>

      <HotelMapModal
          isOpen={mapOpen}
          onClose={() => setMapOpen(false)}
          onSelectLocation={(loc) => {
            setLocation(loc);
            setMapOpen(false);
            runSearch({ mode: "new", locationOverride: loc });
          }}
        />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Sidebar */}
          <div className="lg:col-span-3">
            <div className="sticky top-4">
              <FiltersSidebar
                hotels={hotels}
                filters={filters}
                onChange={(next) => {
                  setFilters(next);
                  setPagination((p) => ({ ...p, page: 1 }));
                }}
              />
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-9 space-y-4 min-w-0">

            {/* Results toolbar */}
            <div className="flex items-center justify-between gap-2 flex-wrap bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
              <div className="flex items-center gap-2">
                {loading && hotels.length > 0 ? (
                  <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
                <span className="text-sm text-gray-600">
                  <span className="font-bold text-gray-900">{hotels.length}</span>
                  {pagination.total ? (
                    <span className="text-gray-400"> of {pagination.total}</span>
                  ) : null}{" "}
                  hotels
                  {loading && hotels.length > 0 && (
                    <span className="ml-1 text-xs text-gray-400">· Updating…</span>
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-orange-700 transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Search on Map
              </button>
            </div>

            <HotelResults
              hotels={hotels}
              loading={loading && hotels.length === 0}
              error={error}
              selectedRooms={selectedRooms}
              onSelectRoom={(hotelCode, bookingCode) => {
                setSelectedRooms((prev) => ({ ...prev, [hotelCode]: bookingCode }));
                setSelectedBooking({ hotelCode, bookingCode });
              }}
            />

            {/* Sticky booking bar */}
            {selectedBooking && (() => {
              const hotel = hotels.find((h) => h.hotelCode === selectedBooking.hotelCode);
              const room = hotel?.rooms.find((r) => r.bookingCode === selectedBooking.bookingCode);
              return (
                <div className="sticky bottom-4 z-10">
                  <div className="rounded-2xl bg-white border border-orange-200 shadow-xl shadow-orange-100/50 px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500 font-medium">Selected room</div>
                      <div className="text-sm font-bold text-gray-900 truncate">
                        {hotel?.name || selectedBooking.hotelCode}
                      </div>
                      {room && (
                        <div className="text-xs text-gray-500 truncate">{room.name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {room && (
                        <div className="text-right hidden sm:block">
                          <div className="text-xs text-gray-400">Total fare</div>
                          <div className="text-lg font-extrabold text-primary">
                            {hotel?.currency} {Math.round(room.totalFare).toLocaleString()}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        className="rounded-xl bg-primary hover:bg-primary-dark px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-primary/30 transition-colors"
                        onClick={() => {
                          router.push(
                            `/hotels/prebook?bookingCode=${encodeURIComponent(
                              selectedBooking.bookingCode
                            )}&checkIn=${encodeURIComponent(checkIn)}`
                          );
                        }}
                      >
                        Book Now →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Load more */}
            {error === null && hotels.length > 0 && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => runSearch({ mode: "loadMore" })}
                  disabled={loading || !hasMore}
                  className="rounded-xl border-2 border-primary/30 bg-white px-6 py-3 text-sm font-bold text-primary hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {!hasMore
                    ? "All hotels loaded"
                    : loading && lastSearchWasLoadMoreRef.current
                    ? "Loading more…"
                    : "Load more hotels"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

