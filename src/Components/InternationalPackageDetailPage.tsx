"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { PackageTab, TourPackageDetail } from "@/lib/holidayPackages";
import PackageDetailsPanel from "@/Components/PackageDetailsPanel";
import PackageItineraryAccordion from "@/Components/PackageItineraryAccordion";
import { destinationListingTitle } from "@/lib/holidaysApi";
import {
  buildHolidayQuotationMessage,
  departureCityLabel,
  HOLIDAY_ENQUIRY_PURPOSE,
  type HolidayRoomPax,
} from "@/lib/holidayQuotationEnquiry";
import { toIsoDateLocal } from "@/lib/passengerDobRules";
import { validateEmail, validateName, validatePhone } from "@/utils/validation";

const TABS: { id: PackageTab; label: string }[] = [
  { id: "itinerary", label: "Itinerary" },
  { id: "details", label: "Package Details" },
  { id: "price", label: "Calculate Price" },
  { id: "terms", label: "Terms & Conditions" },
];

const MAX_ROOMS = 4;
const MAX_ADULTS_PER_ROOM = 4;
const MAX_CHILDREN_PER_ROOM = 3;
const MAX_INFANTS_PER_ROOM = 2;

type RoomPax = HolidayRoomPax;

function defaultRoom(): RoomPax {
  return { adults: 2, childWithBed: 0, childWithoutBed: 0, infants: 0 };
}

function formatPrice(amount: number) {
  return `₹ ${amount.toLocaleString("en-IN")}`;
}

