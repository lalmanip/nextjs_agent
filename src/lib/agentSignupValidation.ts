import {
  validateEmail,
  validateName,
  validatePAN,
  validatePassword,
  validatePhone,
  validateOptionalSignUpAddressField,
  validateOptionalSignUpPincode,
} from "@/utils/validation";

export const AGENT_SIGNUP_MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_EXT = /\.(pdf|jpe?g|png)$/i;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_RE = /^\d{9,18}$/;
const CORPORATE_ID_RE = /^[a-zA-Z0-9\-]{2,30}$/;
const INDIA_PIN_RE = /^\d{6}$/;

export type AgentPersonalInfo = {
  firstName: string;
  lastName: string;
  mobile: string;
  addressProof: File | null;
};

export type AgentLocationSelection = {
  countryIso: string;
  stateKey: string;
  cityKey: string;
  cityManual: string;
  cityName: string;
  hasCityDropdown: boolean;
};

export type AgentCompanyDetails = {
  corporateId: string;
  salesPerson: string;
  companyName: string;
  panNumber: string;
  panCardHolderName: string;
  address: string;
  pinCode: string;
  officePhone: string;
  establishmentDate: string;
  annualTransaction: string;
  iata: string;
  gstFile: File | null;
  panFile: File | null;
  noOfEmployee: string;
};

export type AgentBankDetails = {
  accountNumber: string;
  ifscCode: string;
  accountHolderName: string;
};

export type AgentLoginInfo = {
  userName: string;
  password: string;
  confirmPassword: string;
};

function requiredText(value: string, label: string, maxLen = 200): string | null {
  if (!value?.trim()) return `${label} is required`;
  return validateOptionalSignUpAddressField(value, label) ??
    (value.trim().length < 2 ? `${label} must be at least 2 characters` : null);
}

function validateRequiredFile(file: File | null, label: string): string | null {
  if (!file) return `${label} is required`;
  if (file.size > AGENT_SIGNUP_MAX_FILE_BYTES) {
    return `${label} must be 5 MB or smaller`;
  }
  const okType =
    ALLOWED_FILE_EXT.test(file.name) ||
    ["application/pdf", "image/jpeg", "image/png"].includes(file.type);
  if (!okType) return `${label} must be PDF, JPG, or PNG`;
  return null;
}

function validatePinCode(pinCode: string, countryIso: string): string | null {
  if (!pinCode?.trim()) return "Pin code is required";
  if (countryIso.trim().toUpperCase() === "IN") {
    const digits = pinCode.trim();
    if (!INDIA_PIN_RE.test(digits)) return "Enter a valid 6-digit Indian pin code";
    return null;
  }
  return validateOptionalSignUpPincode(pinCode) ?? null;
}

/** Today's date (YYYY-MM-DD, local) for establishment date input max attribute. */
export function maxEstablishmentDateIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDateLocal(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function validateEstablishmentDate(value: string): string | null {
  if (!value?.trim()) return "Establishment date is required";
  const d = parseIsoDateLocal(value);
  if (!d) return "Enter a valid establishment date";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (d.getTime() > today.getTime()) return "Establishment date cannot be in the future";
  return null;
}

function validatePositiveAmount(value: string, label: string, required = true): string | null {
  const t = value?.trim();
  if (!t) return required ? `${label} is required` : null;
  const n = Number(t.replace(/,/g, ""));
  if (Number.isNaN(n) || n < 0) return `${label} must be a valid non-negative number`;
  return null;
}

function validateEmployeeCount(value: string): string | null {
  if (!value?.trim()) return "Number of employees is required";
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 999_999) {
    return "Enter a valid number of employees (1–999999)";
  }
  return null;
}

function validateUserName(userName: string): string | null {
  if (!userName?.trim()) return "User name is required";
  const t = userName.trim();
  // Username may be an email or alphanumeric id (same value sent as email + userName on user/create)
  if (t.includes("@")) return validateEmail(t);
  if (!USERNAME_RE.test(t)) {
    return "User name must be 3–30 characters (letters, numbers, underscore) or a valid email";
  }
  return null;
}

function validateIfsc(ifsc: string): string | null {
  if (!ifsc?.trim()) return "IFSC code is required";
  if (!IFSC_RE.test(ifsc.trim().toUpperCase())) {
    return "Enter a valid IFSC code (e.g. HDFC0001234)";
  }
  return null;
}

