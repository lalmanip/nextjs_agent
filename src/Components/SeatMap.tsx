"use client";
import { useState } from "react";

const OG = "#FC6603";

// AvailablityType: Notset=0, Open=1, Reserved=3, Blocked=4, NoSeatAtThisLocation=5
const AVAIL = { NOTSET: 0, OPEN: 1, RESERVED: 3, BLOCKED: 4, NO_SEAT: 5 };

interface Seat {
  Code: string;
  Price: number;
  AvailablityType: number;
  SeatType: number; // 1=Window, 2=Middle, 3=Aisle
  Description?: string;
}

interface SeatMapProps {
  seatOptions: any[];           // SegmentSeat array from API
  passengers: { name: string; type: string; currentSeat: any }[];
  onConfirm: (selections: (any | null)[]) => void; // indexed by passenger
  onClose: () => void;
  route: string;                // e.g. "DEL → VNS"
}

function seatColor(seat: Seat, isSelected: boolean): string {
  if (isSelected) return OG;
  switch (seat.AvailablityType) {
    case AVAIL.OPEN:     return "#d1fae5"; // green-100
    case AVAIL.RESERVED: return "#fca5a5"; // red-300
    case AVAIL.BLOCKED:  return "#e5e7eb"; // gray-200
    default:             return "#f3f4f6";
  }
}

function seatBorder(seat: Seat, isSelected: boolean): string {
  if (isSelected) return OG;
  switch (seat.AvailablityType) {
    case AVAIL.OPEN:     return "#6ee7b7";
    case AVAIL.RESERVED: return "#f87171";
    case AVAIL.BLOCKED:  return "#d1d5db";
    default:             return "#e5e7eb";
  }
}

function isClickable(seat: Seat): boolean {
  return seat.AvailablityType === AVAIL.OPEN;
}

