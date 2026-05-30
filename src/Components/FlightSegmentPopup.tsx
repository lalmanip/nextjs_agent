"use client";
import { useState, useRef, useLayoutEffect, useEffect, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { formatUserDate } from "@/lib/dateLocale";
import {
  formatCabinClassLabel,
  formatTerminalLabel,
  readTerminalFromEndpoint,
} from "@/lib/flightDisplay";

interface Props {
  segment: any[]; // array of stops for this leg
  departureCity?: string;
  arrivalCity?: string;
}

const fmt = (dt: string) =>
  dt ? new Date(dt.replace(" ", "T")).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

const fmtDate = (dt: string) =>
  dt
    ? formatUserDate(dt.replace(" ", "T"), {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";

const diffMinutes = (a: string, b: string) => {
  const ms = new Date(b.replace(" ", "T")).getTime() - new Date(a.replace(" ", "T")).getTime();
  return Math.round(ms / 60000);
};

const fmtDuration = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

const segDuration = (stop: any) => {
  const dep = stop?.Origin?.DateTime || stop?.origin?.dateTime || "";
  const arr = stop?.Destination?.DateTime || stop?.destination?.dateTime || "";
  if (!dep || !arr) return "";
  const mins = diffMinutes(dep, arr);
  return mins > 0 ? fmtDuration(mins) : "";
};

const POPUP_W = 320;
const VIEW_MARGIN = 8;
const GAP = 8;
const LEAVE_MS = 200;
const POPUP_Z = 10050;

export default function FlightSegmentPopup({ segment, departureCity, arrivalCity }: Props) {
  const [visible, setVisible] = useState(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({
    position: "fixed",
    top: -9999,
    left: -9999,
    zIndex: POPUP_Z,
  });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLeaveTimer = () => {
    if (leaveTimerRef.current != null) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const openPopup = () => {
    clearLeaveTimer();
    setVisible(true);
  };

  const scheduleClose = () => {
    clearLeaveTimer();
    leaveTimerRef.current = setTimeout(() => setVisible(false), LEAVE_MS);
  };

  useEffect(() => () => clearLeaveTimer(), []);

  useLayoutEffect(() => {
    if (!visible || !btnRef.current || !popupRef.current) return;

    const position = () => {
      const btn = btnRef.current!.getBoundingClientRect();
      const popupEl = popupRef.current!;
      let popupH = Math.max(popupEl.offsetHeight, popupEl.getBoundingClientRect().height);
      if (popupH < 24) return;

      let top = btn.bottom + GAP;
      if (top + popupH + VIEW_MARGIN > window.innerHeight) {
        top = btn.top - popupH - GAP;
      }
      top = Math.max(VIEW_MARGIN, Math.min(top, window.innerHeight - popupH - VIEW_MARGIN));

      const left = Math.max(
        VIEW_MARGIN,
        Math.min(window.innerWidth - POPUP_W - VIEW_MARGIN, btn.left + btn.width / 2 - POPUP_W / 2),
      );

      setPopupStyle({ position: "fixed", top, left, zIndex: POPUP_Z, minWidth: POPUP_W });
    };

    position();
    const raf = requestAnimationFrame(() => position());
    return () => cancelAnimationFrame(raf);
  }, [visible, segment]);

  if (!segment?.length) return null;

  const firstStop = segment[0];
  const lastStop = segment[segment.length - 1];
  const origin = firstStop?.Origin || firstStop?.origin;
  const dest = lastStop?.Destination || lastStop?.destination;
  const depCity = departureCity || origin?.CityName || origin?.cityName || origin?.AirportCode || origin?.airportCode || "";
  const arrCity = arrivalCity || dest?.CityName || dest?.cityName || dest?.AirportCode || dest?.airportCode || "";
  const depDate = fmtDate(origin?.DateTime || origin?.dateTime || "");

  const popupInner = (
    <div
      ref={popupRef}
      style={popupStyle}
      className="bg-white rounded-xl shadow-2xl border border-gray-100 w-80 text-left pointer-events-auto"
      onMouseEnter={openPopup}
      onMouseLeave={scheduleClose}
    >
      <div className="px-4 py-3 border-b border-gray-100 bg-orange-50 rounded-t-xl">
        <div className="font-bold text-gray-800 text-sm">
          {depCity} → {arrCity}
        </div>
        {depDate && <div className="text-xs text-gray-500 mt-0.5">{depDate}</div>}
      </div>

      <div className="p-3 space-y-3 max-h-80 overflow-y-auto">
        {segment.map((stop: any, i: number) => {
          const org = stop?.Origin || stop?.origin;
          const dst = stop?.Destination || stop?.destination;
          const orgTerminal = readTerminalFromEndpoint(org);
          const dstTerminal = readTerminalFromEndpoint(dst);
          const flightNum = stop?.FlightNumber || stop?.flightNumber || "";
          const operatorCode = stop?.OperatorCode || stop?.operatorCode || "";
          const airline = stop?.airline ?? stop?.Airline;
          const fareClass =
            stop?.FareClass ||
            stop?.fareClass ||
            (airline && typeof airline === "object"
              ? (airline as Record<string, unknown>).fareClass ||
                (airline as Record<string, unknown>).FareClass
              : "") ||
            stop?.Attr?.fareClass ||
            stop?.attr?.fareClass ||
            "";
          const craftType = stop?.CraftType || stop?.craftType || stop?.AircraftType || stop?.aircraftType || "";
          const cabinClass =
            formatCabinClassLabel(stop?.cabinClass ?? stop?.CabinClass) ||
            stop?.FareClassType ||
            stop?.fareClassType ||
            formatCabinClassLabel(stop?.Attr?.CabinClass ?? stop?.attr?.cabinClass) ||
            null;
          const duration = segDuration(stop);

          const prevStop = i > 0 ? segment[i - 1] : null;
          const prevDst = prevStop?.Destination || prevStop?.destination;
          const layoverMins =
            prevDst && org
              ? diffMinutes(prevDst?.DateTime || prevDst?.dateTime || "", org?.DateTime || org?.dateTime || "")
              : 0;
          const layoverCity = prevDst?.CityName || prevDst?.cityName || prevDst?.AirportCode || prevDst?.airportCode || "";

          return (
            <div key={i}>
              {i > 0 && layoverMins > 0 && (
                <div className="flex items-center gap-2 my-2 text-[11px] text-amber-700 font-medium">
                  <div className="flex-1 border-t border-dashed border-amber-300" />
                  <span>
                    Layover {fmtDuration(layoverMins)} in {layoverCity}
                  </span>
                  <div className="flex-1 border-t border-dashed border-amber-300" />
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <img
                    src={`/airlines/${operatorCode}.gif`}
                    alt={operatorCode}
                    className="w-6 h-6 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <span className="font-bold text-sm text-gray-800">{flightNum}</span>
                  {fareClass && (
                    <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded">{fareClass}</span>
                  )}
                  {craftType && <span className="text-[11px] text-gray-500 ml-auto">Craft: {craftType}</span>}
                </div>

                <div className="flex items-center gap-2">
                  <div className="text-center">
                    <div className="text-base font-black text-gray-800">{fmt(org?.DateTime || org?.dateTime || "")}</div>
                    <div className="text-xs font-semibold text-gray-600">({org?.AirportCode || org?.airportCode})</div>
                    {orgTerminal && (
                      <div className="text-[10px] text-gray-400">{formatTerminalLabel(orgTerminal)}</div>
                    )}
                  </div>

                  <div className="flex-1 flex flex-col items-center">
                    {duration && <div className="text-[10px] text-gray-500 font-medium">{duration}</div>}
                    <div className="flex items-center gap-1 w-full my-0.5">
                      <div className="flex-1 h-px bg-gray-300" />
                      <svg viewBox="0 0 24 24" className="w-3 h-3 flex-shrink-0" fill="#FC6603" style={{ transform: "rotate(90deg)" }}>
                        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
                      </svg>
                      <div className="flex-1 h-px bg-gray-300" />
                    </div>
                    {cabinClass ? (
                      <div className="text-[10px] text-gray-400">{cabinClass}</div>
                    ) : null}
                  </div>

                  <div className="text-center">
                    <div className="text-base font-black text-gray-800">{fmt(dst?.DateTime || dst?.dateTime || "")}</div>
                    <div className="text-xs font-semibold text-gray-600">({dst?.AirportCode || dst?.airportCode})</div>
                    {dstTerminal && (
                      <div className="text-[10px] text-gray-400">{formatTerminalLabel(dstTerminal)}</div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] text-gray-400 mt-1 text-center">{fmtDate(org?.DateTime || org?.dateTime || "")}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={openPopup}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={btnRef}
        type="button"
        className="relative z-10 flex items-center justify-center w-7 h-7 rounded-full bg-orange-50 border border-orange-200 hover:bg-orange-100 hover:border-primary transition-colors shadow-sm"
        title="View flight details"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#FC6603" style={{ transform: "rotate(90deg)" }}>
          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
        </svg>
      </button>

      {visible && typeof document !== "undefined" && createPortal(popupInner, document.body)}
    </div>
  );
}
