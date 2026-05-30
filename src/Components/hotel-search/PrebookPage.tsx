"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatUserDate } from "@/lib/dateLocale";

type PrebookResponse = any;

function cx(...c: Array<string | false | undefined>) {
  return c.filter(Boolean).join(" ");
}

function safeText(s: any) {
  return typeof s === "string" ? s : "";
}

function formatMoney(currency: string, amount: number) {
  if (!Number.isFinite(amount)) return `${currency} 0`;
  return `${currency} ${Math.round(amount).toLocaleString()}`;
}

function stripHtml(input: string) {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMealType(raw: any) {
  const s = String(raw || "").trim();
  if (!s) return "";
  const normalized = s.replace(/[_\s]+/g, " ").toLowerCase();
  const map: Record<string, string> = {
    "room only": "Room only",
    breakfast: "Breakfast included",
    "break fast": "Breakfast included",
    "half board": "Half board",
    "full board": "Full board",
    "all inclusive": "All inclusive",
  };
  return map[normalized] || normalized.replace(/\b\w/g, (m) => m.toUpperCase());
}

function amenityIcon(label: string) {
  const s = (label || "").toLowerCase();
  if (s.includes("wifi") || s.includes("wi-fi") || s.includes("wireless internet")) return "📶";
  if (s.includes("breakfast") || s.includes("buffet")) return "🥐";
  if (s.includes("parking") || s.includes("valet")) return "🅿️";
  if (s.includes("pool") || s.includes("water park")) return "🏊";
  if (s.includes("gym") || s.includes("fitness")) return "🏋️";
  if (s.includes("spa") || s.includes("massage")) return "💆";
  if (s.includes("airport") || s.includes("shuttle") || s.includes("transfer")) return "🚐";
  if (s.includes("air conditioning") || s.includes("climate control") || s.includes("ac")) return "❄️";
  if (s.includes("restaurant") || s.includes("room service")) return "🍽️";
  if (s.includes("bar")) return "🍸";
  if (s.includes("pet")) return "🐾";
  if (s.includes("wheelchair") || s.includes("accessible")) return "♿";
  if (s.includes("smoking")) return "🚭";
  if (s.includes("tv") || s.includes("television")) return "📺";
  if (s.includes("coffee") || s.includes("tea maker") || s.includes("minibar")) return "☕";
  if (s.includes("bathtub") || s.includes("shower")) return "🛁";
  if (s.includes("balcony") || s.includes("patio") || s.includes("terrace")) return "🌿";
  if (s.includes("safe")) return "🔒";
  return "•";
}

function parseDdMmYyyyDateTime(input: string): Date | null {
  // Example: "22-04-2026 00:00:00"
  const m = String(input || "").match(
    /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/
  );
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const hh = Number(m[4] || 0);
  const mi = Number(m[5] || 0);
  const ss = Number(m[6] || 0);
  const d = new Date(yyyy, mm - 1, dd, hh, mi, ss);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatMonthDay(d: Date) {
  return formatUserDate(d, { month: "short", day: "numeric" });
}

type RefundStage = "full" | "partial" | "none";

function stageLabel(s: RefundStage) {
  if (s === "full") return "Full refund";
  if (s === "partial") return "Partial refund";
  return "No refund";
}

function stageDescription(s: RefundStage) {
  if (s === "full") return "Cancel before this time and you'll get a full refund.";
  if (s === "partial") return "Cancel before this time and you'll get a partial refund.";
  return "After that, you won't get a refund.";
}

function inferStage(policy: any): RefundStage {
  const chargeType = String(policy?.ChargeType || "").toLowerCase();
  const charge = Number(policy?.CancellationCharge ?? NaN);
  if (chargeType === "fixed") {
    if (!Number.isFinite(charge) || charge <= 0) return "full";
    return "partial";
  }
  if (chargeType === "percentage") {
    if (!Number.isFinite(charge)) return "partial";
    if (charge <= 0) return "full";
    if (charge >= 100) return "none";
    return "partial";
  }
  return "partial";
}

function CancellationDetails({
  cancelPolicies,
  checkInIso,
}: {
  cancelPolicies: any[];
  checkInIso?: string;
}) {
  const checkIn = checkInIso ? new Date(`${checkInIso}T00:00:00`) : null;
  const today = new Date();

  const milestones = cancelPolicies
    .map((p) => {
      const d = parseDdMmYyyyDateTime(String(p?.FromDate || ""));
      if (!d) return null;
      return { date: d, stage: inferStage(p) as RefundStage };
    })
    .filter(Boolean) as Array<{ date: Date; stage: RefundStage }>;

  milestones.sort((a, b) => a.date.getTime() - b.date.getTime());

  const unique: Array<{ date: Date; stage: RefundStage }> = [];
  for (const m of milestones) {
    const last = unique[unique.length - 1];
    if (last && formatMonthDay(last.date) === formatMonthDay(m.date)) continue;
    unique.push(m);
  }

  const dots = [
    { label: "Today", date: today },
    ...unique.map((u) => ({ label: formatMonthDay(u.date), date: u.date })),
    ...(checkIn ? [{ label: "Check-in", date: checkIn }] : []),
  ];

  const sections: Array<{ when: string; title: string; desc: string }> = [];
  if (unique.length > 0) {
    const first = unique[0];
    sections.push({
      when: `Before ${formatMonthDay(first.date)}`,
      title: stageLabel(first.stage),
      desc: stageDescription(first.stage),
    });
    if (unique.length > 1) {
      const second = unique[1];
      sections.push({
        when: `Before ${formatMonthDay(second.date)}`,
        title: stageLabel(second.stage),
        desc: stageDescription(second.stage),
      });
    }
    const last = unique[unique.length - 1];
    sections.push({
      when: `After ${formatMonthDay(last.date)}`,
      title: "No refund",
      desc: stageDescription("none"),
    });
  }

  return (
    <div className="mt-4">
      <div className="text-xs font-semibold text-gray-700 mb-2">Cancellation</div>

      <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-4">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
          <span>Full refund</span>
          <span>Partial refund</span>
          <span>No refund</span>
        </div>
        <div className="mt-3 flex items-center">
          {dots.map((d, idx) => {
            const isLast = idx === dots.length - 1;
            return (
              <div key={`${d.label}-${idx}`} className="flex-1 min-w-0">
                <div className="flex items-center">
                  <div className={cx("h-3 w-3 rounded-full border-2 bg-white", idx === 0 ? "border-slate-900" : "border-slate-400")} />
                  {!isLast && <div className="h-[2px] flex-1 bg-slate-300" />}
                </div>
                <div className="mt-2 text-[11px] text-slate-600 font-semibold truncate">{d.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      {sections.length > 0 && (
        <div className="mt-4 space-y-6">
          {sections.map((s, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3 text-xs font-semibold text-gray-500">{s.when}</div>
              <div className="sm:col-span-9">
                <div className="text-sm font-semibold text-gray-900">{s.title}</div>
                <div className="mt-1 text-sm text-gray-600">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PrebookPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const bookingCode = (sp?.get("bookingCode") || "").trim();
  const checkInIso = (sp?.get("checkIn") || "").trim();
  const bookingCodePresent = !!bookingCode;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PrebookResponse | null>(null);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!bookingCode) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/hotels/prebook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ BookingCode: bookingCode, PaymentMode: "Limit" }),
          signal: ac.signal,
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `Prebook failed (${res.status})`);
        }
        setData(await res.json());
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Prebook failed. Please try again.");
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingCode]);

  const hotel = useMemo(() => {
    const hr = data?.data?.HotelResult?.[0];
    return hr || null;
  }, [data]);

  const currency = safeText(hotel?.Currency) || "INR";
  const rooms = Array.isArray(hotel?.Rooms) ? hotel.Rooms : [];
  const rateConditions = Array.isArray(hotel?.RateConditions) ? hotel.RateConditions : [];

  const pageTitle =
    safeText(hotel?.HotelName) ||
    safeText(hotel?.Name) ||
    safeText(hotel?.Rooms?.[0]?.Name?.[0]) ||
    "Your stay details";

  const bestRoom = useMemo(() => {
    if (!rooms.length) return null;
    const sorted = [...rooms].sort((a: any, b: any) => Number(a?.TotalFare || 0) - Number(b?.TotalFare || 0));
    return sorted[0] || null;
  }, [rooms]);

  const selectedRoom = useMemo(() => {
    if (!bookingCode) return null;
    return rooms.find((r: any) => String(r?.BookingCode || "") === bookingCode) || null;
  }, [rooms, bookingCode]);

  const allAmenities = useMemo(() => {
    const set = new Set<string>();
    rooms.forEach((r: any) => {
      const list = Array.isArray(r?.Amenities) ? r.Amenities : [];
      list.forEach((a: any) => {
        if (typeof a === "string" && a.trim()) set.add(a.trim());
      });
    });
    return Array.from(set);
  }, [rooms]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-sm bg-white">
          <div className="px-6 py-5 bg-gradient-to-r from-[#FC6603] via-[#ff7a1a] to-[#ff8c38] text-white">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="text-sm font-medium text-white/90 hover:text-white hover:underline"
                >
                  ← Back to results
                </button>
                <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight truncate">
                  {pageTitle}
                </div>
                <div className="mt-1 text-sm text-white/80">
                  Review inclusions, cancellation, and amenities before booking.
                </div>
              </div>

              <div className="flex-shrink-0 hidden sm:flex items-center justify-center h-12 w-12 rounded-2xl bg-white/10 border border-white/15">
                <span className="text-2xl">🏨</span>
              </div>
            </div>

            {bestRoom && (
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold">
                  {formatMealType(bestRoom?.MealType) || "Meal info"}
                </span>
                <span className={cx(
                  "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold border",
                  bestRoom?.IsRefundable ? "bg-emerald-400/15 border-emerald-300/30 text-emerald-50" : "bg-red-400/15 border-red-300/30 text-red-50"
                )}>
                  {bestRoom?.IsRefundable ? "Refundable" : "Non-refundable"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/10 border border-white/15 px-3 py-1 text-xs font-semibold">
                  From {formatMoney(currency, Number(bestRoom?.TotalFare || 0))}
                </span>
              </div>
            )}
          </div>

          <div className="px-6 py-4">
            {!bookingCode && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                Missing <strong>bookingCode</strong> in URL.
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6 animate-pulse">
            <div className="h-4 w-40 bg-gray-100 rounded" />
            <div className="mt-3 h-3 w-72 bg-gray-100 rounded" />
            <div className="mt-6 space-y-2">
              <div className="h-20 bg-gray-100 rounded-xl" />
              <div className="h-20 bg-gray-100 rounded-xl" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-8 space-y-5">
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Available room options</div>
                      <div className="mt-1 text-sm text-gray-500">
                        Choose the best option based on inclusions and cancellation rules.
                      </div>
                    </div>

                    <div
                      className={cx(
                        "inline-flex rounded-full px-3 py-1 text-xs font-semibold border",
                        data?.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
                      )}
                    >
                      {safeText(data?.data?.Status?.Description) || (data?.success ? "Successful" : "Failed")}
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {rooms.map((r: any) => (
                      <div key={safeText(r?.BookingCode)} className="rounded-2xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900">
                              {Array.isArray(r?.Name) ? r.Name.join(" · ") : "Room"}
                            </div>
                            <div className="mt-1 text-sm text-gray-600">
                              {safeText(r?.Inclusion) || "No inclusions"}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {safeText(r?.MealType) && (
                                <span className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 font-semibold text-slate-700">
                                  {formatMealType(r.MealType)}
                                </span>
                              )}
                              <span
                                className={cx(
                                  "rounded-full px-2.5 py-1 border font-semibold",
                                  r?.IsRefundable
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-red-200 bg-red-50 text-red-700"
                                )}
                              >
                                {r?.IsRefundable ? "Refundable" : "Non-refundable"}
                              </span>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <div className="text-xs text-gray-500">Total</div>
                            <div className="text-2xl font-extrabold text-gray-900">
                              {formatMoney(currency, Number(r?.TotalFare || 0))}
                            </div>
                          </div>
                        </div>

                        {Array.isArray(r?.CancelPolicies) && r.CancelPolicies.length > 0 && (
                          <CancellationDetails cancelPolicies={r.CancelPolicies} checkInIso={checkInIso} />
                        )}

                        {Array.isArray(r?.Amenities) && r.Amenities.length > 0 && (
                          <div className="mt-4">
                            <div className="text-xs font-semibold text-gray-700 mb-2">Room amenities</div>
                            <div className="flex flex-wrap gap-2">
                              {r.Amenities.slice(0, 16).map((a: string, idx: number) => (
                                <span
                                  key={`${a}-${idx}`}
                                  className="rounded-full bg-white border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700"
                                >
                                  <span className="mr-1">{amenityIcon(a)}</span>
                                  {a}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {rateConditions.length > 0 && (
                  <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                    <div className="text-sm font-semibold text-gray-900">Rate conditions</div>
                    <div className="mt-1 text-sm text-gray-500">
                      Important policy and check-in information.
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-gray-700">
                      {rateConditions.slice(0, 25).map((c: string, idx: number) => (
                        <li key={idx} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#1e3a5f] flex-shrink-0" />
                          <span>{stripHtml(String(c))}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="lg:col-span-4 space-y-5">
                <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5 lg:sticky lg:top-6">
                  <div className="text-sm font-semibold text-gray-900">Amenities highlights</div>
                  <div className="mt-1 text-sm text-gray-500">
                    Based on the selected prebook room data.
                  </div>

                  {allAmenities.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {allAmenities.slice(0, 28).map((a, idx) => (
                        <span
                          key={`${a}-${idx}`}
                          className="rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700"
                        >
                          <span className="mr-1">{amenityIcon(a)}</span>
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 text-sm text-gray-500">No amenities provided.</div>
                  )}

                  <button
                    type="button"
                    className="mt-5 w-full rounded-xl bg-[#1e3a5f] px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
                    disabled={creatingOrder || !bookingCode}
                    onClick={async () => {
                      if (!bookingCode) return;
                      setCreatingOrder(true);
                      setError(null);
                      try {
                        // Mirror flight flow: get domain token then call order-id-creation with Authorization header.
                        const tokenRes = await fetch("/api/flight/token", { method: "POST" });
                        if (!tokenRes.ok) {
                          const txt = await tokenRes.text().catch(() => "");
                          throw new Error(txt || `Token fetch failed (${tokenRes.status})`);
                        }
                        const tokenJson = await tokenRes.json();
                        const token = String(tokenJson?.Token ?? tokenJson?.token ?? "").trim();
                        if (!token) throw new Error("Auth token not returned");

                        const res = await fetch(
                          `/api/hotels/order?resultToken=${encodeURIComponent(
                            bookingCode
                          )}&module=HOTEL`,
                          {
                            method: "GET",
                            headers: { Authorization: `Bearer ${token}` },
                          }
                        );
                        if (!res.ok) {
                          const txt = await res.text().catch(() => "");
                          throw new Error(txt || `Order creation failed (${res.status})`);
                        }
                        const json = await res.json();
                        const orderId = String(json?.pgatewayOrderId || "");
                        const pgateway = String(json?.pgateway || "Razorpay");
                        if (!orderId) throw new Error("Order ID was not returned");
                        const amount = Number(selectedRoom?.TotalFare || bestRoom?.TotalFare || 0);
                        router.push(
                          `/hotels/booking?bookingCode=${encodeURIComponent(
                            bookingCode
                          )}&orderId=${encodeURIComponent(orderId)}&pgateway=${encodeURIComponent(
                            pgateway
                          )}&amount=${encodeURIComponent(String(amount))}&currency=${encodeURIComponent(currency)}`
                        );
                      } catch (e: any) {
                        setError(e instanceof Error ? e.message : "Failed to create payment order.");
                      } finally {
                        setCreatingOrder(false);
                      }
                    }}
                  >
                    {creatingOrder ? "Preparing payment..." : "Continue to booking"}
                  </button>

                  <div className="mt-3 text-[11px] text-gray-400">
                    You can review room inclusions and cancellation before confirming.
                  </div>

                  {!bookingCodePresent && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Missing booking context. Please go back and click <strong>See availability</strong> again.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

