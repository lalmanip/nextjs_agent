"use client";

/** Flight number + fare class line (Indigo-style results). */
const FLIGHT_LINE_COLOR = "#9333ea";

export default function FlightAirlineInfoBlock({
  airlineCode,
  operatorName,
  isLCC,
  cabinClassLabel,
  operatorCode,
  flightNum,
  fareClassLabel,
}: {
  airlineCode: string;
  operatorName?: string;
  isLCC: boolean;
  cabinClassLabel?: string | null;
  operatorCode?: string;
  flightNum?: string;
  fareClassLabel?: string | null;
}) {
  const flightLine = [operatorCode, flightNum].filter(Boolean).join(" ").trim();

  return (
    <div className="flex items-start gap-2 min-w-0">
      <img
        src={`/airlines/${airlineCode}.gif`}
        alt={operatorName || airlineCode}
        className="w-7 h-7 object-contain flex-shrink-0 mt-0.5"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="font-semibold text-xs text-gray-900 truncate">
            {operatorName || "—"}
          </span>
          <span
            className={`px-1 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
              isLCC ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
            }`}
          >
            {isLCC ? "LCC" : "Full Service"}
          </span>
        </div>
        {cabinClassLabel ? (
          <div className="text-[10px] text-gray-500 leading-snug">{cabinClassLabel}</div>
        ) : null}
        {flightLine ? (
          <div
            className="text-[10px] font-medium leading-snug truncate"
            style={{ color: FLIGHT_LINE_COLOR }}
          >
            {flightLine}
            {fareClassLabel ? ` ${fareClassLabel}` : ""}
          </div>
        ) : fareClassLabel ? (
          <div className="text-[10px] font-medium leading-snug" style={{ color: FLIGHT_LINE_COLOR }}>
            {fareClassLabel}
          </div>
        ) : null}
      </div>
    </div>
  );
}
