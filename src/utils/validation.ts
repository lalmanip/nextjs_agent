import { getFixedGenderForTitle } from "@/lib/passengerTitleGender";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\d{7,15}$/;
export const NAME_RE = /^[a-zA-Z\s'\-]{1,50}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
export const PASSPORT_RE = /^[A-Z0-9]{6,9}$/;
export const GST_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEmail(email: string): string | null {
  if (!email?.trim()) return 'Email is required';
  if (!EMAIL_RE.test(email.trim())) return 'Enter a valid email address';
  return null;
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
  return null;
}

export function validateName(value: string, label = 'Name'): string | null {
  if (!value?.trim()) return `${label} is required`;
  if (!NAME_RE.test(value.trim())) return `${label} must contain only letters, spaces, hyphens or apostrophes`;
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone?.trim()) return 'Phone number is required';
  const digits = phone.replace(/[\s\-\(\)]/g, '');
  if (!PHONE_RE.test(digits)) return 'Enter a valid phone number (7–15 digits)';
  return null;
}

export function validatePAN(pan: string): string | null {
  if (!pan?.trim()) return 'PAN is required';
  if (!PAN_RE.test(pan.trim().toUpperCase())) return 'Enter a valid PAN (e.g. ABCDE1234F)';
  return null;
}

export function validatePassport(passport: string): string | null {
  if (!passport?.trim()) return 'Passport number is required';
  if (!PASSPORT_RE.test(passport.trim().toUpperCase())) return 'Enter a valid passport number (6–9 alphanumeric characters)';
  return null;
}

export function validateGST(gst: string): string | null {
  if (!gst?.trim()) return 'GST number is required';
  if (!GST_RE.test(gst.trim().toUpperCase())) return 'Enter a valid 15-character GST number';
  return null;
}

// Server-side: returns array of errors for the given signup payload
/** When provided, DOB must be a real calendar date and age must be at least 12. */
function parseIsoDateOfBirth(dob: string): { birth: Date; y: number; mo: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const birth = new Date(y, mo - 1, d);
  if (birth.getFullYear() !== y || birth.getMonth() !== mo - 1 || birth.getDate() !== d) {
    return null;
  }
  return { birth, y, mo, d };
}

export function validateOptionalSignUpDateOfBirth(dob: string | undefined | null): string | null {
  const t = String(dob ?? "").trim();
  if (!t) return null;
  const parsed = parseIsoDateOfBirth(t);
  if (!parsed) return "Enter a valid date of birth";
  const { birth } = parsed;
  if (birth < new Date(1900, 0, 1)) return "Enter a valid date of birth";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  birth.setHours(0, 0, 0, 0);
  const oldestAllowed = new Date(today);
  oldestAllowed.setFullYear(today.getFullYear() - 12);
  if (birth > oldestAllowed) return "You must be at least 12 years old";
  return null;
}

/** Family / saved traveller: DOB required; any age (used for flight family dropdown). */
export function validateRequiredTravellerDateOfBirth(dob: string | undefined | null): string | null {
  const t = String(dob ?? "").trim();
  if (!t) return "Date of birth is required";
  const parsed = parseIsoDateOfBirth(t);
  if (!parsed) return "Enter a valid date of birth";
  const { birth } = parsed;
  if (birth < new Date(1900, 0, 1)) return "Enter a valid date of birth";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  birth.setHours(0, 0, 0, 0);
  if (birth.getTime() > today.getTime()) return "Date of birth cannot be in the future";
  return null;
}

export function validateOptionalSignUpTitle(title: string | undefined | null): string | null {
  const t = String(title ?? "").trim();
  if (!t) return null;
  if (!/^(Mr|Ms|Mrs)$/.test(t)) return "Select a valid title (Mr, Ms, or Mrs)";
  return null;
}

export function validateOptionalSignUpGender(gender: string | undefined | null): string | null {
  const t = String(gender ?? "").trim();
  if (!t) return null;
  if (t !== "Male" && t !== "Female") return "Select Male or Female";
  return null;
}

/** When title is Mr/Ms/Mrs, gender must match (same rule as flight booking). */
export function validateSignUpTitleGenderLinked(
  title: string | undefined | null,
  gender: string | undefined | null,
): string | null {
  const titleTrim = String(title ?? "").trim();
  const fixed = getFixedGenderForTitle(titleTrim || undefined);
  if (!fixed) return null;
  const g = String(gender ?? "").trim();
  if (!g) return "Gender is required for the selected title";
  if (g !== fixed) return `Gender must be ${fixed} for title ${titleTrim}`;
  return null;
}