function PaxCounter({
  label,
  ageHint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  ageHint: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const canDec = value > min;
  const canInc = value < max;

  return (
    <div className="min-w-[7.5rem] flex-1 text-center">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <div className="mx-auto mt-2 inline-flex items-center rounded-full border border-gray-200 bg-white px-1 py-1 shadow-sm">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={!canDec}
          onClick={() => onChange(value - 1)}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold transition ${
            canDec
              ? "text-primary hover:bg-orange-50"
              : "cursor-not-allowed text-gray-300"
          }`}
        >
          −
        </button>
        <span className="w-8 text-center text-sm font-semibold text-gray-900">{value}</span>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={!canInc}
          onClick={() => onChange(value + 1)}
          className={`flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold transition ${
            canInc
              ? "text-primary hover:bg-orange-50"
              : "cursor-not-allowed text-gray-300"
          }`}
        >
          +
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">{ageHint}</p>
    </div>
  );
}

function summarizePax(rooms: RoomPax[]) {
  return rooms.reduce(
    (acc, r) => ({
      adults: acc.adults + r.adults,
      childWithBed: acc.childWithBed + r.childWithBed,
      childWithoutBed: acc.childWithoutBed + r.childWithoutBed,
      infants: acc.infants + r.infants,
    }),
    { adults: 0, childWithBed: 0, childWithoutBed: 0, infants: 0 },
  );
}

function payingTravellerCount(rooms: RoomPax[]) {
  const s = summarizePax(rooms);
  return s.adults + s.childWithBed + s.childWithoutBed;
}

export default function InternationalPackageDetailPage({
  pkg,
}: {
  pkg: TourPackageDetail;
}) {
  const [activeTab, setActiveTab] = useState<PackageTab>("itinerary");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [rooms, setRooms] = useState<RoomPax[]>(() => [defaultRoom()]);
  const [travelDate, setTravelDate] = useState("");
  const [departureCity, setDepartureCity] = useState("");
  const [tourType, setTourType] = useState("Standard");
  const [formError, setFormError] = useState<string | null>(null);
  const [quotationLoading, setQuotationLoading] = useState(false);
  const [quotationSuccess, setQuotationSuccess] = useState<string | null>(null);
  const minTravelDate = useMemo(() => toIsoDateLocal(new Date()), []);

  const paxSummary = useMemo(() => summarizePax(rooms), [rooms]);
  const payingCount = useMemo(() => payingTravellerCount(rooms), [rooms]);
  const estimatedTotal = pkg.price * payingCount;

  const updateRoom = (roomIdx: number, patch: Partial<RoomPax>) => {
    setRooms((prev) =>
      prev.map((r, i) => (i === roomIdx ? { ...r, ...patch } : r)),
    );
    setFormError(null);
  };

  const addRoom = () => {
    if (rooms.length >= MAX_ROOMS) return;
    setRooms((prev) => [...prev, defaultRoom()]);
    setFormError(null);
  };

  const validatePriceForm = (): string | null => {
    const nameErr = validateName(contactName, "Name");
    if (nameErr) return nameErr;
    const emailErr = validateEmail(contactEmail);
    if (emailErr) return emailErr;
    const phoneErr = validatePhone(contactPhone);
    if (phoneErr) return phoneErr;
    if (!departureCity.trim()) return "Please select a departure city.";
    if (!travelDate.trim()) return "Please select a date of travel.";
    if (travelDate < minTravelDate) return "Date of travel cannot be in the past.";
    if (payingCount < 1) return "Please add at least one adult per room.";
    for (let i = 0; i < rooms.length; i++) {
      if (rooms[i].adults < 1) {
        return `Room ${i + 1}: at least one adult is required.`;
      }
    }
    return null;
  };

  const handleCalculatePrice = () => {
    const err = validatePriceForm();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
  };

  const handleSendQuotation = async () => {
    const err = validatePriceForm();
    if (err) {
      setFormError(err);
      setQuotationSuccess(null);
      return;
    }

    setFormError(null);
    setQuotationSuccess(null);
    setQuotationLoading(true);

    const message = buildHolidayQuotationMessage({
      pkg,
      travelDate,
      tourType,
      rooms,
      estimatedTotal,
      payingTravellerCount: payingCount,
    });

    try {
      const res = await fetch("/api/b2c-enquiry/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName.trim(),
          email: contactEmail.trim(),
          phone: contactPhone.trim(),
          place: departureCityLabel(departureCity),
          purpose: HOLIDAY_ENQUIRY_PURPOSE,
          message,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const apiErrors = Array.isArray(data?.errors) ? data.errors : [];
        if (apiErrors.length > 0) {
          setFormError(String(apiErrors[0]?.message || "Validation failed."));
        } else {
          setFormError(
            String(data?.error || data?.message || "Could not send quotation. Please try again."),
          );
        }
        return;
      }

      const enquiryId = data?.response?.id;
      setQuotationSuccess(
        enquiryId != null
          ? `Quotation request sent successfully (Ref #${enquiryId}). We will contact you shortly.`
          : String(data?.message || "Quotation request sent successfully. We will contact you shortly."),
      );
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      setQuotationLoading(false);
    }
  };

  const tourTotalLabel = (() => {
    const parts: string[] = [];
    if (paxSummary.adults) {
      parts.push(`${paxSummary.adults} adult${paxSummary.adults > 1 ? "s" : ""}`);
    }
    const children = paxSummary.childWithBed + paxSummary.childWithoutBed;
    if (children) parts.push(`${children} child${children > 1 ? "ren" : ""}`);
    if (paxSummary.infants) {
      parts.push(`${paxSummary.infants} infant${paxSummary.infants > 1 ? "s" : ""}`);
    }
    const base = parts.length ? parts.join(", ") : "0 travellers";
    return `${base} · ${rooms.length} room${rooms.length > 1 ? "s" : ""}`;
  })();

  return (
    <main className="min-h-screen bg-gray-50">
      <section
        className="relative bg-cover bg-center"
        style={{ backgroundImage: `url('${pkg.image}')` }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 text-white">
          <p className="text-sm text-white/80">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            {" > "}
            <Link
              href="/holiday-partners"
              className="hover:underline"
            >
              Holiday Partners
            </Link>
            {" > "}
            <Link
              href={`/international-tour-packages/${pkg.destinationSlug}`}
              className="hover:underline"
            >
              {destinationListingTitle(pkg.destinationName)}
            </Link>
            {" > "}
            <span>{pkg.title}</span>
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {pkg.badge && (
              <span className="rounded bg-red-500 px-2 py-1 text-xs font-semibold">
                {pkg.badge}
              </span>
            )}
            <span className="rounded bg-black/40 px-2 py-1 text-sm">
              {pkg.rating} ★ ({pkg.comments} reviews)
            </span>
            <span className="text-sm">
              {pkg.nights} Nights / {pkg.days} Days
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{pkg.title}</h1>
          <p className="mt-2 text-2xl font-bold text-primary">
            {formatPrice(pkg.price)}{" "}
            <span className="text-base font-normal text-white/80">
              per person
            </span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {pkg.inclusions.map((item) => (
              <span
                key={item}
                className="rounded-full bg-white/15 px-3 py-1 text-xs"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="sticky top-16 z-20 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 border-b-2 px-4 py-4 text-sm font-semibold transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "itinerary" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Itinerary</h2>
            <PackageItineraryAccordion
              days={pkg.itinerary}
              fallbackImage={pkg.image}
            />
          </div>
        )}

        {activeTab === "details" && (
          <PackageDetailsPanel details={pkg.details} />
        )}

        {activeTab === "price" && (
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-bold text-gray-900">Your details</h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => {
                        setContactName(e.target.value);
                        setFormError(null);
                      }}
                      autoComplete="name"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => {
                        setContactEmail(e.target.value);
                        setFormError(null);
                      }}
                      autoComplete="email"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => {
                        setContactPhone(e.target.value);
                        setFormError(null);
                      }}
                      autoComplete="tel"
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="10-digit mobile"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <h2 className="text-xl font-bold text-gray-900">
                  Calculate Price
                </h2>
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Departure City <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={departureCity}
                      onChange={(e) => {
                        setDepartureCity(e.target.value);
                        setFormError(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="">Please Select</option>
                      <option value="mumbai">Mumbai</option>
                      <option value="delhi">Delhi</option>
                      <option value="bengaluru">Bengaluru</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Date of Travel <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={travelDate}
                      min={minTravelDate}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next && next < minTravelDate) return;
                        setTravelDate(next);
                        setFormError(null);
                      }}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tour Type
                    </label>
                    <select
                      value={tourType}
                      onChange={(e) => setTourType(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option>Standard</option>
                      <option>Value</option>
                      <option>Premium</option>
                    </select>
                  </div>
                </div>

                <div className="mt-8 border-t border-dashed border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-gray-900">Traveller Details</h3>
                  <div className="mt-4 space-y-6">
                    {rooms.map((room, roomIdx) => (
                      <div
                        key={roomIdx}
                        className="flex flex-col gap-4 border-b border-gray-100 pb-6 last:border-0 last:pb-0 lg:flex-row lg:items-start"
                      >
                        <div className="shrink-0 lg:w-24">
                          <p className="text-sm font-semibold text-gray-800">
                            Room {roomIdx + 1}
                          </p>
                          {roomIdx === rooms.length - 1 && rooms.length < MAX_ROOMS && (
                            <button
                              type="button"
                              onClick={addRoom}
                              className="mt-2 text-sm font-medium text-primary underline hover:text-primary-dark"
                            >
                              Add Room
                            </button>
                          )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-wrap justify-start gap-3 sm:gap-4">
                          <PaxCounter
                            label="Adult"
                            ageHint="(12+ yrs)"
                            value={room.adults}
                            min={1}
                            max={MAX_ADULTS_PER_ROOM}
                            onChange={(n) => updateRoom(roomIdx, { adults: n })}
                          />
                          <PaxCounter
                            label="Child(With bed)"
                            ageHint="(Below 12 yrs)"
                            value={room.childWithBed}
                            min={0}
                            max={MAX_CHILDREN_PER_ROOM}
                            onChange={(n) => updateRoom(roomIdx, { childWithBed: n })}
                          />
                          <PaxCounter
                            label="Child(Without bed)"
                            ageHint="(Below 12 yrs)"
                            value={room.childWithoutBed}
                            min={0}
                            max={MAX_CHILDREN_PER_ROOM}
                            onChange={(n) =>
                              updateRoom(roomIdx, { childWithoutBed: n })
                            }
                          />
                          <PaxCounter
                            label="Infant"
                            ageHint="(0-2 yrs)"
                            value={room.infants}
                            min={0}
                            max={MAX_INFANTS_PER_ROOM}
                            onChange={(n) => updateRoom(roomIdx, { infants: n })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {formError && (
                  <p className="mt-4 text-sm text-red-600" role="alert">
                    {formError}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleCalculatePrice}
                  className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark sm:w-auto sm:px-8"
                >
                  Calculate Package Price
                </button>
              </div>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5 h-fit">
              <h3 className="text-lg font-bold text-gray-900">Total Price</h3>
              <div className="mt-4 space-y-2 text-sm text-gray-600">
                <div className="flex justify-between gap-4">
                  <span className="text-left">Tour total ({tourTotalLabel})</span>
                  <span className="shrink-0">{formatPrice(estimatedTotal)}</span>
                </div>
                {paxSummary.infants > 0 && (
                  <p className="text-xs text-gray-500">
                    Infants are not included in the estimated per-person total.
                  </p>
                )}
                <div className="flex justify-between border-t border-gray-100 pt-2 font-bold text-gray-900">
                  <span>Estimated total</span>
                  <span className="text-primary">{formatPrice(estimatedTotal)}</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-500">
                Final price may vary based on travel date, flight selection, and
                hotel availability.
              </p>
              {quotationSuccess && (
                <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" role="status">
                  {quotationSuccess}
                </p>
              )}
              <button
                type="button"
                onClick={handleSendQuotation}
                disabled={quotationLoading}
                className="mt-4 w-full rounded-lg border-2 border-primary py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {quotationLoading ? "Sending…" : "Send Quotation"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "terms" && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <h2 className="text-xl font-bold text-gray-900">
              Terms & Conditions
            </h2>
            <ul className="mt-4 list-inside list-decimal space-y-3 text-sm text-gray-700">
              {pkg.terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}
