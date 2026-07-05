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

export function buildIndiaTourQuotationMessage(input: {
  destinationLabel: string;
  country: string;
  isd?: string;
  arrivalDate?: string;
  durationDays?: string;
  adults: string;
  children: string;
  destinationInterest?: string;
  otherRequirements?: string;
  interests?: string[];
}): string {
  const lines = [
    `Tour / page: ${input.destinationLabel}`,
    `Country of residence: ${input.country}`,
    input.isd ? `ISD code: ${input.isd}` : null,
    input.arrivalDate ? `Arrival date: ${input.arrivalDate}` : null,
    input.durationDays ? `Duration: ${input.durationDays} day(s)` : null,
    `Adults: ${input.adults}`,
    `Children: ${input.children}`,
    input.destinationInterest ? `Destination of interest: ${input.destinationInterest}` : null,
    input.otherRequirements?.trim()
      ? `Other requirements: ${input.otherRequirements.trim()}`
      : null,
    input.interests && input.interests.length > 0
      ? `Areas of interest: ${input.interests.join(", ")}`
      : null,
  ].filter(Boolean) as string[];

  const message = lines.join("\n");
  return message.length > 2000 ? `${message.slice(0, 1997)}...` : message;
}

export function formatQuotationPhone(isd: string, phone: string): string {
  const combined = `${isd}${phone}`.replace(/[^\d+]/g, "");
  return combined.replace(/^\+/, "").replace(/\D/g, "");
}

export type HolidayQuotationSubmitInput = {
  name: string;
  email: string;
  phone: string;
  place: string;
  message: string;
};

export type HolidayQuotationSubmitResult =
  | { ok: true; enquiryId?: number | string; message?: string }
  | { ok: false; error: string };

/** Shared B2C enquiry submit used by international and India holiday quotation forms. */
export async function submitHolidayQuotationEnquiry(
  input: HolidayQuotationSubmitInput,
): Promise<HolidayQuotationSubmitResult> {
  const res = await fetch("/api/b2c-enquiry/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: input.name.trim(),
      email: input.email.trim(),
      phone: input.phone.trim(),
      place: input.place.trim(),
      purpose: HOLIDAY_ENQUIRY_PURPOSE,
      message: input.message,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const apiErrors = Array.isArray(data?.errors) ? data.errors : [];
    return {
      ok: false,
      error:
        apiErrors.length > 0
          ? String(apiErrors[0]?.message)
          : String(data?.error || data?.message || "Could not send quotation. Please try again."),
    };
  }

  return {
    ok: true,
    enquiryId: data?.response?.id,
    message: typeof data?.message === "string" ? data.message : undefined,
  };
}

export function quotationSuccessMessage(enquiryId?: number | string | null): string {
  return enquiryId != null
    ? `Quotation request sent successfully (Ref #${enquiryId}). We will contact you shortly.`
    : "Quotation request sent successfully. We will contact you shortly.";
}

export const HOLIDAY_ENQUIRY_PURPOSE = "holidays packages" as const;
