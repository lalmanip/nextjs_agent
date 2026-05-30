"use client";

import { useState } from "react";

const OG = "#FC6603";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setStatus("error");
      setMessage("Please enter your email address");
      return;
    }

    if (!validateEmail(email)) {
      setStatus("error");
      setMessage("Please enter a valid email address");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      console.log("\n========== FORGOT PASSWORD RESPONSE ==========");
      console.log("Status Code:", response.status);
      console.log("Response:", JSON.stringify(data, null, 2));
      console.log("============================================\n");

      if (response.ok && data.status === "success") {
        setStatus("success");
        setMessage(data.message || "If an account exists, a reset link has been sent");
        setEmail("");
        setTimeout(() => {
          onClose();
          setStatus("idle");
          setMessage("");
        }, 3000);
      } else {
        setStatus("success");
        setMessage(data.message || "If an account exists, a reset link has been sent");
        setEmail("");
        setTimeout(() => {
          onClose();
          setStatus("idle");
          setMessage("");
        }, 3000);
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      setStatus("success");
      setMessage("If an account exists, a reset link has been sent");
      setEmail("");
      setTimeout(() => {
        onClose();
        setStatus("idle");
        setMessage("");
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div
          className="px-6 py-5 text-white flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${OG} 0%, #ff8c38 100%)` }}
        >
          <h2 className="text-xl font-bold">Forgot Password?</h2>
          <button
            onClick={onClose}
            className="text-white hover:opacity-80 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status Messages */}
          {status === "success" && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <h3 className="font-semibold text-green-800">Success!</h3>
                  <p className="text-sm text-green-700 mt-1">{message}</p>
                </div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-red-800">Error</h3>
                  <p className="text-sm text-red-700 mt-1">{message}</p>
                </div>
              </div>
            </div>
          )}

          {status !== "success" && (
            <>
              {/* Description */}
              <p className="text-sm text-gray-600">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {/* Email Input */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all"
                  style={{
                    boxShadow: email ? `0 0 0 2px ${OG}33` : "none",
                  }}
                  disabled={loading}
                  onKeyPress={(e) => {
                    if (e.key === "Enter" && !loading) {
                      handleForgotPassword();
                    }
                  }}
                />
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-xs text-blue-800">
                  💡 <span className="font-semibold">Tip:</span> Check your spam folder if you don't see the email within a few minutes.
                </p>
              </div>

              {/* Send Button */}
              <button
                onClick={handleForgotPassword}
                disabled={loading || !email}
                className="w-full py-3 rounded-xl font-bold text-white text-base transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: `linear-gradient(90deg, ${OG}, #ff8c38)`,
                }}
              >
                {loading ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: `white white white transparent` }}
                    />
                    Sending...
                  </>
                ) : (
                  <>📧 Send Reset Link</>
                )}
              </button>

              {/* Cancel Button */}
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full py-2 rounded-xl font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
