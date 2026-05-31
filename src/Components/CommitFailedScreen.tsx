"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

const OG = "#FC6603";

interface PaymentProof {
  gateway: "razorpay" | "hdfc";
  payId?: string;
  orderId?: string;
}

interface CommitFailedScreenProps {
  paymentProof: PaymentProof;
  amountPaid: number;
  leadPassengerName: string;
  /** Booking reference from a partially-committed booking (outbound leg), when available. */
  appReference?: string;
  /** Airline PNR captured before ticketing failed, when available. */
  partialPnr?: string;
  /** Backend validatePayment response (validationResult, status, etc.). */
  paymentValidation?: any;
  /** ISO timestamp of when the failure was recorded. */
  failedAt?: string;
  errorMessage?: string;
  onHome: () => void;
}

const fmt = new Intl.NumberFormat("en-IN");

function DetailRow({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500 flex-shrink-0">{label}</span>
      <span
        className={`text-right break-all ${mono ? "font-mono text-xs font-semibold text-gray-800" : "font-medium text-gray-800"} ${valueClass || ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function readUserFromStorage(): any | null {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function CommitFailedScreen({
  paymentProof,
  amountPaid,
  leadPassengerName,
  appReference,
  partialPnr,
  paymentValidation,
  failedAt,
  errorMessage,
  onHome,
}: CommitFailedScreenProps) {
  const router = useRouter();
  const [paymentDetails, setPaymentDetails] = useState<any>(null);
  const [fetchingDetails, setFetchingDetails] = useState(false);

  useEffect(() => {
    if (paymentProof.gateway === "razorpay" && paymentProof.payId) {
      setFetchingDetails(true);
      fetch(`/api/payment/fetch-payment?payId=${paymentProof.payId}`)
        .then((r) => r.json())
        .then((data) => setPaymentDetails(data))
        .catch(() => {
          /* non-fatal — we already know payment succeeded */
        })
        .finally(() => setFetchingDetails(false));
    }
  }, [paymentProof]);

  const goToMyBookings = () => {
    const u = readUserFromStorage();
    if (u && (u.email || u.id || u.userId)) {
      router.push("/dashboard?tab=bookings");
      return;
    }
    window.alert(
      "Please sign up or sign in using the same email address you used for this booking. " +
        "After signing in, open My Bookings from your profile (top-right). You will be taken to the home page now.",
    );
    router.push("/");
  };

  const methodLabel = () => {
    if (!paymentDetails) return null;
    const m = paymentDetails.method;
    if (m === "card" && paymentDetails.card) {
      return `${paymentDetails.card.network} ${paymentDetails.card.type} ····${paymentDetails.card.last4}`;
    }
    if (m === "upi") return `UPI (${paymentDetails.vpa || "—"})`;
    if (m === "netbanking") return `Net Banking (${paymentDetails.bank || "—"})`;
    if (m === "wallet") return `Wallet (${paymentDetails.wallet || "—"})`;
    return m;
  };

  const gatewayLabel = paymentProof.gateway === "razorpay" ? "Razorpay" : "HDFC";

  // Verification result returned by the backend validatePayment call (both gateways).
  const verification: string | null =
    paymentValidation?.validationResult ||
    paymentValidation?.ValidationResult ||
    paymentValidation?.status ||
    null;
  const verificationIsValid = String(verification || "").toUpperCase() === "VALID";

  // Payment method: Razorpay exposes rich detail via fetch-payment; HDFC has no such API here.
  const resolvedMethod: string | null =
    paymentProof.gateway === "razorpay" ? methodLabel() : "HDFC Payment Gateway";

  // Payment status: Razorpay reports gateway status; HDFC derives from verification result.
  const resolvedStatus: string | null =
    paymentProof.gateway === "razorpay"
      ? paymentDetails?.status ?? null
      : verification
        ? verificationIsValid
          ? "verified"
          : verification
        : null;
  const statusIsGood =
    resolvedStatus === "captured" || resolvedStatus === "verified";

  let failedAtLabel: string | null = null;
  if (failedAt) {
    const d = new Date(failedAt);
    failedAtLabel = Number.isNaN(d.getTime()) ? null : d.toLocaleString("en-IN");
  }

  // Best single identifier for support to locate the payment/booking.
  const supportRef =
    appReference || paymentProof.payId || paymentProof.orderId || "—";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Status card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4">
          {/* Header */}
          <div className="px-6 py-5" style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 100%)" }}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <div className="text-white font-bold text-lg">Booking Confirmation Failed</div>
                <div className="text-blue-200 text-sm">Your payment was successful — your money is safe</div>
              </div>
            </div>
          </div>

          {/* Payment confirmed banner */}
          <div className="px-6 py-4 border-b" style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-green-600 text-lg">✅</span>
              <span className="font-semibold text-green-800">Payment Confirmed</span>
            </div>
            <div className="text-2xl font-black text-green-700">₹{fmt.format(amountPaid)}</div>
            <div className="text-xs text-green-600 mt-0.5">
              {paymentProof.gateway === "razorpay" ? "Captured by Razorpay" : "Captured by HDFC"}
            </div>
          </div>

          {/* Payment details */}
          <div className="px-6 py-4 space-y-3 text-sm border-b border-gray-100">
            <DetailRow label="Passenger" value={leadPassengerName} />
            <DetailRow label="Payment Gateway" value={gatewayLabel} />
            {paymentProof.payId && (
              <DetailRow label="Payment ID" value={paymentProof.payId} mono />
            )}
            {paymentProof.orderId && (
              <DetailRow label="Order ID" value={paymentProof.orderId} mono />
            )}
            {appReference && (
              <DetailRow label="Booking Reference" value={appReference} mono />
            )}
            {partialPnr && (
              <DetailRow label="Airline PNR" value={partialPnr} mono />
            )}
            {fetchingDetails && (
              <div className="text-gray-400 text-xs">Fetching payment details…</div>
            )}
            {resolvedMethod && (
              <DetailRow label="Payment Method" value={resolvedMethod} />
            )}
            {resolvedStatus && (
              <DetailRow
                label="Payment Status"
                value={resolvedStatus}
                valueClass={`font-semibold capitalize ${statusIsGood ? "text-green-600" : "text-yellow-600"}`}
              />
            )}
            {paymentProof.gateway === "razorpay" && verification && (
              <DetailRow
                label="Verification"
                value={verification}
                valueClass={`font-semibold capitalize ${verificationIsValid ? "text-green-600" : "text-yellow-600"}`}
              />
            )}
            {failedAtLabel && (
              <DetailRow label="Failed At" value={failedAtLabel} valueClass="text-gray-600" />
            )}
          </div>

          {/* What happened */}
          <div className="px-6 py-4 border-b border-gray-100 bg-amber-50">
            <div className="text-xs font-semibold text-amber-800 mb-1">What happened?</div>
            <div className="text-xs text-amber-700 leading-relaxed">
              Your payment went through successfully, but we encountered a temporary issue while confirming your booking with the airline. This sometimes happens due to a network timeout. Your money has <strong>not</strong> been lost.
            </div>
            {errorMessage && (
              <div className="mt-3 pt-3 border-t border-amber-200">
                <div className="text-xs font-semibold text-amber-800 mb-1">
                  Error Details <span className="font-normal text-amber-600">(share with support)</span>
                </div>
                <div className="font-mono text-xs text-amber-900 bg-amber-100 rounded px-2 py-1.5 break-words whitespace-pre-wrap select-all">
                  {errorMessage}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 py-4 space-y-3">
            <button
              type="button"
              onClick={goToMyBookings}
              className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-95"
              style={{ backgroundColor: OG }}
            >
              Go to My Bookings
            </button>
            <button
              type="button"
              onClick={onHome}
              className="w-full py-2.5 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              Go to Home
            </button>
          </div>
        </div>

        {/* Support card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4">
          <div className="font-semibold text-gray-700 mb-2 text-sm">📞 Need help?</div>
          <div className="text-xs text-gray-500 leading-relaxed">
            Please save your <strong>Support Reference: {supportRef}</strong> and contact our support team. We can locate your payment and manually confirm the booking.
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            <a href="mailto:bookings@vivancetravels.com" className="text-blue-600 underline">
              bookings@vivancetravels.com
            </a>
            <span className="text-gray-400">·</span>
            <span className="text-gray-600">+91 91610-77111</span>
          </div>
        </div>
      </div>
    </div>
  );
}
