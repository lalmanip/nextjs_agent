"use client";
import { useState, useEffect } from "react";
import { authAPI, SignUpData, SignInData } from "@/lib/api";
import { clearUserSession, getUserSession, setUserSession } from "@/lib/authSession";
import ForgotPasswordModal from "./ForgotPasswordModal";
import PasswordInput from "./PasswordInput";
import { getFixedGenderForTitle } from "@/lib/passengerTitleGender";
import {
  validateEmail,
  validatePassword,
  validateName,
  validatePhone,
  validateOptionalSignUpDateOfBirth,
  validateOptionalSignUpTitle,
  validateOptionalSignUpGender,
  validateOptionalSignUpAddressField,
  validateOptionalSignUpPincode,
  validateSignUpTitleGenderLinked,
  SIGNUP_PINCODE_MAX_CHARS,
  SIGNUP_POSTAL_ALPHANUM_MAX,
} from "@/utils/validation";

interface SignUpCountryOption {
  isoCountryCode: string;
  countryName: string;
  countryCode?: string;
}

interface SignUpStateOption {
  stateName: string;
  stateCode: string;
  /** Backend id for api-city-list/state/{origin} */
  stateOrigin: string;
}

interface SignUpCityOption {
  cityName: string;
  cityCode: string;
}

function pickOptionalField(formData: FormData, key: string): string | undefined {
  const v = String(formData.get(key) ?? "").trim();
  return v || undefined;
}

const COUNTRY_CODES = [
  { code: "91", country: "India", flag: "🇮🇳" },
  { code: "1", country: "USA/Canada", flag: "🇺🇸" },
  { code: "44", country: "UK", flag: "🇬🇧" },
  { code: "971", country: "UAE", flag: "🇦🇪" },
  { code: "65", country: "Singapore", flag: "🇸🇬" },
  { code: "61", country: "Australia", flag: "🇦🇺" },
  { code: "92", country: "Pakistan", flag: "🇵🇰" },
  { code: "81", country: "Japan", flag: "🇯🇵" },
  { code: "86", country: "China", flag: "🇨🇳" },
  { code: "60", country: "Malaysia", flag: "🇲🇾" },
];

