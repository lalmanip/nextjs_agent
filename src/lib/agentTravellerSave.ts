import { withPassportIssuingCountryForApi } from "@/lib/travellerFields";

/** DOB for traveller create — only when entered in the booking form (Child/Infant). */
function enteredDateOfBirthForTravellerSave(pax: BookingPassengerRow): string | null {
  const paxType = String(pax.type ?? "Adult");
  if (paxType === "Adult") return null;
  const dob = String(pax.dob ?? "").trim();
  return dob || null;
}

export type BookingPassengerRow = {
  type?: string;
  index?: number;
  title?: string;
  firstName?: string;
  lastName?: string;
  gender?: string;
  dob?: string;
  pan?: string;
  passport?: string;
  passportIssue?: string;
  passportExpiry?: string;
  passportIssueCountry?: string;
  savedTravellerOrigin?: string | number | null;
};

function passportExpiryParts(expiryIso: string | undefined | null) {
  const iso = String(expiryIso ?? "").trim();
  if (!iso || iso.length < 10) return { day: null, month: null, year: null };
  const [y, m, d] = iso.slice(0, 10).split("-");
  return {
    day: d || null,
    month: m || null,
    year: y || null,
  };
}

export function getLeadPassengerDisplayName(passengers: BookingPassengerRow[]): string {
  const lead = passengers.find((p) => p.type === "Adult" && Number(p.index ?? 0) === 0);
  if (!lead) return "";
  return `${String(lead.firstName ?? "").trim()} ${String(lead.lastName ?? "").trim()}`.trim();
}

export function bookingPaxToTravellerCreatePayload(
  pax: BookingPassengerRow,
  userId: number | string,
  options: {
    leadPassengerName: string;
    /** Lead adult contact — saved only on the first adult row. */
    leadContact?: { email?: string; phoneNumber?: string };
  },
) {
  const exp = passportExpiryParts(pax.passportExpiry);
  const issuing = String(pax.passportIssueCountry ?? "IN").trim().toUpperCase().slice(0, 3);
  const enteredDob = enteredDateOfBirthForTravellerSave(pax);

  const payload: Record<string, unknown> = {
    userId: Number(userId),
    firstName: String(pax.firstName ?? "").trim(),
    lastName: String(pax.lastName ?? "").trim(),
    title: String(pax.title ?? "").trim() || null,
    gender: String(pax.gender ?? "").trim() || null,
    leadPassengerName: options.leadPassengerName.trim() || null,
    panNumber: String(pax.pan ?? "").trim().toUpperCase() || null,
    passportNumber: String(pax.passport ?? "").trim().toUpperCase() || null,
    passportIssueDate: String(pax.passportIssue ?? "").trim() || null,
    passportExpiryDay: exp.day,
    passportExpiryMonth: exp.month,
    passportExpiryYear: exp.year,
    passportNationality: issuing || null,
    PassportIssueCountryCode: issuing || "IN",
    passportUserName: null,
    createdById: Number(userId),
  };

  if (enteredDob) {
    payload.dateOfBirth = enteredDob;
  }

  const isLeadAdult = pax.type === "Adult" && Number(pax.index ?? 0) === 0;
  if (isLeadAdult && options.leadContact) {
    const email = String(options.leadContact.email ?? "").trim();
    const phone = String(options.leadContact.phoneNumber ?? "").trim();
    if (email) payload.email = email;
    if (phone) payload.phoneNumber = phone;
  }

  return withPassportIssuingCountryForApi(payload);
}

function travellerNameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

function findExistingTraveller(
  pax: BookingPassengerRow,
  familyMembers: Record<string, unknown>[],
): Record<string, unknown> | null {
  const fn = String(pax.firstName ?? "").trim().toLowerCase();
  const ln = String(pax.lastName ?? "").trim().toLowerCase();
  if (!fn || !ln) return null;
  const key = travellerNameKey(fn, ln);

  for (const member of familyMembers) {
    const mfn = String(member.firstName ?? member.FirstName ?? "").trim().toLowerCase();
    const mln = String(member.lastName ?? member.LastName ?? "").trim().toLowerCase();
    if (travellerNameKey(mfn, mln) === key) return member;
  }
  return null;
}

/** Persist manually entered passengers after the passenger-details step. */
export async function saveBookingPassengersAsTravellers(options: {
  passengers: BookingPassengerRow[];
  userId: number | string;
  familyMembers: Record<string, unknown>[];
  leadContact?: { email?: string; phoneNumber?: string };
}): Promise<void> {
  const { passengers, userId, familyMembers, leadContact } = options;

  const leadName = getLeadPassengerDisplayName(passengers);

  for (const pax of passengers) {
    if (!String(pax.firstName ?? "").trim() || !String(pax.lastName ?? "").trim()) continue;
    if (pax.savedTravellerOrigin != null && String(pax.savedTravellerOrigin).trim()) continue;

    if (findExistingTraveller(pax, familyMembers)) continue;

    const payload = bookingPaxToTravellerCreatePayload(pax, userId, {
      leadPassengerName: leadName,
      leadContact,
    });

    try {
      const res = await fetch("/api/family-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.warn("[agentTravellerSave] create failed:", err?.error || err?.message || res.status);
      }
    } catch (err) {
      console.warn("[agentTravellerSave] create error:", err);
    }
  }
}
