"use client";
import { useState, useRef, useEffect } from "react";
import { flightAPI } from "@/lib/api";

interface Message {
  role: "agent" | "user";
  text: string;
  results?: any[];
}

const AGENT_INTRO =
  "Hi! I'm Viva, your travel assistant ✈️ I can help you search flights and check fares. Just tell me where you want to go — e.g. \"Flights from Mumbai to Delhi on 25 Dec for 2 adults\"";

const QUICK_PROMPTS = [
  "Cheapest flights this weekend",
  "Mumbai to Delhi tomorrow",
  "Round trip BOM to GOI",
  "Business class flights",
  "Flights from Delhi to Goa",
  "Family trip 2 adults 1 child",
  "Honeymoon flights to Maldives",
  "Bangalore to Hyderabad today",
  "Cheapest one-way to Chennai",
  "Weekend getaway from Mumbai",
  "Flights under ₹3000",
  "First class BOM to DEL",
];

function parseQuery(text: string) {
  const lower = text.toLowerCase();

  // Extract airports by code (3-letter)
  const codeMatches = text.match(/\b([A-Z]{3})\b/g) || [];

  // Common city → code map
  const cityMap: Record<string, string> = {
    mumbai: "BOM", bombay: "BOM",
    delhi: "DEL", "new delhi": "DEL",
    bangalore: "BLR", bengaluru: "BLR",
    chennai: "MAA", madras: "MAA",
    kolkata: "CCU", calcutta: "CCU",
    hyderabad: "HYD",
    goa: "GOI",
    pune: "PNQ",
    ahmedabad: "AMD",
    jaipur: "JAI",
    kochi: "COK", cochin: "COK",
    lucknow: "LKO",
    chandigarh: "IXC",
    amritsar: "ATQ",
  };

  let origin = codeMatches[0] || "";
  let destination = codeMatches[1] || "";

  // Try city names if no codes found
  if (!origin || !destination) {
    const fromMatch = lower.match(/(?:from|departing?)\s+([a-z\s]+?)(?:\s+to|\s+on|\s+for|$)/);
    const toMatch = lower.match(/(?:to|arriving?|destination)\s+([a-z\s]+?)(?:\s+on|\s+for|\s+\d|$)/);
    if (fromMatch) {
      const city = fromMatch[1].trim();
      origin = cityMap[city] || city.toUpperCase().slice(0, 3);
    }
    if (toMatch) {
      const city = toMatch[1].trim();
      destination = cityMap[city] || city.toUpperCase().slice(0, 3);
    }
  }

  // Extract date
  const today = new Date();
  let departureDate = new Date(today.getTime() + 86400000); // default tomorrow

  const dateMatch = lower.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (dateMatch) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    departureDate = new Date(today.getFullYear(), months[dateMatch[2]], parseInt(dateMatch[1]));
    if (departureDate < today) departureDate.setFullYear(today.getFullYear() + 1);
  } else if (lower.includes("tomorrow")) {
    departureDate = new Date(today.getTime() + 86400000);
  } else if (lower.includes("weekend")) {
    const day = today.getDay();
    const daysToSat = (6 - day + 7) % 7 || 7;
    departureDate = new Date(today.getTime() + daysToSat * 86400000);
  }

  // Passengers
  const adultMatch = lower.match(/(\d+)\s*adult/);
  const adults = adultMatch ? parseInt(adultMatch[1]) : 1;

  // Trip type
  const isRoundtrip = lower.includes("round") || lower.includes("return");

  // Cabin
  const isBusiness = lower.includes("business");
  const isFirst = lower.includes("first class");
  const cabinClass = isFirst ? "First" : isBusiness ? "Business" : "Economy";

  return { origin, destination, departureDate, adults, isRoundtrip, cabinClass };
}

