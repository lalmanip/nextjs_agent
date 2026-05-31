import {
  normalizeLeadPassengerAddress,
  type LeadPassengerAddress,
} from "@/lib/leadPassengerAddress";

/**
 * Default lead-passenger postal address for LCC (low-cost carrier) bookings.
 * Suppliers require a postal address on commit; passengers do not enter it in the UI.
 *
 * Override per field in `.env.local` (no leading spaces on keys):
 *   LCC_LEAD_ADDRESS_LINE1, LCC_LEAD_ADDRESS_LINE2, LCC_LEAD_CITY, LCC_LEAD_STATE,
 *   LCC_LEAD_PIN_CODE, LCC_LEAD_COUNTRY_CODE, LCC_LEAD_COUNTRY_NAME
 */
const FILE_DEFAULTS: LeadPassengerAddress = {
  addressLine1: "Vivance Travels",
  addressLine2: "Corporate office",
  city: "Mumbai",
  state: "Maharashtra",
  pinCode: "400001",
  countryCode: "IN",
  countryName: "India",
};

function envOr(key: string, fallback: string): string {
  const v = process.env[key]?.trim();
  return v || fallback;
}

export function getLccDefaultLeadPassengerAddress(): LeadPassengerAddress {
  return normalizeLeadPassengerAddress({
    addressLine1: envOr(
      "NEXT_PUBLIC_LCC_LEAD_ADDRESS_LINE1",
      FILE_DEFAULTS.addressLine1,
    ),
    addressLine2: envOr(
      "NEXT_PUBLIC_LCC_LEAD_ADDRESS_LINE2",
      FILE_DEFAULTS.addressLine2 ?? "",
    ),
    city: envOr("NEXT_PUBLIC_LCC_LEAD_CITY", FILE_DEFAULTS.city),
    state: envOr("NEXT_PUBLIC_LCC_LEAD_STATE", FILE_DEFAULTS.state ?? ""),
    pinCode: envOr("NEXT_PUBLIC_LCC_LEAD_PIN_CODE", FILE_DEFAULTS.pinCode),
    countryCode: envOr(
      "NEXT_PUBLIC_LCC_LEAD_COUNTRY_CODE",
      FILE_DEFAULTS.countryCode,
    ),
    countryName: envOr(
      "NEXT_PUBLIC_LCC_LEAD_COUNTRY_NAME",
      FILE_DEFAULTS.countryName,
    ),
  });
}