function validateAccountNumber(accountNumber: string): string | null {
  if (!accountNumber?.trim()) return "Account number is required";
  const digits = accountNumber.replace(/\s/g, "");
  if (!ACCOUNT_NUMBER_RE.test(digits)) {
    return "Account number must be 9–18 digits";
  }
  return null;
}

function validateCompanyName(name: string): string | null {
  if (!name?.trim()) return "Company name is required";
  if (name.trim().length < 2) return "Company name must be at least 2 characters";
  if (name.trim().length > 120) return "Company name must be at most 120 characters";
  return null;
}

function validateCorporateId(id: string): string | null {
  if (!id?.trim()) return "Corporate ID is required";
  if (!CORPORATE_ID_RE.test(id.trim())) {
    return "Corporate ID must be 2–30 letters, numbers, or hyphens";
  }
  return null;
}

function validateOptionalIata(iata: string): string | null {
  const t = iata?.trim();
  if (!t) return null;
  if (t.length > 20) return "IATA must be at most 20 characters";
  return null;
}

export function validateAgentSignupPersonal(p: AgentPersonalInfo): Record<string, string> {
  const errors: Record<string, string> = {};
  const set = (field: string, msg: string | null) => {
    if (msg) errors[field] = msg;
  };

  set("firstName", validateName(p.firstName, "First name"));
  set("lastName", validateName(p.lastName, "Last name"));
  set("mobile", validatePhone(p.mobile));
  set("addressProof", validateRequiredFile(p.addressProof, "Address proof"));

  return errors;
}

export function validateAgentSignupLocation(loc: AgentLocationSelection): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!loc.countryIso?.trim()) errors.country = "Country is required";
  if (!loc.stateKey?.trim()) errors.state = "State is required";
  if (loc.hasCityDropdown) {
    if (!loc.cityKey?.trim()) errors.city = "City is required";
  } else if (loc.stateKey?.trim()) {
    const cityErr = requiredText(loc.cityManual, "City");
    if (cityErr) errors.city = cityErr;
  } else {
    errors.city = "City is required";
  }
  if (loc.stateKey?.trim() && !loc.cityName?.trim() && loc.hasCityDropdown && loc.cityKey?.trim()) {
    errors.city = "Please select a valid city";
  }
  return errors;
}

export function validateAgentSignupCompany(
  c: AgentCompanyDetails,
  countryIso: string,
): Record<string, string> {
  const errors: Record<string, string> = {};
  const set = (field: string, msg: string | null) => {
    if (msg) errors[field] = msg;
  };

  set("corporateId", validateCorporateId(c.corporateId));
  set("salesPerson", validateName(c.salesPerson, "Sales person name"));
  set("companyName", validateCompanyName(c.companyName));
  set("panNumber", validatePAN(c.panNumber));
  set("panCardHolderName", validateName(c.panCardHolderName, "PAN card holder name"));
  set("address", requiredText(c.address, "Address", 300));
  set("pinCode", validatePinCode(c.pinCode, countryIso));
  set("officePhone", validatePhone(c.officePhone));
  set("establishmentDate", validateEstablishmentDate(c.establishmentDate));
  set("annualTransaction", validatePositiveAmount(c.annualTransaction, "Annual transaction"));
  set("noOfEmployee", validateEmployeeCount(c.noOfEmployee));
  set("iata", validateOptionalIata(c.iata));
  set("gstFile", validateRequiredFile(c.gstFile, "GST file"));
  set("panFile", validateRequiredFile(c.panFile, "PAN file"));

  return errors;
}

export function validateAgentSignupBank(b: AgentBankDetails): Record<string, string> {
  const errors: Record<string, string> = {};
  const set = (field: string, msg: string | null) => {
    if (msg) errors[field] = msg;
  };

  set("accountNumber", validateAccountNumber(b.accountNumber));
  set("ifscCode", validateIfsc(b.ifscCode));
  set("accountHolderName", validateName(b.accountHolderName, "Account holder name"));

  return errors;
}

export function validateAgentSignupLogin(l: AgentLoginInfo): Record<string, string> {
  const errors: Record<string, string> = {};
  const set = (field: string, msg: string | null) => {
    if (msg) errors[field] = msg;
  };

  set("userName", validateUserName(l.userName));
  set("password", validatePassword(l.password));
  if (!l.confirmPassword?.trim()) {
    errors.confirmPassword = "Please confirm your password";
  } else if (l.password !== l.confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  return errors;
}

export function firstAgentSignupError(errors: Record<string, string>): string | null {
  const keys = Object.keys(errors);
  return keys.length > 0 ? errors[keys[0]] : null;
}