const SIGNUP_ADDRESS_FIELD_MAX = 200;
/** Max characters in the field (allows "12345-6789" style). Exported for sign-up input `maxLength`. */
export const SIGNUP_PINCODE_MAX_CHARS = 14;
const SIGNUP_PINCODE_MIN_DIGITS = 4;
const SIGNUP_PINCODE_MAX_DIGITS = 12;
/** Alphanumeric postcodes (e.g. UK, Canada) — length bounds only. */
const SIGNUP_POSTAL_ALPHANUM_MIN = 3;
export const SIGNUP_POSTAL_ALPHANUM_MAX = 10;

export function validateOptionalSignUpAddressField(
  value: string | undefined | null,
  label: string,
): string | null {
  const t = String(value ?? "").trim();
  if (!t) return null;
  if (t.length > SIGNUP_ADDRESS_FIELD_MAX) {
    return `${label} must be at most ${SIGNUP_ADDRESS_FIELD_MAX} characters`;
  }
  return null;
}

export function validateOptionalSignUpPincode(pincode: string | undefined | null): string | null {
  const t = String(pincode ?? "").trim();
  if (!t) return null;
  if (t.length > SIGNUP_PINCODE_MAX_CHARS) {
    return `Pincode must be at most ${SIGNUP_PINCODE_MAX_CHARS} characters`;
  }
  const hasLetters = /[A-Za-z]/.test(t);
  if (hasLetters) {
    if (t.length < SIGNUP_POSTAL_ALPHANUM_MIN) {
      return `Pincode must be at least ${SIGNUP_POSTAL_ALPHANUM_MIN} characters`;
    }
    if (t.length > SIGNUP_POSTAL_ALPHANUM_MAX) {
      return `Pincode must be at most ${SIGNUP_POSTAL_ALPHANUM_MAX} characters`;
    }
    if (!/^[A-Za-z0-9\s\-]+$/.test(t)) return "Pincode contains invalid characters";
    return null;
  }
  const digits = t.replace(/\D/g, "");
  if (digits.length < SIGNUP_PINCODE_MIN_DIGITS) {
    return `Pincode must be at least ${SIGNUP_PINCODE_MIN_DIGITS} digits`;
  }
  if (digits.length > SIGNUP_PINCODE_MAX_DIGITS) {
    return `Pincode must be at most ${SIGNUP_PINCODE_MAX_DIGITS} digits`;
  }
  if (!/^[\d\s\-]+$/.test(t)) return "Pincode contains invalid characters";
  return null;
}

export function validateSignUpPayload(data: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  const push = (field: string, msg: string | null) => { if (msg) errors.push({ field, message: msg }); };

  push('firstName', validateName(data.firstName, 'First name'));
  push('lastName', validateName(data.lastName, 'Last name'));
  push('email', validateEmail(data.email));
  push('password', validatePassword(data.password));
  push('phone', validatePhone(data.phone));

  push('dateOfBirth', validateOptionalSignUpDateOfBirth(data.dateOfBirth));
  push('title', validateOptionalSignUpTitle(data.title));
  push(
    'gender',
    validateOptionalSignUpGender(data.gender) || validateSignUpTitleGenderLinked(data.title, data.gender),
  );
  push('address', validateOptionalSignUpAddressField(data.address, 'Address'));
  push('city', validateOptionalSignUpAddressField(data.city, 'City'));
  push('state', validateOptionalSignUpAddressField(data.state, 'State'));
  push('pincode', validateOptionalSignUpPincode(data.pincode));
  push('country', validateOptionalSignUpAddressField(data.country, 'Country'));

  return errors;
}

// Server-side: returns array of errors for the given signin payload
export function validateSignInPayload(data: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.userName?.trim()) errors.push({ field: 'userName', message: 'Username is required' });
  if (!data.password) errors.push({ field: 'password', message: 'Password is required' });
  return errors;
}

// Server-side: returns array of errors for passenger create payload
export function validatePassengerPayload(data: Record<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  const push = (field: string, msg: string | null) => { if (msg) errors.push({ field, message: msg }); };

  push('firstName', validateName(data.firstName, 'First name'));
  push('lastName', validateName(data.lastName, 'Last name'));
  if (data.email) push('email', validateEmail(data.email));
  if (data.passportNumber) push('passportNumber', validatePassport(data.passportNumber));

  return errors;
}
