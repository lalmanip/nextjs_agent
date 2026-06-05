import { getFixedGenderForTitle } from "@/lib/passengerTitleGender";

/** Normalize API / DB date values to `YYYY-MM-DD` for `<input type="date">`. */
export function toDateOnlyIso(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (s.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function toIsoFromDmy(dd: unknown, mm: unknown, yy: unknown): string {
  const d = String(dd ?? "").trim();
  const m = String(mm ?? "").trim();
  const y = String(yy ?? "").trim();
  if (!d || !m || !y) return "";
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const DOB_OBJECT_KEYS = [
  "dateOfBirth",
  "DateOfBirth",
  "dob",
  "DOB",
  "birthDate",
  "BirthDate",
  "birthdate",
];

const DOB_DAY_KEYS = ["dateOfBirthDay", "DateOfBirthDay", "dobDay", "DobDay", "birthDay", "BirthDay"];
const DOB_MONTH_KEYS = ["dateOfBirthMonth", "DateOfBirthMonth", "dobMonth", "DobMonth", "birthMonth", "BirthMonth"];
const DOB_YEAR_KEYS = ["dateOfBirthYear", "DateOfBirthYear", "dobYear", "DobYear", "birthYear", "BirthYear"];

const TITLE_KEYS = ["title", "Title", "paxTitle", "PaxTitle", "salutation", "Salutation", "passengerTitle", "PassengerTitle"];

const PASSPORT_ISSUING_COUNTRY_KEYS = [
  "passportIssuingCountry",
  "PassportIssuingCountry",
  "passportIssueCountry",
  "PassportIssueCountry",
  "PassportIssueCountryCode",
  "passportIssueCountryCode",
];

function travellerRecordSources(member: Record<string, unknown>): Record<string, unknown>[] {
  return [
    member,
    member.travellerDetails as Record<string, unknown>,
    member.TravellerDetails as Record<string, unknown>,
    member.userTravellerDetails as Record<string, unknown>,
    member.UserTravellerDetails as Record<string, unknown>,
  ].filter((x) => x && typeof x === "object") as Record<string, unknown>[];
}

function readDobFromRecord(rec: Record<string, unknown>): string {
  for (const key of DOB_OBJECT_KEYS) {
    const iso = toDateOnlyIso(rec[key]);
    if (iso) return iso;
  }
  for (const dayKey of DOB_DAY_KEYS) {
    for (const monthKey of DOB_MONTH_KEYS) {
      for (const yearKey of DOB_YEAR_KEYS) {
        const iso = toIsoFromDmy(rec[dayKey], rec[monthKey], rec[yearKey]);
        if (iso) return iso;
      }
    }
  }
  return "";
}

function readTitleFromRecord(rec: Record<string, unknown>): string {
  for (const key of TITLE_KEYS) {
    const raw = String(rec[key] ?? "").trim();
    if (raw) return raw;
  }
  const gender = String(rec.gender ?? rec.Gender ?? "").trim().toLowerCase();
  if (gender === "female" || gender === "f" || gender === "2") return "Ms";
  if (gender === "male" || gender === "m" || gender === "1") return "Mr";
  return "";
}

function normalizeTitleToken(raw: string): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const key = t.replace(/\./g, "").toLowerCase();
  const map: Record<string, string> = {
    mr: "Mr",
    mrs: "Mrs",
    ms: "Ms",
    miss: "Miss",
    mstr: "Mstr",
    master: "Mstr",
  };
  if (map[key]) return map[key];
  if (/^mr$/i.test(t)) return "Mr";
  if (/^mrs$/i.test(t)) return "Mrs";
  if (/^ms$/i.test(t)) return "Ms";
  if (/^miss$/i.test(t)) return "Miss";
  if (/^mstr$/i.test(t) || /^master$/i.test(t)) return "Mstr";
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

/** Map saved title to a value allowed for the passenger type on the booking form. */
export function titleForPaxType(rawTitle: string, paxType: string): string {
  const normalized = normalizeTitleToken(rawTitle);
  if (paxType === "Infant") {
    if (normalized === "Miss" || normalized === "Ms" || normalized === "Mrs") return "Miss";
    if (normalized === "Mstr" || normalized === "Mr") return "Mstr";
    return "Mstr";
  }
  if (paxType === "Child") {
    if (normalized === "Miss" || normalized === "Ms" || normalized === "Mrs") return "Miss";
    if (normalized === "Mstr" || normalized === "Mr") return "Mstr";
    return "Mstr";
  }
  if (normalized === "Miss") return "Ms";
  if (normalized === "Mr" || normalized === "Ms" || normalized === "Mrs") return normalized;
  if (normalized === "Mstr") return "Mr";
  return normalized || "Mr";
}

/** Read DOB from saved traveller / family member rows (handles nested + alternate field names). */
export function readTravellerDateOfBirthIso(member: unknown): string {
  if (!member || typeof member !== "object") return "";
  for (const src of travellerRecordSources(member as Record<string, unknown>)) {
    const iso = readDobFromRecord(src);
    if (iso) return iso;
  }
  return "";
}

/** Read title from saved traveller / family member rows. */
export function readTravellerTitle(member: unknown, paxType = "Adult"): string {
  if (!member || typeof member !== "object") return "";
  for (const src of travellerRecordSources(member as Record<string, unknown>)) {
    const raw = readTitleFromRecord(src);
    if (raw) return titleForPaxType(raw, paxType);
  }
  return "";
}

function readPassportIssuingCountryFromRecord(rec: Record<string, unknown>): string {
  for (const key of PASSPORT_ISSUING_COUNTRY_KEYS) {
    const raw = String(rec[key] ?? "").trim();
    if (raw) return raw.toUpperCase().slice(0, 3);
  }
  return "";
}

/** Read passport issuing country ISO from saved traveller / form state. */
export function readPassportIssuingCountry(member: unknown): string {
  if (!member || typeof member !== "object") return "";
  for (const src of travellerRecordSources(member as Record<string, unknown>)) {
    const code = readPassportIssuingCountryFromRecord(src);
    if (code) return code;
  }
  return "";
}

/** Map UI / legacy fields to vivapi-user `passportIssuingCountry`. */
export function withPassportIssuingCountryForApi<T extends Record<string, unknown>>(body: T): T {
  const country = readPassportIssuingCountry(body);
  if (!country) return body;
  return { ...body, passportIssuingCountry: country };
}

/** Ensures normalized `dateOfBirth`, `title`, and issuing country when the API uses alternate keys. */
export function normalizeTravellerMember<T extends Record<string, unknown>>(member: T): T {
  const dateOfBirth = readTravellerDateOfBirthIso(member);
  const title = readTravellerTitle(member, String(member.passengerType ?? member.PassengerType ?? "Adult"));
  const issuing = readPassportIssuingCountry(member);
  return {
    ...member,
    ...(dateOfBirth ? { dateOfBirth } : {}),
    ...(title ? { title } : {}),
    ...(issuing
      ? {
          passportIssuingCountry: issuing,
          PassportIssueCountryCode: issuing,
        }
      : {}),
  };
}

export type BookingPassengerPatch = {
  type?: string;
  title?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  pan?: string;
  passport?: string;
  passportIssue?: string;
  passportExpiry?: string;
  passportIssueCountry?: string;
};

/** Apply saved traveller profile fields onto a booking passenger row. */
export function applySavedTravellerToPassenger<T extends BookingPassengerPatch>(
  pax: T,
  member: unknown,
  options?: {
    sanitizeName?: (raw: string) => string;
    sanitizeFirstName?: (raw: string) => string;
    sanitizeLastName?: (raw: string) => string;
    includePassport?: boolean;
  },
): T {
  if (!member || typeof member !== "object") return pax;
  const m = member as Record<string, unknown>;
  const paxType = String(pax.type || "Adult");
  const fallback = options?.sanitizeName ?? ((s: string) => s);
  const sanitizeFirst = options?.sanitizeFirstName ?? fallback;
  const sanitizeLast = options?.sanitizeLastName ?? fallback;
  const includePassport = options?.includePassport !== false;

  const next: T = { ...pax };
  const title = readTravellerTitle(m, paxType);
  if (title) {
    next.title = title;
    const fixedGender = getFixedGenderForTitle(title);
    if (fixedGender) next.gender = fixedGender;
  }

  const fn = String(m.firstName ?? m.FirstName ?? "").trim();
  const ln = String(m.lastName ?? m.LastName ?? "").trim();
  if (fn) next.firstName = sanitizeFirst(fn);
  if (ln) next.lastName = sanitizeLast(ln);

  const dob = readTravellerDateOfBirthIso(m);
  if (dob) next.dob = dob;

  const pan = String(m.pan ?? m.PAN ?? m.panNumber ?? m.PanNumber ?? "").trim();
  if (pan) next.pan = pan;

  if (includePassport) {
    const passportNo =
      m.passportNumber ?? m.PassportNumber ?? m.passport ?? m.Passport ?? "";
    if (passportNo) next.passport = String(passportNo).toUpperCase();

    const issueIso =
      m.passportIssueDate ?? m.PassportIssueDate ?? m.passportIssue ?? m.PassportIssue ?? "";
    if (issueIso) next.passportIssue = toDateOnlyIso(issueIso);

    const expDay = String(m.passportExpiryDay ?? m.PassportExpiryDay ?? "").trim();
    const expMonth = String(m.passportExpiryMonth ?? m.PassportExpiryMonth ?? "").trim();
    const expYear = String(m.passportExpiryYear ?? m.PassportExpiryYear ?? "").trim();
    if (expYear && expMonth && expDay) {
      next.passportExpiry = `${expYear.padStart(4, "0")}-${expMonth.padStart(2, "0")}-${expDay.padStart(2, "0")}`;
    }

    const issueCountry = readPassportIssuingCountry(m);
    if (issueCountry) next.passportIssueCountry = issueCountry;
  }

  return next;
}

/** Stable id (`origin`) from a saved traveller API row. */
export function getTravellerIdFromMember(member: unknown): string {
  if (!member || typeof member !== "object") return "";
  const m = member as Record<string, unknown>;
  const candidates = [
    m.origin,
    m.Origin,
    m.travellerId,
    m.TravellerId,
    m.id,
    m.Id,
  ];
  for (const c of candidates) {
    const s = String(c ?? "").trim();
    if (s) return s;
  }
  return "";
}

export function formatTravellerDisplayName(member: Record<string, unknown>): string {
  const fn = String(member.firstName ?? member.FirstName ?? "").trim();
  const ln = String(member.lastName ?? member.LastName ?? "").trim();
  return `${fn} ${ln}`.trim();
}

export function formatTravellerTypeaheadSecondary(member: Record<string, unknown>): string {
  const phone = String(member.phoneNumber ?? member.PhoneNumber ?? "").trim();
  const lead = String(member.leadPassengerName ?? member.LeadPassengerName ?? "").trim();
  const parts: string[] = [];
  if (phone) parts.push(phone);
  if (lead) parts.push(`Lead: ${lead}`);
  return parts.join(" · ");
}
