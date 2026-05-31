import { getLccDefaultLeadPassengerAddress } from "@/config/lccLeadAddress";

/** Lead passenger postal address (used for LCC commit-booking). */

export type LeadPassengerAddress = {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  pinCode: string;
  countryCode: string;
  countryName: string;
};

const INDIAN_PIN_RE = /^\d{6}$/;
const GENERIC_POSTAL_RE = /^[A-Za-z0-9][A-Za-z0-9\s-]{2,11}$/;

export function validateLeadPassengerAddress(
  address: LeadPassengerAddress | null | undefined,
  options?: { requireState?: boolean },
): string | null {
  if (!address) {
    return "Lead passenger address is required for this low-cost carrier booking.";
  }
  const line1 = String(address.addressLine1 ?? "").trim();
  const city = String(address.city ?? "").trim();
  const state = String(address.state ?? "").trim();
  const pin = String(address.pinCode ?? "").trim();
  const countryCode = String(address.countryCode ?? "").trim().toUpperCase();
  const countryName = String(address.countryName ?? "").trim();
  if (!line1) {
    return "Please enter address line 1 for the lead passenger.";
  }
  if (line1.length < 5) {
    return "Address line 1 must be at least 5 characters.";
  }
  if (!countryCode) {
    return "Please select country for the lead passenger address.";
  }
  if (!countryName) {
    return "Please select a valid country.";
  }
  if (options?.requireState && !state) {
    return "Please select state / province for the lead passenger address.";
  }
  if (!city) {
    return "Please select or enter city for the lead passenger address.";
  }
  if (!pin) {
    return "Please enter PIN / postal code for the lead passenger address.";
  }
  if (countryCode === "IN" && !INDIAN_PIN_RE.test(pin)) {
    return "Please enter a valid 6-digit PIN code for India.";
  }
  if (countryCode !== "IN" && !GENERIC_POSTAL_RE.test(pin)) {
    return "Please enter a valid postal code (3–12 characters).";
  }
  return null;
}

/** LCC bookings: use configured default unless an explicit override was stored. */
export function resolveLeadPassengerAddressForLcc(
  override?: LeadPassengerAddress | null,
): LeadPassengerAddress {
  if (override && String(override.addressLine1 ?? "").trim()) {
    return normalizeLeadPassengerAddress(override);
  }
  return getLccDefaultLeadPassengerAddress();
}

export function normalizeLeadPassengerAddress(
  address: LeadPassengerAddress,
): LeadPassengerAddress {
  const line1 = String(address.addressLine1 ?? "").trim();
  const line2 = String(address.addressLine2 ?? "").trim();
  const countryCode = String(address.countryCode ?? "IN").trim().toUpperCase() || "IN";
  const countryName = String(address.countryName ?? "").trim();
  return {
    addressLine1: line1,
    /** Omit when blank — do not duplicate line 1 into stored `addressLine2`. */
    ...(line2 ? { addressLine2: line2 } : {}),
    city: String(address.city ?? "").trim(),
    state: String(address.state ?? "").trim() || undefined,
    pinCode: String(address.pinCode ?? "").trim(),
    countryCode,
    countryName: countryName || countryCode,
  };
}
