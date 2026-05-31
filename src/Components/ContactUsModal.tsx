"use client";

import { useEffect, useState } from "react";
import { validateEmail, validateName, validatePhone } from "@/utils/validation";

const OG = "#FC6603";

export type ContactPurpose = "customer service" | "business with us";

interface ContactUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  place: "",
  purpose: "customer service" as ContactPurpose,
  message: "",
};

export default function ContactUsModal({ isOpen, onClose }: ContactUsModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ message: string; id?: number; enqDate?: string } | null>(
    null,
  );
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setFieldErrors({});
    setSubmitError("");
    setSuccess(null);
    try {
      const saved = localStorage.getItem("user");
      if (!saved) return;
      const user = JSON.parse(saved);
      setForm((prev) => ({
        ...prev,
        name:
          [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
          String(user?.name ?? "").trim() ||
          prev.name,
        email: String(user?.email ?? "").trim() || prev.email,
        phone: String(user?.phone ?? user?.mobile ?? "").replace(/\D/g, "").slice(-10) || prev.phone,
        place:
          [user?.city, user?.state].filter(Boolean).join(", ").trim() ||
          String(user?.city ?? "").trim() ||
          prev.place,
      }));
    } catch {
      /* ignore */
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const setField = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const validateClient = (): boolean => {
    const next: Record<string, string> = {};
    const nameErr = validateName(form.name, "Name");
    if (nameErr) next.name = nameErr;
    const emailErr = validateEmail(form.email);
    if (emailErr) next.email = emailErr;
    const phoneErr = validatePhone(form.phone);
    if (phoneErr) next.phone = phoneErr;
    if (!form.place.trim()) next.place = "Place / city is required";
    if (!form.message.trim()) next.message = "Please describe your question or concern";
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    if (!validateClient()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/b2c-enquiry/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const apiErrors = Array.isArray(data?.errors) ? data.errors : [];
        if (apiErrors.length > 0) {
          const mapped: Record<string, string> = {};
          for (const err of apiErrors) {
            if (err?.field && err?.message) mapped[String(err.field)] = String(err.message);
          }
          setFieldErrors(mapped);
        }
        setSubmitError(data?.error || data?.message || "Could not submit your enquiry. Please try again.");
        return;
      }

      const resp = data?.response ?? {};
      setSuccess({
        message: String(data?.message || "Enquiry submitted successfully"),
        id: resp?.id != null ? Number(resp.id) : undefined,
        enqDate: resp?.enqDate ? String(resp.enqDate) : undefined,
      });
      setForm(EMPTY_FORM);
    } catch {
      setSubmitError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-us-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div
          className="px-6 py-5 flex items-center justify-between shrink-0"
          style={{ background: `linear-gradient(90deg, ${OG}, #ff8c38)` }}
        >
          <div>
            <h2 id="contact-us-title" className="text-white text-xl font-bold">
              Contact Us
            </h2>
            <p className="text-white/90 text-sm mt-0.5">We&apos;ll get back to you as soon as we can</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-white/80 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {success ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✓</div>
              <p className="text-lg font-semibold text-gray-800 mb-2">{success.message}</p>
              {success.id != null && (
                <p className="text-sm text-gray-600">
                  Reference ID: <span className="font-medium">{success.id}</span>
                </p>
              )}
              {success.enqDate && (
                <p className="text-sm text-gray-500 mt-1">
                  Submitted: {new Date(success.enqDate).toLocaleString()}
                </p>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="mt-6 w-full py-2.5 rounded-lg text-white font-semibold"
                style={{ background: OG }}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {submitError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    fieldErrors.name ? "border-red-400" : "border-gray-300"
                  }`}
                  autoComplete="name"
                />
                {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      fieldErrors.email ? "border-red-400" : "border-gray-300"
                    }`}
                    autoComplete="email"
                  />
                  {fieldErrors.email && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setField("phone", e.target.value.replace(/[^\d\s\-()]/g, ""))}
                    className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      fieldErrors.phone ? "border-red-400" : "border-gray-300"
                    }`}
                    autoComplete="tel"
                  />
                  {fieldErrors.phone && (
                    <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Place / City *</label>
                <input
                  type="text"
                  value={form.place}
                  onChange={(e) => setField("place", e.target.value)}
                  placeholder="e.g. Mumbai"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                    fieldErrors.place ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {fieldErrors.place && <p className="text-xs text-red-500 mt-1">{fieldErrors.place}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
                <select
                  value={form.purpose}
                  onChange={(e) => setField("purpose", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
                >
                  <option value="customer service">Customer service</option>
                  <option value="business with us">Business with us</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                <textarea
                  value={form.message}
                  onChange={(e) => setField("message", e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="How can we help you?"
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-y ${
                    fieldErrors.message ? "border-red-400" : "border-gray-300"
                  }`}
                />
                {fieldErrors.message && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-white font-semibold disabled:opacity-60"
                style={{ background: OG }}
              >
                {loading ? "Submitting…" : "Submit enquiry"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
