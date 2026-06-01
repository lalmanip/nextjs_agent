"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authAPI } from "@/lib/api";

export default function AgentLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const registered = params.get("registered") === "1";

  const [form, setForm] = useState({ userName: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authAPI.signIn({ userName: form.userName, password: form.password });
      if (result?.status === "success" && result?.response) {
        localStorage.setItem("user", JSON.stringify(result.response));
        router.push("/");
      } else {
        setError(result?.message || "Invalid credentials. Please try again.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-8">
        <div className="mb-6 text-center">
          <span className="text-3xl">✈️</span>
          <h1 className="mt-1 text-2xl font-bold tracking-wide text-gray-900">Vivance Travel</h1>
          <p className="text-sm text-primary">Agent Portal — B2B</p>
        </div>

        {registered && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700 text-center">
            Account created successfully! Please sign in.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              User Name <span className="text-red-500">*</span>
            </label>
            <input
              name="userName" type="text" value={form.userName} onChange={handleChange}
              placeholder="your_username" required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              name="password" type="password" value={form.password} onChange={handleChange}
              placeholder="••••••••" required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-60 transition-colors py-2.5 font-semibold text-white"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-gray-600">
          New to Vivance?{" "}
          <a href="/agent/signup" className="font-semibold text-primary hover:underline">
            Create an Account
          </a>
        </p>
      </div>
    </main>
  );
}