function FlightCard({ flight, onSelect }: { flight: any; onSelect: () => void }) {
  const details = flight.flightDetails?.details || flight.FlightDetails?.Details;
  const seg = details?.[0]?.[0];
  const price = flight.price || flight.Price;
  if (!seg) return null;

  const origin = seg.origin || seg.Origin;
  const dest = seg.destination || seg.Destination;
  const formatTime = (dt: string) =>
    dt ? new Date(dt.replace(" ", "T")).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }) : "";

  const diffMs =
    new Date((dest?.dateTime || dest?.DateTime || "").replace(" ", "T")).getTime() -
    new Date((origin?.dateTime || origin?.DateTime || "").replace(" ", "T")).getTime();
  const duration = diffMs > 0 ? `${Math.floor(diffMs / 3600000)}h ${Math.floor((diffMs % 3600000) / 60000)}m` : "";

  const isLCC = flight.Attr?.IsLCC ?? flight.attr?.isLCC ?? false;
  const flightNum = seg.flightNumber || seg.FlightNumber || "";
  const airlineCode = flightNum.slice(0, 2) || seg.operatorCode || seg.OperatorCode;

  return (
    <div className="border rounded-lg p-3 bg-white text-xs mt-2">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-2">
          <img
            src={`/airlines/${airlineCode}.gif`}
            alt={seg.operatorName || seg.OperatorName}
            className="w-7 h-7 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
          <span className="font-semibold text-gray-800">
            {seg.operatorName || seg.OperatorName} · {seg.operatorCode || seg.OperatorCode}{seg.flightNumber || seg.FlightNumber}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${isLCC ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"}`}>
            {isLCC ? "LCC" : "Full Service"}
          </span>
        </div>
        <span className="text-primary font-bold text-sm">
          ₹{(price?.totalDisplayFare || price?.TotalDisplayFare)?.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-2 text-gray-600">
        <span className="font-medium">{formatTime(origin?.dateTime || origin?.DateTime)}</span>
        <span>{origin?.airportCode || origin?.AirportCode}</span>
        <span className="flex-1 border-t border-dashed border-gray-300 mx-1"></span>
        <span className="text-gray-400">{duration}</span>
        <span className="flex-1 border-t border-dashed border-gray-300 mx-1"></span>
        <span>{dest?.airportCode || dest?.AirportCode}</span>
        <span className="font-medium">{formatTime(dest?.dateTime || dest?.DateTime)}</span>
      </div>
      <div className="flex justify-between items-center mt-2">
        <span className="text-gray-400">{seg.attr?.cabinClass || seg.Attr?.CabinClass} · {seg.attr?.baggage || seg.Attr?.Baggage}</span>
        <button
          onClick={onSelect}
          className="bg-primary text-white px-3 py-1 rounded text-xs font-semibold hover:bg-primary-dark"
        >
          Select
        </button>
      </div>
    </div>
  );
}

interface AgentAssistProps {
  onSelectFlight?: (flight: any) => void;
}

const VIVA_DISMISSED_KEY = "viva_nudge_dismissed";
export const VIVA_OPEN_EVENT = "vivance:open-viva-agent";

const dismissViva = () => {
  try { sessionStorage.setItem(VIVA_DISMISSED_KEY, "1"); } catch {}
};

/** Opens the Viva chat panel (same as the bottom-right floating button). */
export function openVivaAgent(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(VIVA_OPEN_EVENT));
  }
}

