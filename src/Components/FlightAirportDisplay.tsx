"use client";

import {
  formatAirportWithCity,
  formatTerminalLabel,
  readTerminalFromEndpoint,
} from "@/lib/flightDisplay";

export default function FlightAirportDisplay({
  airportLike,
  terminal,
  airportClassName = "",
  terminalClassName = "text-[10px] text-gray-400 leading-tight",
}: {
  airportLike: unknown;
  /** Override; otherwise read from `airportLike` / nested `airport`. */
  terminal?: string | null;
  airportClassName?: string;
  terminalClassName?: string;
}) {
  const label = formatAirportWithCity(airportLike);
  const term = terminal ?? readTerminalFromEndpoint(airportLike);

  if (!label && !term) return null;

  return (
    <div className="min-w-0">
      {label ? <div className={airportClassName}>{label}</div> : null}
      {term ? <div className={terminalClassName}>{formatTerminalLabel(term)}</div> : null}
    </div>
  );
}
