import type { TourPackageDetail } from "@/lib/holidayPackages";

export type HolidayRoomPax = {
  adults: number;
  childWithBed: number;
  childWithoutBed: number;
  infants: number;
};

const DEPARTURE_CITY_LABELS: Record<string, string> = {
  mumbai: "Mumbai",
  delhi: "Delhi",
  bengaluru: "Bengaluru",
};

export function departureCityLabel(code: string): string {
  const key = code.trim().toLowerCase();
  return DEPARTURE_CITY_LABELS[key] ?? code.trim();
}

export function buildHolidayQuotationMessage(input: {
  pkg: TourPackageDetail;
  travelDate: string;
  tourType: string;
  rooms: HolidayRoomPax[];
  estimatedTotal: number;
  payingTravellerCount: number;
}): string {
  const { pkg, travelDate, tourType, rooms, estimatedTotal, payingTravellerCount } =
    input;

  const roomLines = rooms.map((r, i) => {
    const parts = [
      `${r.adults} adult(s)`,
      `${r.childWithBed} child with bed`,
      `${r.childWithoutBed} child without bed`,
      `${r.infants} infant(s)`,
    ];
    return `Room ${i + 1}: ${parts.join(", ")}`;
  });

  const lines = [
    `Package: ${pkg.title}`,
    `Package ID: ${pkg.pkgId}`,
    `Destination: ${pkg.destinationName} (${pkg.destinationSlug})`,
    `Duration: ${pkg.nights} nights / ${pkg.days} days`,
    `Date of travel: ${travelDate}`,
    `Tour type: ${tourType}`,
    `Per person price: ₹ ${pkg.price.toLocaleString("en-IN")}`,
    `Paying travellers: ${payingTravellerCount}`,
    `Rooms (${rooms.length}):`,
    ...roomLines,
    `Estimated total: ₹ ${estimatedTotal.toLocaleString("en-IN")}`,
  ];

  const message = lines.join("\n");
  return message.length > 2000 ? `${message.slice(0, 1997)}...` : message;
}

export const HOLIDAY_ENQUIRY_PURPOSE = "holidays packages" as const;
