"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Hotel {
  id: string | null;
  name: string;
  city: string;
  country: string;
  address: string;
  starRating: number;
  amenities: string[];
  imageUrls: string[];
  startingPrice: number;
  currency: string;
  aggregatorSource: string;
  externalHotelId: string;
  resultIndex: number;
  traceId: string;
}

interface SearchParams {
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  rooms: number;
  adults: number;
  children: number;
  guestNationality: string;
}

interface HotelResultsProps {
  hotels: Hotel[];
  searchParams: SearchParams;
  onBack: () => void;
}

function StarDisplay({ count }: { count: number }) {
  const stars = Math.min(5, Math.max(0, count));
  return (
    <span className="text-yellow-400 text-sm select-none">
      {"★".repeat(stars)}{"☆".repeat(5 - stars)}
    </span>
  );
}

function formatPrice(price: number, currency: string) {
  if (currency === "INR") {
    return `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
  return `${currency} ${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const PLACEHOLDER_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='160' viewBox='0 0 200 160'%3E%3Crect width='200' height='160' fill='%23e5e7eb'/%3E%3Ctext x='50%25' y='45%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='28'%3E%F0%9F%8F%A8%3C/text%3E%3Ctext x='50%25' y='70%25' dominant-baseline='middle' text-anchor='middle' fill='%239ca3af' font-size='11'%3ENo Image%3C/text%3E%3C/svg%3E";

export default function HotelResults({ hotels, searchParams, onBack }: HotelResultsProps) {
  const router = useRouter();
  const safeHotels = Array.isArray(hotels) ? hotels : [];
  const [filterStars, setFilterStars] = useState<number | null>(null);
  const [filterMinPrice, setFilterMinPrice] = useState<string>("");
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("");
  const [propertySearch, setPropertySearch] = useState("");
  const [sortBy, setSortBy] = useState("recommended");

  const getImageUrl = (hotel: any) => hotel?.imageUrls?.[0] || PLACEHOLDER_SVG;
  const getHotelName = (hotel: any) => {
    const direct = hotel?.name || hotel?.HotelName;
    if (direct) return direct;
    const firstRoomName = hotel?.Rooms?.[0]?.Name?.[0];
    if (typeof firstRoomName === "string" && firstRoomName.trim()) return firstRoomName.trim();
    const code = hotel?.HotelCode || hotel?.hotelCode || "";
    return code ? `Hotel ${code}` : "Hotel";
  };
  const getStarRating = (hotel: any) => Number(hotel?.starRating ?? hotel?.StarRating ?? 0) || 0;
  const getAddress = (hotel: any) => hotel?.address || hotel?.Address || "";
  const getAmenities = (hotel: any) => (Array.isArray(hotel?.amenities) ? hotel.amenities : Array.isArray(hotel?.Amenities) ? hotel.Amenities : []);
  const getCurrency = (hotel: any) => hotel?.currency || hotel?.Currency || "INR";
  const getStartingPrice = (hotel: any) => {
    const direct = Number(hotel?.startingPrice ?? hotel?.price ?? 0);
    if (direct) return direct;
    const rooms = Array.isArray(hotel?.Rooms) ? hotel.Rooms : [];
    const min = rooms.reduce((acc: number, r: any) => {
      const fare = Number(r?.TotalFare || 0);
      return fare > 0 ? Math.min(acc, fare) : acc;
    }, Number.POSITIVE_INFINITY);
    return Number.isFinite(min) ? min : 0;
  };

  const getFirstBookingCode = (hotel: any) => {
    const direct = hotel?.bookingCode || hotel?.BookingCode;
    if (direct) return String(direct);
    const rooms = Array.isArray(hotel?.Rooms) ? hotel.Rooms : [];
    const bc = rooms?.[0]?.BookingCode;
    return bc ? String(bc) : "";
  };

  const starCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    safeHotels.forEach((h) => {
      const s = getStarRating(h);
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [safeHotels]);

  const minPrice = safeHotels.length ? Math.min(...safeHotels.map((h) => getStartingPrice(h))) : 0;
  const maxPrice = safeHotels.length ? Math.max(...safeHotels.map((h) => getStartingPrice(h))) : 10000;

  const filtered = useMemo(() => {
    let list = [...safeHotels];
    if (filterStars !== null) list = list.filter((h) => getStarRating(h) === filterStars);
    if (filterMinPrice !== "") list = list.filter((h) => getStartingPrice(h) >= Number(filterMinPrice));
    if (filterMaxPrice !== "") list = list.filter((h) => getStartingPrice(h) <= Number(filterMaxPrice));
    if (propertySearch.trim()) {
      const q = propertySearch.toLowerCase();
      list = list.filter(
        (h) => getHotelName(h).toLowerCase().includes(q) || getAddress(h).toLowerCase().includes(q)
      );
    }
    if (sortBy === "price-low") list.sort((a, b) => getStartingPrice(a) - getStartingPrice(b));
    else if (sortBy === "price-high") list.sort((a, b) => getStartingPrice(b) - getStartingPrice(a));
    else if (sortBy === "stars") list.sort((a, b) => getStarRating(b) - getStarRating(a));
    return list;
  }, [safeHotels, filterStars, filterMinPrice, filterMaxPrice, propertySearch, sortBy]);

  const nights = searchParams.nights || 1;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Sticky search summary bar */}
      <div className="bg-white shadow-sm py-3 px-4 sticky top-0 z-10 border-b">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline flex-shrink-0"
          >
            ← Modify Search
          </button>
          <span className="text-gray-400 hidden sm:block">|</span>
          <span className="text-gray-600 text-sm">
            <strong>{searchParams.city}</strong> &nbsp;·&nbsp; {searchParams.checkIn} – {searchParams.checkOut}
            &nbsp;·&nbsp; {nights} night{nights !== 1 ? "s" : ""}
            &nbsp;·&nbsp; {searchParams.adults} adult{searchParams.adults !== 1 ? "s" : ""}
            {searchParams.children > 0 && `, ${searchParams.children} child${searchParams.children !== 1 ? "ren" : ""}`}
            &nbsp;·&nbsp; {searchParams.rooms} room{searchParams.rooms !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex gap-5">
          {/* Left Sidebar */}
          <aside className="w-60 flex-shrink-0 space-y-4 hidden lg:block">
            {/* Map placeholder */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div
                className="h-36 flex flex-col items-center justify-center text-gray-400 text-sm relative"
                style={{
                  background: "linear-gradient(135deg, #d1fae5 0%, #bfdbfe 100%)",
                }}
              >
                <span className="text-3xl mb-1">🗺️</span>
                <span className="text-xs font-medium text-gray-500">Map View</span>
              </div>
              <div className="p-2 text-center border-t">
                <button className="text-blue-600 text-sm hover:underline font-medium">
                  View in a map
                </button>
              </div>
            </div>

            {/* Property name search */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-2 text-sm">Search by property name</h3>
              <div className="flex items-center border border-gray-300 rounded px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500">
                <span className="text-gray-400 mr-2 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="e.g. Marriott"
                  value={propertySearch}
                  onChange={(e) => setPropertySearch(e.target.value)}
                  className="flex-1 text-sm outline-none"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Filter by</h3>

              {/* Star Rating */}
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Star Rating
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filterStars === null}
                      onChange={() => setFilterStars(null)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm text-blue-600">All ({hotels.length})</span>
                  </label>
                  {[5, 4, 3, 2, 1].map((star) =>
                    starCounts[star] ? (
                      <label key={star} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterStars === star}
                          onChange={() => setFilterStars(filterStars === star ? null : star)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-yellow-400 text-xs leading-none">
                          {"★".repeat(star)}
                        </span>
                        <span className="text-sm text-blue-600">({starCounts[star]})</span>
                      </label>
                    ) : null
                  )}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Price per night
                </h4>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Min</label>
                    <input
                      type="number"
                      value={filterMinPrice}
                      onChange={(e) => setFilterMinPrice(e.target.value)}
                      placeholder={String(Math.floor(minPrice))}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 block mb-1">Max</label>
                    <input
                      type="number"
                      value={filterMaxPrice}
                      onChange={(e) => setFilterMaxPrice(e.target.value)}
                      placeholder={String(Math.ceil(maxPrice))}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            {/* Results count + sort */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <span className="text-gray-700 text-sm font-medium">
                {filtered.length} {filtered.length === 1 ? "property" : "properties"} found
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="recommended">Recommended for you</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="stars">Star Rating</option>
                </select>
              </div>
            </div>

            {/* Hotel Cards */}
            {filtered.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-500">
                <div className="text-4xl mb-3">🏨</div>
                <p className="font-medium">No properties match your filters.</p>
                <button
                  onClick={() => {
                    setFilterStars(null);
                    setFilterMinPrice("");
                    setFilterMaxPrice("");
                    setPropertySearch("");
                  }}
                  className="mt-3 text-blue-600 text-sm hover:underline"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((hotel, idx) => (
                  <div
                    key={hotel.externalHotelId || (hotel as any)?.HotelCode || idx}
                    className="bg-white rounded-lg shadow-sm overflow-hidden flex hover:shadow-md transition-shadow border border-gray-100"
                  >
                    {/* Image */}
                    <div className="w-44 sm:w-52 flex-shrink-0">
                      <img
                        src={getImageUrl(hotel)}
                        alt={getHotelName(hotel)}
                        className="w-full h-full object-cover"
                        style={{ minHeight: "172px" }}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_SVG;
                        }}
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 p-4 flex min-w-0">
                      <div className="flex-1 min-w-0 pr-4">
                        <h3 className="font-bold text-gray-900 text-base leading-snug mb-1 truncate">
                          {getHotelName(hotel)}
                        </h3>
                        <div className="flex items-center gap-2 mb-2">
                          <StarDisplay count={getStarRating(hotel)} />
                          <span className="text-xs text-gray-500">
                            {getStarRating(hotel) > 0 ? `${getStarRating(hotel)}-star hotel` : "Unrated"}
                          </span>
                        </div>
                        {getAddress(hotel) && (
                          <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">
                            📍 {getAddress(hotel)}
                          </p>
                        )}
                        {getAmenities(hotel).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {getAmenities(hotel).slice(0, 4).map((amenity: string, i: number) => (
                              <span
                                key={i}
                                className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full"
                              >
                                {amenity}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Price column */}
                      <div className="flex-shrink-0 flex flex-col items-end justify-between">
                        <div />
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-0.5">Starting from</div>
                          <div className="text-2xl font-bold text-gray-900">
                            {formatPrice(getStartingPrice(hotel), getCurrency(hotel))}
                          </div>
                          <div className="text-xs text-gray-500">per night</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {formatPrice(getStartingPrice(hotel) * nights, getCurrency(hotel))} total
                          </div>
                          <button
                            className="mt-3 px-5 py-2 text-white text-sm font-semibold rounded hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: "#1e3a5f" }}
                            onClick={() => {
                              const bookingCode = getFirstBookingCode(hotel);
                              if (!bookingCode) {
                                alert("BookingCode not found for this hotel option.");
                                return;
                              }
                              router.push(
                                `/hotels/prebook?bookingCode=${encodeURIComponent(
                                  bookingCode
                                )}&checkIn=${encodeURIComponent(searchParams?.checkIn || "")}`
                              );
                            }}
                          >
                            See availability
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
