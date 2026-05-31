"use client";
import { useEffect, useState } from "react";
import { formatFlightCalendarDate } from "@/lib/formatFlightCalendarDate";
import FlightSearchLoadingBackdrop from "@/Components/FlightSearchLoadingBackdrop";

interface Props {
  from: string;
  fromCity: string;
  to: string;
  toCity: string;
  departureDate: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  tripType: string;
}

const TIPS = [
  "Comparing fares across 500+ airlines…",
  "Checking last-minute deals for you…",
  "Finding the fastest routes…",
  "Scanning partner airlines for savings…",
  "Almost there — fetching live prices…",
];

const OG = "#FC6603";

function PlaneIcon({ size = 32, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={OG}
      style={{ opacity }}
      aria-hidden
    >
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}

export default function FlightSearchLoading({
  from,
  fromCity,
  to,
  toCity,
  departureDate,
  returnDate,
  adults,
  children,
  infants,
  tripType,
}: Props) {
  const [tipIndex, setTipIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const tipTimer = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 2000);
    return () => clearInterval(tipTimer);
  }, []);

  useEffect(() => {
    const start = Date.now();
    const duration = 18000;
    const frame = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(90, (elapsed / duration) * 100 * 1.1);
      setProgress(pct);
      if (pct < 90) requestAnimationFrame(frame);
    };
    const raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const fmtDate = (d: string) =>
    formatFlightCalendarDate(d, { day: "2-digit", month: "short", year: "numeric" });

  const paxParts: string[] = [];
  if (adults) paxParts.push(`${adults} Adult${adults > 1 ? "s" : ""}`);
  if (children) paxParts.push(`${children} Child${children > 1 ? "ren" : ""}`);
  if (infants) paxParts.push(`${infants} Infant${infants > 1 ? "s" : ""}`);
  const paxSummary = paxParts.join(", ") || "1 Adult";

  const isRound =
    tripType === "roundtrip" ||
    tripType === "specialreturn" ||
    (tripType === "advance" && Boolean(returnDate));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c1628]">
      <FlightSearchLoadingBackdrop />

      <div className="relative z-10 bg-white rounded-3xl shadow-2xl shadow-black/50 px-8 py-10 w-full max-w-lg mx-4 text-center ring-1 ring-white/20">
        <div className="mb-6">
          <div className="text-2xl font-black text-gray-800 mb-1">Please Wait…</div>
          <div className="text-sm text-gray-500">
            We are looking for all available flights for you
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="text-center flex-1">
            <div className="text-3xl font-black text-gray-800">{from}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-tight">{fromCity}</div>
          </div>

          <div className="flex-1 relative flex items-center">
            <div className="w-full h-px bg-gray-200 relative">
              <div
                className="absolute left-0 top-0 h-px transition-none"
                style={{ width: `${progress}%`, background: OG }}
              />
            </div>
            <div
              className="absolute -top-3.5 transition-none"
              style={{ left: `calc(${progress}% - 14px)`, transform: "rotate(90deg)" }}
            >
              <PlaneIcon size={28} />
            </div>
          </div>

          <div className="text-center flex-1">
            <div className="text-3xl font-black text-gray-800">{to}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-tight">{toCity}</div>
          </div>
        </div>

        {isRound && (
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="text-center flex-1">
              <div className="text-3xl font-black text-gray-800">{to}</div>
            </div>
            <div className="flex-1 relative flex items-center">
              <div className="w-full h-px bg-gray-200 relative">
                <div
                  className="absolute left-0 top-0 h-px transition-none"
                  style={{ width: `${progress}%`, background: OG }}
                />
              </div>
              <div
                className="absolute -top-3.5 transition-none"
                style={{ left: `calc(${progress}% - 14px)`, transform: "rotate(90deg)" }}
              >
                <PlaneIcon size={28} />
              </div>
            </div>
            <div className="text-center flex-1">
              <div className="text-3xl font-black text-gray-800">{from}</div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-gray-600 mb-8">
          <div>
            <span className="font-semibold text-gray-800">Departure:</span> {fmtDate(departureDate)}
          </div>
          {isRound && returnDate && (
            <div>
              <span className="font-semibold text-gray-800">Return:</span> {fmtDate(returnDate)}
            </div>
          )}
          <div>
            <span className="font-semibold text-gray-800">
              Passenger{paxParts.length > 1 ? "s" : ""}:
            </span>{" "}
            {paxSummary}
          </div>
        </div>

        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-2 rounded-full transition-none"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #FC6603, #ff8c38)",
            }}
          />
        </div>

        <div className="h-5 text-xs text-gray-400 font-medium transition-all">
          {TIPS[tipIndex]}
        </div>
      </div>
    </div>
  );
}