export default function AgentAssist({ onSelectFlight }: AgentAssistProps) {
  const [open, setOpen] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [nudgeDismissed, setNudgeDismissed] = useState(() => {
    try { return sessionStorage.getItem(VIVA_DISMISSED_KEY) === "1"; } catch { return false; }
  });
  const [messages, setMessages] = useState<Message[]>([{ role: "agent", text: AGENT_INTRO }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-popup teaser after 10 seconds — only if never dismissed this session
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!open && !nudgeDismissed) setShowNudge(true);
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setShowNudge(false);
    };
    window.addEventListener(VIVA_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(VIVA_OPEN_EVENT, onOpen);
  }, []);

  const addMessage = (msg: Message) => setMessages((prev) => [...prev, msg]);

  const handleSend = async (text?: string) => {
    const query = (text || input).trim();
    if (!query) return;
    setInput("");
    addMessage({ role: "user", text: query });
    setLoading(true);

    const parsed = parseQuery(query);

    if (!parsed.origin || !parsed.destination) {
      addMessage({
        role: "agent",
        text: "I couldn't figure out the origin or destination. Try something like: \"Flights from Mumbai to Delhi on 15 Jan for 2 adults\"",
      });
      setLoading(false);
      return;
    }

    try {
      addMessage({
        role: "agent",
        text: `Searching ${parsed.origin} → ${parsed.destination} on ${parsed.departureDate.toDateString()} (${parsed.cabinClass})...`,
      });

      const token = await flightAPI.getDomainToken();
      const results = await flightAPI.searchFlights(
        {
          AdultCount: parsed.adults.toString(),
          ChildCount: "0",
          InfantCount: "0",
          JourneyType: parsed.isRoundtrip ? "Return" : "OneWay",
          PreferredAirlines: [""],
          CabinClass: parsed.cabinClass,
          ResultFareType: "2",
          Segments: [
            {
              Origin: parsed.origin,
              Destination: parsed.destination,
              DepartureDate: parsed.departureDate.toISOString(),
            },
          ],
        },
        token
      );

      const journeyList = results?.search?.flightDataList?.journeyList?.[0] || [];
      if (!journeyList.length) {
        addMessage({ role: "agent", text: "No flights found for that route. Try different dates or cities." });
      } else {
        const top5 = journeyList.slice(0, 5);
        addMessage({
          role: "agent",
          text: `Found ${journeyList.length} flights. Here are the top options:`,
          results: top5,
        });
      }
    } catch {
      addMessage({ role: "agent", text: "Search failed. Please check the route and try again." });
    }
    setLoading(false);
  };

  return (
    <>
      {/* Teaser nudge bubble */}
      {showNudge && !open && (
        <div className="fixed bottom-24 right-6 z-50 w-72 bg-white rounded-2xl shadow-2xl border border-orange-200 overflow-hidden animate-fade-in">
          <div className="bg-primary px-4 py-2 flex items-center justify-between">
            <span className="text-white text-sm font-semibold">👋 Hi! I'm Viva</span>
            <button
              onClick={() => { setShowNudge(false); setNudgeDismissed(true); dismissViva(); }}
              className="text-white opacity-70 hover:opacity-100 text-lg leading-none"
            >✕</button>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-gray-700 mb-3">Need help finding the best flights? I can search fares, compare routes &amp; suggest deals! ✈️</p>
            <button
              onClick={() => { setShowNudge(false); setOpen(true); }}
              className="w-full bg-primary text-white text-sm font-semibold rounded-lg py-2 hover:bg-primary-dark transition-colors"
            >
              Chat with Viva
            </button>
          </div>
        </div>
      )}

      {/* Floating Button */}
      <button
        onClick={() => { setOpen(true); setShowNudge(false); }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:bg-primary-dark transition-all hover:scale-110"
        title="Talk to Viva — your travel agent"
      >
        <span className="text-2xl">🤖</span>
      </button>

      {/* Popup */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[95vw] bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 overflow-hidden"
          style={{ height: "520px" }}>
          {/* Header */}
          <div className="bg-primary text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xl">🤖</span>
              <div>
                <div className="font-bold text-sm">Viva — Travel Assistant</div>
                <div className="text-xs opacity-80">Search flights & fares instantly</div>
              </div>
            </div>
            <button onClick={() => { setOpen(false); setNudgeDismissed(true); dismissViva(); }} className="text-white opacity-70 hover:opacity-100 text-xl leading-none">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] ${msg.role === "user" ? "" : ""}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-white rounded-br-sm"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.results && (
                    <div className="mt-1 space-y-1">
                      {msg.results.map((flight, fi) => (
                        <FlightCard
                          key={fi}
                          flight={flight}
                          onSelect={() => {
                            onSelectFlight?.(flight);
                            setOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm">
                  <div className="flex gap-1 items-center">
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Prompts */}
          {messages.length <= 2 && (
            <div className="px-4 py-2 flex gap-2 flex-wrap border-t bg-white flex-shrink-0">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  className="text-xs border border-primary text-primary rounded-full px-3 py-1 hover:bg-primary hover:text-white transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t bg-white flex gap-2 flex-shrink-0">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="e.g. Mumbai to Delhi 25 Dec 2 adults"
              className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center hover:bg-primary-dark disabled:opacity-40 flex-shrink-0"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
