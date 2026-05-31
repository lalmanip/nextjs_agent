"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { authAPI } from "@/lib/api";

function SignInForm() {
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
    <main className="flex min-h-screen items-center justify-center px-4 bg-gradient-to-br from-orange-950 via-orange-900 to-stone-900">
      <div className="w-full max-w-md rounded-2xl bg-white/10 backdrop-blur-md shadow-2xl p-8 text-white">
        <div className="mb-6 text-center">
          <span className="text-3xl">✈️</span>
          <h1 className="mt-1 text-2xl font-bold tracking-wide">Vivance Travel</h1>
          <p className="text-sm text-brand-light">Agent Portal — B2B</p>
        </div>

        {registered && (
          <div className="mb-4 rounded-lg bg-green-500/20 border border-green-400/40 px-4 py-2 text-sm text-green-300 text-center">
            Account created successfully! Please sign in.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-400/40 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-brand-light mb-1">
              User Name <span className="text-red-400">*</span>
            </label>
            <input
              name="userName" type="text" value={form.userName} onChange={handleChange}
              placeholder="your_username" required
              className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-light mb-1">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              name="password" type="password" value={form.password} onChange={handleChange}
              placeholder="••••••••" required
              className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-brand hover:bg-brand-light disabled:opacity-60 transition-colors py-2.5 font-semibold text-white"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-brand-light">
          New to Vivance?{" "}
          <a href="/agent/signup" className="font-semibold text-white hover:underline">
            Create an Account
          </a>
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
