"use client";

import { useEffect, useMemo, useState } from "react";
import { INDIA_STATES } from "@/lib/indiaTourismNav";
import {
  buildIndiaTourQuotationMessage,
  formatQuotationPhone,
  quotationSuccessMessage,
  submitHolidayQuotationEnquiry,
} from "@/lib/holidayQuotationEnquiry";
import { validateEmail, validateName, validatePhone } from "@/utils/validation";

type IndiaTourQuoteFormProps = {
  destinationLabel: string;
  id?: string;
  /** Sticky sidebar layout with an independently scrollable form body (lg+). */
  sidebar?: boolean;
};

const COUNTRY_OPTIONS = [
  "India",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Canada",
  "Australia",
  "Singapore",
  "Germany",
  "France",
  "Other",
];

const INTEREST_AREAS = [
  "Adventure / Sports",
  "Art / Handicrafts",
  "Ayurveda",
  "Backwaters",
  "Beaches",
  "Culture",
  "Fairs / Festivals",
  "Forts / Palaces",
  "Golden Triangle",
  "Hill Stations",
  "Honeymoon",
  "Houseboat",
  "Luxury Trains",
  "Monasteries",
  "Shopping",
  "Sightseeing",
  "Trekking",
  "Tribal Area",
  "Wildlife",
  "Temples / Pilgrimages",
] as const;

const DESTINATION_OPTIONS = [
  ...INDIA_STATES.map((s) => s.name),
  "Golden Triangle",
  "Leh Ladakh",
  "Other",
];

const TRAVELLER_COUNTS = Array.from({ length: 11 }, (_, i) => i);

const DURATION_DAYS = Array.from({ length: 30 }, (_, i) => i + 1);

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary";
const selectClass = inputClass;
const labelClass = "mb-1 block text-sm font-medium text-gray-700";

function randomCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: a + b };
}

