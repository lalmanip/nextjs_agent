"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { flightAPI, paymentAPI } from "@/lib/api";
import { HOTEL_MAX_ADULTS_PER_ROOM, HOTEL_MAX_CHILDREN_PER_ROOM } from "@/Components/hotel-search/types";

function cx(...c: Array<string | false | undefined>) {
  return c.filter(Boolean).join(" ");
}

const TITLES = ["Mr", "Ms", "Mrs", "Mstr"] as const;

type PaxForm = {
  roomIndex: number;
  paxType: 1 | 2; // 1 adult, 2 child
  lead: boolean;
  title: (typeof TITLES)[number];
  firstName: string;
  lastName: string;
  pan: string;
  email?: string;
};

function blankPan(pan: string) {
  return (pan || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function BookingPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const bookingCode = (sp?.get("bookingCode") || "").trim();
  const orderId = (sp?.get("orderId") || "").trim();
  const pgateway = (sp?.get("pgateway") || "").trim();
  const currency = (sp?.get("currency") || "INR").trim();
  const amount = Number((sp?.get("amount") || "0").trim()) || 0;

  const [phone, setPhone] = useState("");
  const [pax, setPax] = useState<PaxForm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);

  const roomsFromStorage = useMemo(() => {
    if (typeof window === "undefined") return [{ adults: 1, children: [] as number[] }];
    try {
      const raw = sessionStorage.getItem("vivance_hotel_rooms");
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch {}
    return [{ adults: 1, children: [] as number[] }];
  }, []);

  useEffect(() => {
    // Build pax form from rooms[] once on mount
    const rooms = Array.isArray(roomsFromStorage) && roomsFromStorage.length
      ? roomsFromStorage
      : [{ adults: 1, children: [] as number[] }];

    const next: PaxForm[] = [];
    rooms.forEach((r: any, roomIndex: number) => {
      const adultCount = Math.max(1, Math.min(HOTEL_MAX_ADULTS_PER_ROOM, Number(r?.adults || 1)));
      const childCount = Array.isArray(r?.children)
        ? Math.min(r.children.length, HOTEL_MAX_CHILDREN_PER_ROOM)
        : Math.max(0, Math.min(HOTEL_MAX_CHILDREN_PER_ROOM, Number(r?.children || 0)));

      for (let i = 0; i < adultCount; i++) {
        next.push({
          roomIndex,
          paxType: 1,
          lead: roomIndex === 0 && i === 0,
          title: "Mr",
          firstName: "",
          lastName: "",
          pan: "",
          email: roomIndex === 0 && i === 0 ? "" : undefined,
        });
      }
      for (let i = 0; i < childCount; i++) {
        next.push({
          roomIndex,
          paxType: 2,
          lead: false,
          title: "Mstr",
          firstName: "",
          lastName: "",
          pan: "",
        });
      }
    });
    setPax(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lead = useMemo(() => pax.find((p) => p.lead) || null, [pax]);

  const canSubmit = useMemo(() => {
    if (!bookingCode || !orderId) return false;
    if (!phone.trim()) return false;
    if (!pax.length) return false;
    for (const p of pax) {
      if (!p.firstName.trim() || !p.lastName.trim()) return false;
      if (blankPan(p.pan).length !== 10) return false;
      if (p.lead && (!p.email || !p.email.trim())) return false;
    }
    return true;
  }, [bookingCode, orderId, phone, pax]);

  const submit = async () => {
    if (!canSubmit) {
      setError("Please fill all passenger details (PAN, name for all; email for lead guest).");
      return;
    }
    setError(null);
    if (!amount || amount <= 0) {
      setError("Booking amount is missing. Please go back and try again.");
      return;
    }

    setPaying(true);
    try {
      const leadName = `${lead?.firstName || ""} ${lead?.lastName || ""}`.trim();
      const leadEmail = (lead?.email || "").trim();

      // 1) Launch Razorpay
      const paymentResponse = await paymentAPI.processRazorpayPayment(
        orderId,
        amount,
        currency,
        { name: leadName || "Guest User", email: leadEmail || "guest@vivancetravels.com", contact: phone }
      );

      // 2) Validate payment with domain token (same flow as flight)
      const domainToken = await flightAPI.getDomainToken();
      const response = paymentResponse as any;
      await flightAPI.validatePayment(
        {
          payId: response.razorpay_payment_id,
          orderId: response.razorpay_order_id,
          signature: response.razorpay_signature,
          pgateway: pgateway || "Razorpay",
        },
        domainToken
      );

      // 3) Persist booking context for next step
      try {
        sessionStorage.setItem(
          "vivance_hotel_booking_context",
          JSON.stringify({
            bookingCode,
            orderId,
            pgateway: pgateway || "Razorpay",
            amount,
            currency,
            rooms: roomsFromStorage,
            passengers: pax.map((p) => ({
              roomIndex: p.roomIndex,
              paxType: p.paxType,
              lead: p.lead,
              title: p.title,
              firstName: p.firstName.trim(),
              lastName: p.lastName.trim(),
              pan: blankPan(p.pan),
              email: p.lead ? (p.email || "").trim() : null,
              phoneno: p.lead ? phone.trim() : null,
            })),
            leadEmail: leadEmail,
            leadPhone: phone.trim(),
            payment: response,
          })
        );
      } catch {}

      router.push("/hotels/book-room");
    } catch (e: any) {
      setError(e instanceof Error ? e.message : "Payment failed. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-sm bg-white">
          <div className="px-6 py-5 bg-gradient-to-r from-[#FC6603] via-[#ff7a1a] to-[#ff8c38] text-white">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-sm font-medium text-white/90 hover:text-white hover:underline"
            >
              ← Back
            </button>
            <div className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight">
              Guest details
            </div>
            <div className="mt-1 text-sm text-white/80">
              Enter passenger information to proceed to booking.
            </div>
          </div>

          <div className="px-6 py-4">
            {(!bookingCode || !orderId) && (
              <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                Missing required booking context (bookingCode/orderId). Please go back and try again.
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Lead guest phone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 15))}
                    placeholder="Phone"
                    className={cx(
                      "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                    )}
                  />
                </div>
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 text-sm text-gray-700">
                  <div className="text-xs text-gray-500">Total guests</div>
                  <div className="mt-1 font-semibold text-gray-900">{pax.length}</div>
                </div>
              </div>

              <div className="space-y-3">
                {pax.map((p, idx) => (
                  <div key={idx} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-gray-900">
                        Room {p.roomIndex + 1} · {p.paxType === 1 ? "Adult" : "Child"}
                        {p.lead ? <span className="ml-2 text-xs font-semibold text-emerald-700">Lead guest</span> : null}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Title</label>
                        <select
                          value={p.title}
                          onChange={(e) => {
                            const v = e.target.value as any;
                            setPax((prev) => prev.map((x, i) => (i === idx ? { ...x, title: v } : x)));
                          }}
                          className={cx(
                            "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm",
                            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                          )}
                        >
                          {TITLES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">PAN</label>
                        <input
                          value={p.pan}
                          onChange={(e) => {
                            const v = blankPan(e.target.value);
                            setPax((prev) => prev.map((x, i) => (i === idx ? { ...x, pan: v } : x)));
                          }}
                          placeholder="AAPPL1234P"
                          className={cx(
                            "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm",
                            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">First name</label>
                        <input
                          value={p.firstName}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPax((prev) => prev.map((x, i) => (i === idx ? { ...x, firstName: v } : x)));
                          }}
                          placeholder="First name"
                          className={cx(
                            "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm",
                            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                          )}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Last name</label>
                        <input
                          value={p.lastName}
                          onChange={(e) => {
                            const v = e.target.value;
                            setPax((prev) => prev.map((x, i) => (i === idx ? { ...x, lastName: v } : x)));
                          }}
                          placeholder="Last name"
                          className={cx(
                            "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm",
                            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                          )}
                        />
                      </div>

                      {p.lead && (
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Email (lead guest only)</label>
                          <input
                            value={p.email || ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setPax((prev) => prev.map((x, i) => (i === idx ? { ...x, email: v } : x)));
                            }}
                            placeholder="you@example.com"
                            className={cx(
                              "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm",
                              "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                            )}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={!bookingCode || !orderId}
                className="rounded-xl bg-[#1e3a5f] px-6 py-3 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {paying ? "Processing payment..." : `Pay ${currency} ${Math.round(amount).toLocaleString()}`}
              </button>
            </div>

            <div className="mt-3 text-[11px] text-gray-400">
              Payment gateway: <span className="font-semibold">{pgateway || "Razorpay"}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

