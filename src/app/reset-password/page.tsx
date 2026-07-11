"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";

const OG = "#FC6603";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid reset link. Token not found.");
    }
  }, [token]);

  const validatePassword = () => {
    if (!password.trim()) {
      setMessage("Please enter a new password");
      return false;
    }
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters long");
      return false;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleResetPassword = async () => {
    if (!validatePassword()) {
      setStatus("error");
      return;
    }

    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pwdToken: token,
          password: password,
        }),
      });

      const data = await response.json();

      console.log("\n========== RESET PASSWORD RESPONSE ==========");
      console.log("Status Code:", response.status);
      console.log("Response:", JSON.stringify(data, null, 2));
      console.log("===========================================\n");

      if (response.ok && (data.status === "success" || data.message)) {
        setStatus("success");
        setMessage(
          data.message || "Password reset successfully! Redirecting to login...",
        );
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setStatus("error");
        setMessage(
          data.message ||
            data.error ||
            "Failed to reset password. Please try again.",
        );
      }
    } catch (error) {
      console.error("Reset password error:", error);
      setStatus("error");
      setMessage("An error occurred. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center">
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Invalid Link</h1>
            <p className="text-gray-600 mb-6">
              The reset link is invalid or has expired. Please request a new password reset link.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 rounded-xl font-bold text-white transition-all hover:opacity-90"
              style={{ background: `linear-gradient(90deg, ${OG}, #ff8c38)` }}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div
          className="px-8 py-6 text-white"
          style={{ background: `linear-gradient(135deg, ${OG} 0%, #ff8c38 100%)` }}
        >
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-sm opacity-90 mt-1">Enter your new password below</p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
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
              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all"
                    style={{
                      boxShadow: password ? `0 0 0 2px ${OG}33` : "none",
                    }}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? "👁️" : "👁️🗨️"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Minimum 8 characters required
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password *
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none transition-all"
                  style={{
                    boxShadow: confirmPassword ? `0 0 0 2px ${OG}33` : "none",
                  }}
                  disabled={loading}
                />
              </div>

              {/* Password Requirements */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-900 mb-2">
                  Password Requirements:
                </p>
                <ul className="text-xs text-blue-800 space-y-1">
                  <li className={password.length >= 8 ? "text-green-600" : ""}>
                    ✓ At least 8 characters
                  </li>
                  <li
                    className={
                      password && confirmPassword && password === confirmPassword
                        ? "text-green-600"
                        : ""
                    }
                  >
                    ✓ Passwords match
                  </li>
                </ul>
              </div>

              {/* Reset Button */}
              <button
                onClick={handleResetPassword}
                disabled={loading || !password || !confirmPassword}
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
                    Resetting...
                  </>
                ) : (
                  <>🔐 Reset Password</>
                )}
              </button>

              {/* Back to Login */}
              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Remember your password?{" "}
                  <button
                    onClick={() => router.push("/")}
                    className="font-semibold hover:underline"
                    style={{ color: OG }}
                  >
                    Back to Login
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