export default function SeatMap({ seatOptions, passengers, onConfirm, onClose, route }: SeatMapProps) {
  // selections[paxIdx] = selected Seat object or null
  const [selections, setSelections] = useState<(Seat | null)[]>(
    passengers.map(p => p.currentSeat || null)
  );
  const [activePax, setActivePax] = useState(0);

  // Flatten all rows from all segment seats
  const allRows: { rowNum: number; seats: Seat[]; isEmergency: boolean }[] = [];
  for (const seg of seatOptions) {
    const rowSeats: any[] = seg.RowSeats || [];
    for (const row of rowSeats) {
      const seats: Seat[] = row.Seats || [];
      const rowNum = parseInt(seats[0]?.Code?.replace(/\D/g, "") || "0", 10) || 0;
      const isEmergency = seats.some((s: Seat) => typeof s.Description === "string" && s.Description.toLowerCase().includes("emergency"));
      if (seats.length > 0) allRows.push({ rowNum, seats, isEmergency });
    }
  }
  allRows.sort((a, b) => a.rowNum - b.rowNum);

  // Derive column letters from all seat codes (e.g. A,B,C,D,E,F)
  const colLetters = Array.from(
    new Set(allRows.flatMap(r => r.seats.map(s => s.Code?.replace(/\d/g, "") || "")))
  ).filter(Boolean).sort();

  // Split columns into left and right groups (aisle in middle)
  const half = Math.ceil(colLetters.length / 2);
  const leftCols = colLetters.slice(0, half);
  const rightCols = colLetters.slice(half);

  const totalCharges = selections.reduce((sum, s) => sum + (s?.Price || 0), 0);

  const handleSeatClick = (seat: Seat) => {
    if (!isClickable(seat)) return;
    setSelections(prev => {
      const next = [...prev];
      // Deselect if already selected by any passenger
      const alreadyByPax = next.findIndex(s => s?.Code === seat.Code);
      if (alreadyByPax !== -1) {
        next[alreadyByPax] = null;
        return next;
      }
      next[activePax] = seat;
      // Advance to next unassigned passenger
      const nextUnassigned = next.findIndex((s, i) => i > activePax && s === null);
      if (nextUnassigned !== -1) setActivePax(nextUnassigned);
      return next;
    });
  };

  const getSeatByCode = (code: string, rowSeats: Seat[]) =>
    rowSeats.find(s => s.Code === code);

  const isSelectedBy = (code: string) =>
    selections.findIndex(s => s?.Code === code);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: `linear-gradient(90deg, ${OG}, #ff8c38)` }}>
          <div className="flex items-center gap-2 text-white">
            <span className="text-xl">💺</span>
            <span className="font-bold text-lg">Seat Selection</span>
          </div>
          <button onClick={onClose} className="text-white text-2xl font-bold leading-none hover:opacity-80">×</button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Left panel */}
          <div className="w-60 flex-shrink-0 border-r bg-gray-50 flex flex-col p-4 gap-3 overflow-y-auto">
            {/* Passenger list */}
            {passengers.map((pax, i) => (
              <div
                key={i}
                onClick={() => setActivePax(i)}
                className={`rounded-lg border-2 p-3 cursor-pointer transition-all ${activePax === i ? "bg-orange-50" : "bg-white hover:bg-gray-100"}`}
                style={{ borderColor: activePax === i ? OG : "#e5e7eb" }}
              >
                <div className="text-xs font-semibold text-gray-500 mb-1">Passenger {i + 1}</div>
                <div className="font-semibold text-sm text-gray-800">{pax.name}</div>
                <div className="text-xs text-gray-500">{route}</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="text-xs px-2 py-0.5 rounded" style={{ background: "#fff7ed", color: OG, border: `1px solid ${OG}` }}>
                    {selections[i] ? selections[i]!.Code : "—"}
                  </div>
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={e => { e.stopPropagation(); setSelections(prev => { const n = [...prev]; n[i] = null; return n; }); }}
                  >
                    {selections[i] ? "Clear" : "Select Seat"}
                  </button>
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="mt-2">
              <div className="text-xs font-semibold text-gray-500 mb-2">Legend</div>
              {[
                { color: "#d1fae5", border: "#6ee7b7", label: "Available" },
                { color: OG,        border: OG,        label: "Selected" },
                { color: "#fca5a5", border: "#f87171", label: "Reserved" },
                { color: "#e5e7eb", border: "#d1d5db", label: "Blocked" },
              ].map(({ color, border, label }) => (
                <div key={label} className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded text-xs flex items-center justify-center" style={{ background: color, border: `1.5px solid ${border}` }} />
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
            </div>

            {/* Charges */}
            <div className="mt-auto border-t pt-3">
              <div className="flex justify-between text-sm font-semibold mb-3">
                <span>Total Charges</span>
                <span>₹ {totalCharges.toLocaleString()}</span>
              </div>
              <button
                onClick={() => onConfirm(selections)}
                className="w-full py-2 rounded-lg font-bold text-white text-sm mb-2"
                style={{ background: `linear-gradient(90deg, ${OG}, #ff8c38)` }}
              >
                Proceed
              </button>
              <button
                onClick={() => onConfirm(passengers.map(() => null))}
                className="w-full py-2 rounded-lg text-sm text-gray-600 border hover:bg-gray-100"
              >
                Proceed without seats
              </button>
            </div>
          </div>

          {/* Right panel: Seat map */}
          <div className="flex-1 overflow-auto p-4">
            <div className="text-center font-semibold text-gray-700 mb-1">{route}</div>
            <div className="text-center text-xs text-gray-400 mb-4">Front Entrance</div>

            {/* Column headers */}
            <div className="flex items-center justify-center gap-1 mb-2 sticky top-0 bg-white z-10 py-1">
              <div className="w-8" /> {/* row number spacer */}
              {leftCols.map(c => (
                <div key={c} className="w-8 text-center text-xs font-bold text-gray-500">{c}</div>
              ))}
              <div className="w-5" /> {/* aisle spacer */}
              {rightCols.map(c => (
                <div key={c} className="w-8 text-center text-xs font-bold text-gray-500">{c}</div>
              ))}
            </div>

            {allRows.map(({ rowNum, seats, isEmergency }) => {
              if (isEmergency) {
                return (
                  <div key={`em-${rowNum}`} className="flex items-center justify-center my-1">
                    <div className="flex-1 h-px bg-red-300" />
                    <span className="text-[10px] font-bold text-red-500 px-2">Emergency Door</span>
                    <div className="flex-1 h-px bg-red-300" />
                  </div>
                );
              }

              return (
                <div key={rowNum} className="flex items-center justify-center gap-1 mb-1">
                  {/* Row number */}
                  <div className="w-8 text-center text-xs text-gray-400">{rowNum}</div>

                  {/* Left columns */}
                  {leftCols.map(col => {
                    const seat = getSeatByCode(`${rowNum}${col}`, seats);
                    if (!seat || seat.AvailablityType === AVAIL.NO_SEAT) {
                      return <div key={col} className="w-8 h-7" />;
                    }
                    const selIdx = isSelectedBy(seat.Code);
                    const selected = selIdx !== -1;
                    const clickable = isClickable(seat);
                    return (
                      <button
                        key={col}
                        title={`${seat.Code} — ₹${seat.Price} (${seat.SeatType === 1 ? "Window" : seat.SeatType === 2 ? "Middle" : "Aisle"})`}
                        onClick={() => handleSeatClick(seat)}
                        disabled={!clickable}
                        className="w-8 h-7 rounded text-[10px] font-bold transition-all"
                        style={{
                          background: seatColor(seat, selected),
                          border: `1.5px solid ${seatBorder(seat, selected)}`,
                          color: selected ? "white" : "#374151",
                          cursor: clickable ? "pointer" : "not-allowed",
                        }}
                      >
                        {selected ? `P${selIdx + 1}` : seat.Code}
                      </button>
                    );
                  })}

                  {/* Aisle gap */}
                  <div className="w-5" />

                  {/* Right columns */}
                  {rightCols.map(col => {
                    const seat = getSeatByCode(`${rowNum}${col}`, seats);
                    if (!seat || seat.AvailablityType === AVAIL.NO_SEAT) {
                      return <div key={col} className="w-8 h-7" />;
                    }
                    const selIdx = isSelectedBy(seat.Code);
                    const selected = selIdx !== -1;
                    const clickable = isClickable(seat);
                    return (
                      <button
                        key={col}
                        title={`${seat.Code} — ₹${seat.Price} (${seat.SeatType === 1 ? "Window" : seat.SeatType === 2 ? "Middle" : "Aisle"})`}
                        onClick={() => handleSeatClick(seat)}
                        disabled={!clickable}
                        className="w-8 h-7 rounded text-[10px] font-bold transition-all"
                        style={{
                          background: seatColor(seat, selected),
                          border: `1.5px solid ${seatBorder(seat, selected)}`,
                          color: selected ? "white" : "#374151",
                          cursor: clickable ? "pointer" : "not-allowed",
                        }}
                      >
                        {selected ? `P${selIdx + 1}` : seat.Code}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