export default function IndiaTourQuoteForm({
  destinationLabel,
  id = "tour-quote-form",
  sidebar = false,
}: IndiaTourQuoteFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [isd, setIsd] = useState("+91");
  const [phone, setPhone] = useState("");
  const [arrivalDate, setArrivalDate] = useState("");
  const [durationDays, setDurationDays] = useState("");
  const [adults, setAdults] = useState("2");
  const [children, setChildren] = useState("0");
  const [destinationInterest, setDestinationInterest] = useState("");
  const [otherRequirements, setOtherRequirements] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captcha, setCaptcha] = useState<{ a: number; b: number; answer: number } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const defaultDestination = useMemo(() => {
    const match = DESTINATION_OPTIONS.find(
      (d) => destinationLabel.toLowerCase().includes(d.toLowerCase().split(" ")[0] ?? ""),
    );
    return match ?? "";
  }, [destinationLabel]);

  useEffect(() => {
    setCaptcha(randomCaptcha());
  }, []);

  useEffect(() => {
    if (defaultDestination && !destinationInterest) {
      setDestinationInterest(defaultDestination);
    }
  }, [defaultDestination, destinationInterest]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("user");
      if (!saved) return;
      const user = JSON.parse(saved);
      setName(
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          String(user?.name ?? "").trim(),
      );
      setEmail(String(user?.email ?? "").trim());
      setPhone(String(user?.phone ?? user?.mobile ?? "").replace(/\D/g, "").slice(-10));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleInterest = (area: string) => {
    setInterests((prev) =>
      prev.includes(area) ? prev.filter((item) => item !== area) : [...prev, area],
    );
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    const nameErr = validateName(name, "Name");
    if (nameErr) next.name = nameErr;
    const emailErr = validateEmail(email);
    if (emailErr) next.email = emailErr;
    const phoneErr = validatePhone(phone);
    if (phoneErr) next.phone = phoneErr;
    if (!country.trim()) next.country = "Country is required";
    if (!adults || adults === "0") next.adults = "At least 1 adult is required";
    if (!captcha) {
      next.captcha = "Please wait for verification to load.";
    } else if (Number(captchaInput) !== captcha.answer) {
      next.captcha = "Incorrect answer. Please try again.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSuccess(null);
    if (!validate()) return;

    const message = buildIndiaTourQuotationMessage({
      destinationLabel,
      country,
      isd,
      arrivalDate,
      durationDays,
      adults,
      children,
      destinationInterest,
      otherRequirements,
      interests,
    });

    setLoading(true);
    try {
      const result = await submitHolidayQuotationEnquiry({
        name,
        email,
        phone: formatQuotationPhone(isd, phone),
        place: country,
        message,
      });

      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }

      setSuccess(quotationSuccessMessage(result.enquiryId));
      setCaptchaInput("");
      setCaptcha(randomCaptcha());
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id={id}
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg ${
        sidebar ? "flex h-full max-h-[inherit] flex-col" : ""
      }`}
    >
      <div className="shrink-0 bg-primary px-5 py-4 text-white">
        <h3 className="text-xl font-bold">Get Tour Quotes</h3>
        <p className="mt-1 text-sm text-white/90">Fill the form to avail best quotes &amp; prices</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className={`space-y-4 p-5 ${sidebar ? "min-h-0 flex-1 overflow-y-auto overscroll-y-contain" : ""}`}
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
          Travel Details
          <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] text-white">MANDATORY</span>
        </div>

        <div>
          <label className={labelClass}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Please enter your name"
            className={inputClass}
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>}
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Please enter your email"
            className={inputClass}
          />
          {fieldErrors.email && <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>}
        </div>

        <div>
          <label className={labelClass}>Country of Residence</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={selectClass}
          >
            <option value="">-Coming From Country-</option>
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {fieldErrors.country && <p className="mt-1 text-xs text-red-600">{fieldErrors.country}</p>}
        </div>

        <div>
          <label className={labelClass}>Phone</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={isd}
              onChange={(e) => setIsd(e.target.value)}
              placeholder="ISD"
              aria-label="ISD code"
              className="w-20 rounded-lg border border-gray-300 px-2 py-2 text-sm outline-none focus:border-primary"
            />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
          {fieldErrors.phone && <p className="mt-1 text-xs text-red-600">{fieldErrors.phone}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Arrival Date</label>
            <input
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Duration</label>
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className={selectClass}
            >
              <option value="">Days</option>
              {DURATION_DAYS.map((day) => (
                <option key={day} value={String(day)}>
                  {day} {day === 1 ? "Day" : "Days"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Adults</label>
            <select value={adults} onChange={(e) => setAdults(e.target.value)} className={selectClass}>
              {TRAVELLER_COUNTS.slice(1).map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
            {fieldErrors.adults && <p className="mt-1 text-xs text-red-600">{fieldErrors.adults}</p>}
          </div>
          <div>
            <label className={labelClass}>Children</label>
            <select
              value={children}
              onChange={(e) => setChildren(e.target.value)}
              className={selectClass}
            >
              {TRAVELLER_COUNTS.map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Dest. of Interest</label>
          <select
            value={destinationInterest}
            onChange={(e) => setDestinationInterest(e.target.value)}
            className={selectClass}
          >
            <option value="">Select Destination</option>
            {DESTINATION_OPTIONS.map((dest) => (
              <option key={dest} value={dest}>
                {dest}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass}>Other Specific Requirement</label>
          <textarea
            value={otherRequirements}
            onChange={(e) => setOtherRequirements(e.target.value)}
            rows={3}
            className={`${inputClass} resize-y`}
          />
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
            Your Area of Interest
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">OPTIONAL</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {INTEREST_AREAS.map((area) => (
              <label key={area} className="flex cursor-pointer items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={interests.includes(area)}
                  onChange={() => toggleInterest(area)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span>{area}</span>
              </label>
            ))}
          </div>
        </div>

        {captcha ? (
          <div>
            <label className={labelClass}>
              Human Verification: What is {captcha.a}+{captcha.b}?
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={captchaInput}
              onChange={(e) => setCaptchaInput(e.target.value)}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary"
            />
            {fieldErrors.captcha && <p className="mt-1 text-xs text-red-600">{fieldErrors.captcha}</p>}
          </div>
        ) : null}

        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        {success && <p className="text-sm text-green-700">{success}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-[#1a2744] py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#243358] disabled:opacity-60"
        >
          {loading ? "Sending…" : "Plan My Holidays"}
        </button>
      </form>
    </div>
  );
}
