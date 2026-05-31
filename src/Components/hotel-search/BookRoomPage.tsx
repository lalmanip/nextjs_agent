"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function cx(...c: Array<string | false | undefined>) {
  return c.filter(Boolean).join(" ");
}

function normalizeTitle(title: string) {
  const t = (title || "").trim();
  if (!t) return "Mr.";
  if (t.endsWith(".")) return t;
  return `${t}.`;
}

function safeText(v: any) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

function blankPan(pan: string) {
  return (pan || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
}

export function BookRoomPage() {
  const router = useRouter();
  const [ctx, setCtx] = useState<any>(null);
  const [clientRefId, setClientRefId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("vivance_hotel_booking_context");
      setCtx(raw ? JSON.parse(raw) : null);
    } catch {
      setCtx(null);
    }
  }, []);

  useEffect(() => {
    if (!clientRefId) {
      setClientRefId(`VIVHTL-${Date.now()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ctx) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-gray-100 bg-white shadow-sm p-6 text-center">
          <div className="text-4xl">🏨</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">Booking context missing</div>
          <div className="mt-1 text-sm text-gray-500">
            Please go back and complete payment again.
          </div>
          <button
            type="button"
            onClick={() => router.push("/hotels")}
            className="mt-5 w-full rounded-xl bg-[#1e3a5f] px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
          >
            Back to hotel search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        <div className="rounded-3xl overflow-hidden border border-slate-100 shadow-sm bg-white">
          <div className="px-6 py-5 bg-gradient-to-r from-[#FC6603] via-[#ff7a1a] to-[#ff8c38] text-white">
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Book room
            </div>
            <div className="mt-1 text-sm text-white/80">
              Payment validated. Next: call hotel booking API and confirm reservation.
            </div>
          </div>

          <div className="px-6 py-5">
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
              <div className="font-semibold text-gray-900">Captured details</div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Lead guest:</span>{" "}
                  {safeText(ctx?.passengers?.find((p: any) => p?.lead)?.title)}{" "}
                  {safeText(ctx?.passengers?.find((p: any) => p?.lead)?.firstName)}{" "}
                  {safeText(ctx?.passengers?.find((p: any) => p?.lead)?.lastName)}
                </div>
                <div><span className="text-gray-500">Email:</span> {safeText(ctx?.leadEmail)}</div>
                <div><span className="text-gray-500">Phone:</span> {safeText(ctx?.leadPhone)}</div>
                <div><span className="text-gray-500">Amount:</span> {ctx?.currency} {Math.round(ctx?.amount || 0).toLocaleString()}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Client reference id</label>
                <input
                  value={clientRefId}
                  onChange={(e) => setClientRefId(e.target.value)}
                  placeholder="abcde12345"
                  className={cx(
                    "w-full rounded-xl border border-gray-200 bg-white px-3 py-3 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40"
                  )}
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="button"
              className="mt-5 w-full rounded-xl bg-[#1e3a5f] px-5 py-3 text-sm font-semibold text-white hover:opacity-95"
              disabled={loading}
              onClick={async () => {
                setError(null);
                setResult(null);

                const bookingCode = String(ctx?.bookingCode || "").trim();
                const netAmount = Number(ctx?.amount || 0);
                const passengers = Array.isArray(ctx?.passengers) ? ctx.passengers : [];
                if (!bookingCode) {
                  setError("Missing BookingCode. Please go back and complete flow again.");
                  return;
                }
                if (!netAmount || netAmount <= 0) {
                  setError("Missing NetAmount. Please go back and complete flow again.");
                  return;
                }
                if (!passengers.length) {
                  setError("Passenger details missing. Please go back and fill guest details again.");
                  return;
                }
                const lead = passengers.find((p: any) => p?.lead);
                if (!lead || !safeText(lead?.email)) {
                  setError("Lead guest email is required.");
                  return;
                }
                for (const p of passengers) {
                  if (!safeText(p?.firstName) || !safeText(p?.lastName)) {
                    setError("Please ensure first/last name is filled for all guests.");
                    return;
                  }
                  if (blankPan(p?.pan).length !== 10) {
                    setError("Please ensure PAN is filled (10 chars) for all guests.");
                    return;
                  }
                }

                const endUserIp = "192.168.9.119";
                const guestNationality = "IN";

                const roomsCount = Math.max(
                  1,
                  passengers.reduce((m: number, p: any) => Math.max(m, Number(p?.roomIndex ?? 0) + 1), 1)
                );
                const hotelRoomsDetails = Array.from({ length: roomsCount }, (_, roomIndex) => {
                  const roomPax = passengers.filter((p: any) => Number(p?.roomIndex ?? 0) === roomIndex);
                  return {
                    HotelPassenger: roomPax.map((p: any) => ({
                      Title: normalizeTitle(safeText(p?.title || "Mr")),
                      FirstName: safeText(p?.firstName).trim(),
                      MiddleName: "",
                      LastName: safeText(p?.lastName).trim(),
                      Email: p?.lead ? safeText(p?.email).trim() || null : null,
                      PaxType: Number(p?.paxType || 1),
                      LeadPassenger: !!p?.lead,
                      Age: Number(p?.paxType) === 2 ? 8 : 30,
                      PassportNo: null,
                      PassportIssueDate: null,
                      PassportExpDate: null,
                      Phoneno: p?.lead ? safeText(ctx?.leadPhone).trim() || null : null,
                      PaxId: 0,
                      GSTCompanyAddress: null,
                      GSTCompanyContactNumber: null,
                      GSTCompanyName: null,
                      GSTNumber: null,
                      GSTCompanyEmail: null,
                      PAN: blankPan(safeText(p?.pan)),
                    })),
                  };
                });

                const bookPayload = {
                  BookingCode: bookingCode,
                  IsVoucherBooking: true,
                  GuestNationality: guestNationality,
                  EndUserIp: endUserIp,
                  RequestedBookingMode: 5,
                  NetAmount: netAmount,
                  ClientReferenceId: clientRefId || `VIVHTL-${Date.now()}`,
                  HotelRoomsDetails: hotelRoomsDetails,
                };

                setLoading(true);
                try {
                  const bookRes = await fetch("/api/hotels/book", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(bookPayload),
                  });
                  if (!bookRes.ok) {
                    const txt = await bookRes.text().catch(() => "");
                    throw new Error(txt || `Book API failed (${bookRes.status})`);
                  }
                  const bookJson = await bookRes.json();
                  const bookResult = bookJson?.data?.BookResult;
                  const bookingId = Number(bookResult?.BookingId);
                  const traceId = String(bookResult?.TraceId || "").trim();
                  if (!bookingId || !traceId) {
                    throw new Error("Book API did not return BookingId/TraceId.");
                  }

                  const detailsPayload = { EndUserIp: endUserIp, TraceId: traceId, BookingId: bookingId };
                  const detRes = await fetch("/api/hotels/getbookingdetails", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(detailsPayload),
                  });
                  if (!detRes.ok) {
                    const txt = await detRes.text().catch(() => "");
                    throw new Error(txt || `GetBookingDetails failed (${detRes.status})`);
                  }
                  const detJson = await detRes.json();
                  setResult({ book: bookJson, details: detJson });
                } catch (e: any) {
                  setError(e instanceof Error ? e.message : "Booking failed. Please try again.");
                } finally {
                  setLoading(false);
                }
              }}
            >
              {loading ? "Confirming..." : "Confirm booking"}
            </button>

            {result?.details?.data?.GetBookingDetailResult && (
              <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="text-sm font-semibold text-emerald-900">Booking confirmed</div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-emerald-900/90">
                  <div><span className="text-emerald-800/70">Hotel:</span> {result.details.data.GetBookingDetailResult.HotelName}</div>
                  <div><span className="text-emerald-800/70">Status:</span> {result.details.data.GetBookingDetailResult.HotelBookingStatus}</div>
                  <div><span className="text-emerald-800/70">Confirmation:</span> {result.details.data.GetBookingDetailResult.ConfirmationNo}</div>
                  <div><span className="text-emerald-800/70">Booking ID:</span> {result.details.data.GetBookingDetailResult.BookingId}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