/** Default address country on sign up (matches country-list API `isoCountryCode`). */
const DEFAULT_SIGNUP_COUNTRY_ISO = "IN";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: "signin" | "signup" | "reset";
  onSignInSuccess?: (user: any) => void;
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode,
  onSignInSuccess,
}: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(initialMode);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [selectedCountryCode, setSelectedCountryCode] = useState("91");
  /** Same title/gender rules as adult passengers in flight booking (optional on sign up). */
  const [signupTitle, setSignupTitle] = useState("");
  const [signupGender, setSignupGender] = useState("");
  const [signupCountryIso, setSignupCountryIso] = useState(DEFAULT_SIGNUP_COUNTRY_ISO);
  const [countryList, setCountryList] = useState<SignUpCountryOption[]>([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [signupStateKey, setSignupStateKey] = useState("");
  const [stateList, setStateList] = useState<SignUpStateOption[]>([]);
  const [statesLoading, setStatesLoading] = useState(false);
  const [signupCityKey, setSignupCityKey] = useState("");
  const [signupCityManual, setSignupCityManual] = useState("");
  const [cityList, setCityList] = useState<SignUpCityOption[]>([]);
  const [citiesLoading, setCitiesLoading] = useState(false);

  // Reset mode when modal opens with new initialMode
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setMessage("");
      setFieldErrors({});
      setSignupTitle("");
      setSignupGender("");
      setSignupCountryIso(DEFAULT_SIGNUP_COUNTRY_ISO);
      setSignupStateKey("");
      setStateList([]);
      setSignupCityKey("");
      setSignupCityManual("");
      setCityList([]);
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen || mode !== "signup") return;
    let cancelled = false;
    setCountriesLoading(true);
    fetch("/api/country-list")
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return;
        setCountryList(Array.isArray(data) ? (data as SignUpCountryOption[]) : []);
      })
      .catch(() => {
        if (!cancelled) {
          setCountryList([{ isoCountryCode: "IN", countryName: "India", countryCode: "+91" }]);
        }
      })
      .finally(() => {
        if (!cancelled) setCountriesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode]);

  useEffect(() => {
    setSignupStateKey("");
  }, [signupCountryIso]);

  useEffect(() => {
    setSignupCityKey("");
    setSignupCityManual("");
  }, [signupStateKey]);

  useEffect(() => {
    if (!isOpen || mode !== "signup") return;
    const iso = signupCountryIso.trim();
    if (!iso) {
      setStateList([]);
      setStatesLoading(false);
      return;
    }
    let cancelled = false;
    setStatesLoading(true);
    setStateList([]);
    fetch(`/api/state-list/${encodeURIComponent(iso)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (cancelled) return;
        setStateList(Array.isArray(data) ? (data as SignUpStateOption[]) : []);
      })
      .catch(() => {
        if (!cancelled) setStateList([]);
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, signupCountryIso]);

  useEffect(() => {
    if (!isOpen || mode !== "signup") return;
    const sel = stateList.find(
      (s) => (s.stateOrigin || s.stateCode || s.stateName) === signupStateKey,
    );
    const origin = sel?.stateOrigin?.trim();
    if (!origin) {
      setCityList([]);
      setCitiesLoading(false);
      return;
    }
    let cancelled = false;
    setCitiesLoading(true);
    setCityList([]);
    fetch(`/api/city-list/state/${encodeURIComponent(origin)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (cancelled) return;
        setCityList(Array.isArray(data) ? (data as SignUpCityOption[]) : []);
      })
      .catch(() => {
        if (!cancelled) setCityList([]);
      })
      .finally(() => {
        if (!cancelled) setCitiesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, mode, signupStateKey, stateList]);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const data: SignUpData = {
      email: formData.get("email") as string,
      userName: formData.get("email") as string,
      password: formData.get("password") as string,
      firstName: formData.get("firstName") as string,
      lastName: formData.get("lastName") as string,
      countryCode: formData.get("countryCode") as string,
      phone: formData.get("phone") as string,
    };

    const titleEff = signupTitle.trim();
    const fixedGender = getFixedGenderForTitle(titleEff || undefined);
    const genderEff = (fixedGender || signupGender.trim()) || undefined;

    const dateOfBirth = pickOptionalField(formData, "dateOfBirth");
    const address = pickOptionalField(formData, "address");
    const stateRow = stateList.find(
      (s) => (s.stateOrigin || s.stateCode || s.stateName) === signupStateKey,
    );
    const stateVal = stateRow?.stateName?.trim() || undefined;
    let cityVal: string | undefined;
    if (stateRow?.stateOrigin?.trim()) {
      cityVal =
        signupCityKey.trim() === ""
          ? undefined
          : cityList.find(
              (c) => c.cityName === signupCityKey || (c.cityCode && c.cityCode === signupCityKey),
            )?.cityName?.trim() || undefined;
    } else if (signupStateKey.trim()) {
      cityVal = signupCityManual.trim() || undefined;
    }
    const pincode = pickOptionalField(formData, "pincode");
    const countryName =
      signupCountryIso.trim() === ""
        ? undefined
        : countryList.find((c) => c.isoCountryCode === signupCountryIso)?.countryName?.trim() || undefined;
    if (signupCountryIso.trim() && !countryName) {
      setFieldErrors({ country: "Please select a valid country" });
      return;
    }
    if (signupStateKey.trim() && !stateVal) {
      setFieldErrors({ state: "Please select a valid state" });
      return;
    }
    if (signupCityKey.trim() && stateRow?.stateOrigin?.trim() && !cityVal) {
      setFieldErrors({ city: "Please select a valid city" });
      return;
    }
    if (titleEff) data.title = titleEff;
    if (genderEff) data.gender = genderEff;
    if (dateOfBirth !== undefined) data.dateOfBirth = dateOfBirth;
    if (address !== undefined) data.address = address;
    if (cityVal) data.city = cityVal;
    if (stateVal !== undefined) data.state = stateVal;
    if (pincode !== undefined) data.pincode = pincode;
    if (countryName !== undefined) data.country = countryName;

    const errors: Record<string, string> = {};
    const e1 = validateName(data.firstName, 'First name'); if (e1) errors.firstName = e1;
    const e2 = validateName(data.lastName, 'Last name');   if (e2) errors.lastName = e2;
    const e3 = validateEmail(data.email);                  if (e3) errors.email = e3;
    const e4 = validatePassword(data.password);            if (e4) errors.password = e4;
    const e5 = validatePhone(data.phone ?? '');            if (e5) errors.phone = e5;
    const d0 = validateOptionalSignUpDateOfBirth(dateOfBirth); if (d0) errors.dateOfBirth = d0;
    const t0 = validateOptionalSignUpTitle(titleEff || undefined); if (t0) errors.title = t0;
    const gLinked = validateSignUpTitleGenderLinked(titleEff || undefined, genderEff);
    const g0 = validateOptionalSignUpGender(genderEff) || gLinked;
    if (g0) errors.gender = g0;
    const a0 = validateOptionalSignUpAddressField(address, "Address"); if (a0) errors.address = a0;
    const c0 = validateOptionalSignUpAddressField(cityVal, "City"); if (c0) errors.city = c0;
    const s0 = validateOptionalSignUpAddressField(stateVal, "State"); if (s0) errors.state = s0;
    const p0 = validateOptionalSignUpPincode(pincode); if (p0) errors.pincode = p0;
    const co0 = validateOptionalSignUpAddressField(countryName, "Country"); if (co0) errors.country = co0;
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});

    setLoading(true);
    try {
      const result = await authAPI.signUp(data);
      if (result.status === "success") {
        setMessage("Account created successfully!");
        setTimeout(() => onClose(), 2000);
      } else {
        setMessage(result.message || "Sign up failed. Please try again.");
      }
    } catch (error: any) {
      console.error("Sign up error:", error);
      setMessage(error.message || "An error occurred. Please try again.");
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const data: SignInData = {
      userName: formData.get("userName") as string,
      password: formData.get("password") as string,
    };

    try {
      const result = await authAPI.signIn(data);
      if (result.status === "success") {
        setUserSession({
          ...result.response,
          ...(typeof result.accessToken === "string" && result.accessToken.trim()
            ? { accessToken: result.accessToken.trim() }
            : {}),
        });
        onSignInSuccess?.(result.response);
        onClose();
      } else {
        setMessage(result.message || "Invalid credentials. Please try again.");
      }
    } catch (error) {
      setMessage("An error occurred. Please try again.");
    }
    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const formData = new FormData(e.currentTarget);
    const currentPassword = String(formData.get("currentPassword") || "");
    const newPassword = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters long");
      setLoading(false);
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      setLoading(false);
      return;
    }

    const session = getUserSession<{ accessToken?: string }>();
    const accessToken =
      typeof session?.accessToken === "string" ? session.accessToken.trim() : "";
    if (!accessToken) {
      setMessage("Please sign in again to change your password.");
      setLoading(false);
      return;
    }

    try {
      const result = await authAPI.changePassword(
        { currentPassword, newPassword },
        accessToken,
      );
      if (result.status === "success") {
        clearUserSession();
        setMessage(result.message || "Password changed successfully! Please sign in again.");
        setTimeout(() => {
          setMode("signin");
          onClose();
          window.location.href = "/agent/login";
        }, 1500);
      } else {
        setMessage(result.message || "Password change failed. Please try again.");
      }
    } catch (error) {
      setMessage("An error occurred. Please try again.");
    }
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            {mode === "signin"
              ? "Sign In"
              : mode === "signup"
                ? "Sign Up"
                : "Change Password"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded ${message.includes("success") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
          >
            {message}
          </div>
        )}

        {mode === "signup" && (
          <form onSubmit={handleSignUp} className="space-y-4">
            <p className="text-xs text-gray-500 -mt-1">Fields marked with * are required.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Title</label>
                <select
                  value={signupTitle}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSignupTitle(v);
                    const fixed = getFixedGenderForTitle(v || undefined);
                    if (fixed) setSignupGender(fixed);
                  }}
                  className={`w-full border rounded px-3 py-2 text-gray-800 ${fieldErrors.title ? "border-red-400" : ""}`}
                >
                  <option value="">—</option>
                  <option value="Mr">Mr</option>
                  <option value="Ms">Ms</option>
                  <option value="Mrs">Mrs</option>
                </select>
                {fieldErrors.title && <p className="text-xs text-red-500 mt-1">{fieldErrors.title}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Gender</label>
                <select
                  value={getFixedGenderForTitle(signupTitle || undefined) || signupGender}
                  disabled={!!getFixedGenderForTitle(signupTitle || undefined)}
                  onChange={(e) => {
                    if (!getFixedGenderForTitle(signupTitle || undefined)) {
                      setSignupGender(e.target.value);
                    }
                  }}
                  className={`w-full border rounded px-3 py-2 text-gray-800 disabled:bg-gray-100 disabled:text-gray-700 ${fieldErrors.gender ? "border-red-400" : ""}`}
                >
                  <option value="">—</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                {!!getFixedGenderForTitle(signupTitle || undefined) && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    Gender is fixed for title <span className="font-semibold">{signupTitle}</span>
                  </p>
                )}
                {fieldErrors.gender && <p className="text-xs text-red-500 mt-1">{fieldErrors.gender}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="signup-first-name" className="block text-xs text-gray-500 mb-1">
                  First name <span className="text-red-600">*</span>
                </label>
                <input
                  id="signup-first-name"
                  name="firstName"
                  placeholder="First name"
                  autoComplete="given-name"
                  className={`w-full border rounded px-3 py-2 ${fieldErrors.firstName ? "border-red-400" : ""}`}
                />
                {fieldErrors.firstName && <p className="text-xs text-red-500 mt-1">{fieldErrors.firstName}</p>}
              </div>
              <div>
                <label htmlFor="signup-last-name" className="block text-xs text-gray-500 mb-1">
                  Last name <span className="text-red-600">*</span>
                </label>
                <input
                  id="signup-last-name"
                  name="lastName"
                  placeholder="Last name"
                  autoComplete="family-name"
                  className={`w-full border rounded px-3 py-2 ${fieldErrors.lastName ? "border-red-400" : ""}`}
                />
                {fieldErrors.lastName && <p className="text-xs text-red-500 mt-1">{fieldErrors.lastName}</p>}
              </div>
            </div>
            <div>
              <label htmlFor="signup-phone" className="block text-xs text-gray-500 mb-1">
                Phone <span className="text-red-600">*</span>
              </label>
              <div className="flex gap-2">
                <select
                  name="countryCode"
                  aria-label="Country calling code"
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="border rounded px-3 py-2 w-32"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} +{c.code}
                    </option>
                  ))}
                </select>
                <input
                  id="signup-phone"
                  name="phone"
                  type="tel"
                  placeholder="Phone Number"
                  inputMode="numeric"
                  onInput={(e) => {
                    const el = e.currentTarget as HTMLInputElement;
                    el.value = el.value.replace(/\D/g, "").slice(0, 10);
                  }}
                  className={`flex-1 border rounded px-3 py-2 ${fieldErrors.phone ? "border-red-400" : ""}`}
                />
              </div>
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label htmlFor="signup-email" className="block text-xs text-gray-500 mb-1">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                id="signup-email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                className={`w-full border rounded px-3 py-2 ${fieldErrors.email ? "border-red-400" : ""}`}
              />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>

            <div>
              <label htmlFor="signup-password" className="block text-xs text-gray-500 mb-1">
                Password <span className="text-red-600">*</span>
              </label>
              <PasswordInput
                id="signup-password"
                name="password"
                placeholder="Min 8 characters, 1 uppercase, 1 number"
                autoComplete="new-password"
                className={fieldErrors.password ? "border-red-400" : ""}
              />
              {fieldErrors.password && <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>}
            </div>

            <div>
              <label htmlFor="signup-dob" className="block text-xs text-gray-500 mb-1">Date of birth</label>
              <input
                id="signup-dob"
                name="dateOfBirth"
                type="date"
                className={`w-full border rounded px-3 py-2 ${fieldErrors.dateOfBirth ? "border-red-400" : ""}`}
                max={(() => {
                  const d = new Date();
                  d.setFullYear(d.getFullYear() - 12);
                  const y = d.getFullYear();
                  const m = String(d.getMonth() + 1).padStart(2, "0");
                  const day = String(d.getDate()).padStart(2, "0");
                  return `${y}-${m}-${day}`;
                })()}
              />
              <p className="text-xs text-gray-500 mt-1">If provided, you must be at least 12 years old.</p>
              {fieldErrors.dateOfBirth && <p className="text-xs text-red-500 mt-1">{fieldErrors.dateOfBirth}</p>}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-4">
              <p className="text-sm font-semibold text-gray-700">Address</p>
              <div>
                <label htmlFor="signup-street" className="block text-xs text-gray-500 mb-1">Street address</label>
                <input
                  id="signup-street"
                  name="address"
                  placeholder="Street address"
                  autoComplete="street-address"
                  className={`w-full border rounded px-3 py-2 ${fieldErrors.address ? "border-red-400" : ""}`}
                />
                {fieldErrors.address && <p className="text-xs text-red-500 mt-1">{fieldErrors.address}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Country</label>
                <select
                  value={signupCountryIso}
                  onChange={(e) => setSignupCountryIso(e.target.value)}
                  disabled={countriesLoading}
                  className={`w-full border rounded px-3 py-2 text-gray-800 disabled:bg-gray-100 ${fieldErrors.country ? "border-red-400" : ""}`}
                >
                  <option value="">{countriesLoading ? "Loading countries…" : "—"}</option>
                  {[...countryList]
                    .sort((a, b) => a.countryName.localeCompare(b.countryName, "en"))
                    .map((c) => (
                      <option key={c.isoCountryCode} value={c.isoCountryCode}>
                        {c.countryName}
                        {c.countryCode ? ` (${c.countryCode})` : ""}
                      </option>
                    ))}
                </select>
                {fieldErrors.country && <p className="text-xs text-red-500 mt-1">{fieldErrors.country}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">State / province</label>
                <select
                  value={signupStateKey}
                  onChange={(e) => setSignupStateKey(e.target.value)}
                  disabled={!signupCountryIso || statesLoading}
                  className={`w-full border rounded px-3 py-2 text-gray-800 disabled:bg-gray-100 ${fieldErrors.state ? "border-red-400" : ""}`}
                >
                  <option value="">
                    {!signupCountryIso
                      ? "Select country first"
                      : statesLoading
                        ? "Loading states…"
                        : stateList.length === 0
                          ? "No states listed"
                          : "—"}
                  </option>
                  {[...stateList]
                    .sort((a, b) => a.stateName.localeCompare(b.stateName, "en"))
                    .map((s) => {
                      const optVal = s.stateOrigin || s.stateCode || s.stateName;
                      return (
                        <option key={`${s.stateOrigin || "x"}-${s.stateCode}-${s.stateName}`} value={optVal}>
                          {s.stateName}
                          {s.stateCode && s.stateName !== s.stateCode ? ` (${s.stateCode})` : ""}
                        </option>
                      );
                    })}
                </select>
                {fieldErrors.state && <p className="text-xs text-red-500 mt-1">{fieldErrors.state}</p>}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">City</label>
                {(() => {
                  const sel = stateList.find(
                    (s) => (s.stateOrigin || s.stateCode || s.stateName) === signupStateKey,
                  );
                  const hasOrigin = !!sel?.stateOrigin?.trim();
                  if (hasOrigin) {
                    return (
                      <select
                        value={signupCityKey}
                        onChange={(e) => setSignupCityKey(e.target.value)}
                        disabled={!signupStateKey || citiesLoading}
                        className={`w-full border rounded px-3 py-2 text-gray-800 disabled:bg-gray-100 ${fieldErrors.city ? "border-red-400" : ""}`}
                      >
                        <option value="">
                          {!signupStateKey
                            ? "Select state first"
                            : citiesLoading
                              ? "Loading cities…"
                              : cityList.length === 0
                                ? "No cities listed"
                                : "—"}
                        </option>
                        {[...cityList]
                          .sort((a, b) => a.cityName.localeCompare(b.cityName, "en"))
                          .map((c, idx) => (
                            <option
                              key={`city-${idx}-${c.cityCode || ""}-${c.cityName}`}
                              value={c.cityName}
                            >
                              {c.cityName}
                            </option>
                          ))}
                      </select>
                    );
                  }
                  return (
                    <input
                      type="text"
                      value={signupCityManual}
                      onChange={(e) => setSignupCityManual(e.target.value)}
                      placeholder={signupStateKey ? "City" : "Select state first"}
                      disabled={!signupStateKey}
                      autoComplete="address-level2"
                      className={`w-full border rounded px-3 py-2 ${fieldErrors.city ? "border-red-400" : ""}`}
                    />
                  );
                })()}
                {fieldErrors.city && <p className="text-xs text-red-500 mt-1">{fieldErrors.city}</p>}
              </div>

              <div>
                <label htmlFor="signup-pincode" className="block text-xs text-gray-500 mb-1">Pincode / ZIP</label>
                <input
                  id="signup-pincode"
                  name="pincode"
                  type="text"
                  inputMode="text"
                  autoComplete="postal-code"
                  placeholder="e.g. 380015 or 12345-6789"
                  maxLength={SIGNUP_PINCODE_MAX_CHARS}
                  onInput={(e) => {
                    const el = e.currentTarget as HTMLInputElement;
                    const v = el.value;
                    const hasLetters = /[A-Za-z]/.test(v);
                    if (hasLetters) {
                      el.value = v.replace(/[^A-Za-z0-9\s\-]/g, "").slice(0, SIGNUP_POSTAL_ALPHANUM_MAX);
                    } else {
                      el.value = v.replace(/[^\d\s\-]/g, "").slice(0, SIGNUP_PINCODE_MAX_CHARS);
                    }
                  }}
                  className={`w-full border rounded px-3 py-2 ${fieldErrors.pincode ? "border-red-400" : ""}`}
                />
                {fieldErrors.pincode && <p className="text-xs text-red-500 mt-1">{fieldErrors.pincode}</p>}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? "Creating..." : "Sign Up"}
            </button>
            <p className="text-center">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-primary"
              >
                Sign In
              </button>
            </p>
          </form>
        )}

        {mode === "signin" && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <input
              name="userName"
              placeholder="Username"
              required
              className="w-full border rounded px-3 py-2"
            />
            <PasswordInput
              name="password"
              placeholder="Password"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? "Signing In..." : "Sign In"}
            </button>
            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(true)}
                className="text-primary"
              >
                Forgot Password?
              </button>
              <p>
                Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setSignupTitle("");
                  setSignupGender("");
                  setSignupCountryIso(DEFAULT_SIGNUP_COUNTRY_ISO);
                  setSignupStateKey("");
                  setStateList([]);
                  setSignupCityKey("");
                  setSignupCityManual("");
                  setCityList([]);
                  setMode("signup");
                }}
                className="text-primary"
              >
                Sign Up
              </button>
              </p>
            </div>
          </form>
        )}

        {mode === "reset" && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <PasswordInput
              name="currentPassword"
              placeholder="Current Password"
              required
            />
            <PasswordInput
              name="password"
              placeholder="New Password"
              required
            />
            <PasswordInput
              name="confirmPassword"
              placeholder="Confirm New Password"
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? "Updating..." : "Change Password"}
            </button>
            <p className="text-center">
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="text-primary"
              >
                Back to Sign In
              </button>
            </p>
          </form>
        )}
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
      />
    </div>
  );
}
