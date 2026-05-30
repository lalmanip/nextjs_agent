"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { LocationSearchSelected } from "@/Components/LocationSearchInput";

// Fix default marker icon paths in bundlers
// eslint-disable-next-line @typescript-eslint/no-var-requires
L.Icon.Default.mergeOptions({
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const INDIA_CENTER: [number, number] = [20.5937, 78.9629];
const RADIUS_OPTIONS = [1, 2, 5, 10, 25];

type NominatimItem = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    municipality?: string;
    state_district?: string;
    state?: string;
  };
};

function normalizeHotelLocations(payload: any): Array<{ type: "city" | "hotel"; id: number | string; name: string }> {
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.data)
    ? payload.data.data
    : [];
  return raw
    .map((x: any) => ({ type: x?.type === "city" ? "city" : "hotel", id: x?.id, name: String(x?.name || "") }))
    .filter((x: any) => !!x.name);
}

// Tracks map center on every pan/zoom end
function MapCenterTracker({ onMoveEnd }: { onMoveEnd: (lat: number, lng: number) => void }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onMoveEnd(c.lat, c.lng);
    },
  });
  return null;
}

// Moves the map view when target changes (programmatic navigation)
function MoveToTarget({ target }: { target: [number, number] | null }) {
  const map = useMap();
  const prev = useRef<string>("");
  useEffect(() => {
    if (!target) return;
    const key = `${target[0]},${target[1]}`;
    if (prev.current === key) return;
    prev.current = key;
    map.setView(target, 13, { animate: true });
  }, [map, target]);
  return null;
}

export default function HotelMapModal({
  isOpen,
  onClose,
  onSelectLocation,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (location: LocationSearchSelected) => void;
}) {
  const [center, setCenter] = useState<[number, number]>(INDIA_CENTER);
  const [moveTarget, setMoveTarget] = useState<[number, number] | null>(null);
  const [addressInput, setAddressInput] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [radiusKm, setRadiusKm] = useState(5);
  const [locating, setLocating] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState("");

  const revGeoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fwdGeoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (revGeoTimer.current) clearTimeout(revGeoTimer.current);
      if (fwdGeoTimer.current) clearTimeout(fwdGeoTimer.current);
    };
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=en`,
        { headers: { "User-Agent": "VivanceTravels/1.0" } },
      );
      const data: NominatimItem = await res.json();
      setAddressInput(data.display_name || "");
    } catch {}
  }, []);

  // Request geolocation when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSelectError("");

    if (!navigator?.geolocation) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCenter([lat, lng]);
        setMoveTarget([lat, lng]);
        setLocating(false);
        reverseGeocode(lat, lng);
      },
      () => setLocating(false),
      { timeout: 8000 },
    );
  }, [isOpen, reverseGeocode]);

  const handleMapMoveEnd = useCallback(
    (lat: number, lng: number) => {
      setCenter([lat, lng]);
      if (revGeoTimer.current) clearTimeout(revGeoTimer.current);
      revGeoTimer.current = setTimeout(() => reverseGeocode(lat, lng), 700);
    },
    [reverseGeocode],
  );

  const handleAddressChange = (val: string) => {
    setAddressInput(val);
    setShowSuggestions(true);
    if (fwdGeoTimer.current) clearTimeout(fwdGeoTimer.current);
    if (val.length < 3) { setSuggestions([]); return; }
    fwdGeoTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&accept-language=en`,
          { headers: { "User-Agent": "VivanceTravels/1.0" } },
        );
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {}
    }, 400);
  };

  const pickSuggestion = (s: NominatimItem) => {
    setAddressInput(s.display_name);
    setSuggestions([]);
    setShowSuggestions(false);
    const lat = parseFloat(s.lat);
    const lng = parseFloat(s.lon);
    setCenter([lat, lng]);
    setMoveTarget([lat, lng]);
  };

  const handleSelect = async () => {
    setSelecting(true);
    setSelectError("");
    try {
      // Get structured city name from current center
      const revRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${center[0]}&lon=${center[1]}&format=json&accept-language=en`,
        { headers: { "User-Agent": "VivanceTravels/1.0" } },
      );
      const revData: NominatimItem = await revRes.json();

      const cityName =
        revData.address?.city ||
        revData.address?.town ||
        revData.address?.municipality ||
        revData.address?.state_district ||
        revData.address?.state ||
        "";
      const query = cityName || (revData.display_name || "").split(",")[0].trim();

      // Find hotel destination ID for the city
      const locRes = await fetch(`/api/hotels/locations?query=${encodeURIComponent(query)}&limit=5`);
      const locData = await locRes.json();
      const locations = normalizeHotelLocations(locData);

      if (locations.length === 0) {
        setSelectError(`No hotel destinations found near "${query}". Try dragging the map to a city.`);
        return;
      }

      onSelectLocation({ type: locations[0].type, id: locations[0].id, name: locations[0].name });
    } catch {
      setSelectError("Could not find hotels for this location. Please try again.");
    } finally {
      setSelecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 p-4 md:p-8 flex items-center justify-center">
        <div className="w-full max-w-4xl h-[85vh] rounded-2xl overflow-hidden bg-white shadow-2xl border border-gray-100 flex flex-col">

          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0">
            <div>
              <div className="font-semibold text-gray-900">Search on Map</div>
              <div className="text-xs text-gray-500">Move the map to your destination, then click Select</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
          </div>

          {/* Map */}
          <div className="relative flex-1">

            {/* Geolocation loading overlay */}
            {locating && (
              <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-white/80 pointer-events-none">
                <div className="flex flex-col items-center gap-2 text-sm text-gray-600">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                  <span>Getting your location…</span>
                </div>
              </div>
            )}

            {/* Address + Radius + Select overlay */}
            <div className="absolute top-3 left-3 right-3 z-[1000] flex items-start gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  placeholder="Search for a location…"
                  className="w-full px-4 py-2.5 text-sm rounded-xl bg-white shadow-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-100 shadow-xl max-h-52 overflow-auto z-10">
                    {suggestions.map((s, i) => (
                      <li
                        key={i}
                        onMouseDown={() => pickSuggestion(s)}
                        className="px-4 py-2.5 text-sm text-gray-800 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0"
                      >
                        {s.display_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <select
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="bg-white rounded-xl shadow-lg border border-gray-200 px-3 py-2.5 text-sm font-medium focus:outline-none"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r} KM</option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleSelect}
                disabled={selecting}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg whitespace-nowrap"
              >
                {selecting ? "Searching…" : "Select"}
              </button>
            </div>

            {/* Select error toast */}
            {selectError && (
              <div className="absolute bottom-4 left-4 right-4 z-[1000] bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl shadow-lg">
                {selectError}
              </div>
            )}

            {/* Fixed center pin */}
            <div className="absolute inset-0 z-[999] pointer-events-none flex items-center justify-center">
              <div style={{ marginBottom: "32px" }}>
                <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M16 0C7.163 0 0 7.163 0 16c0 5.088 2.394 9.62 6.133 12.594L16 42l9.867-13.406C29.606 25.62 32 21.088 32 16 32 7.163 24.837 0 16 0z"
                    fill="#DC2626"
                  />
                  <circle cx="16" cy="16" r="7" fill="white" />
                  <circle cx="16" cy="16" r="4" fill="#DC2626" />
                </svg>
              </div>
            </div>

            <MapContainer
              center={INDIA_CENTER}
              zoom={5}
              style={{ height: "100%", width: "100%" }}
              zoomControl
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapCenterTracker onMoveEnd={handleMapMoveEnd} />
              <MoveToTarget target={moveTarget} />
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
