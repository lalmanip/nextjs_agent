"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authAPI } from "@/lib/api";
import { useAgentPortalSignupUrl } from "@/Components/AgentPortalConfigProvider";
import { getUserSession, setUserSession } from "@/lib/authSession";

export default function AgentLoginForm() {
  const params = useSearchParams();
  const registered = params.get("registered") === "1";
  const agentPortalSignupUrl = useAgentPortalSignupUrl();

  const [form, setForm] = useState({ userName: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const session = getUserSession();
    if (!session) return;
    setUserSession(session);
    window.location.href = "/";
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await authAPI.signIn({ userName: form.userName, password: form.password });
      if (result?.status === "success" && result?.response) {
        setUserSession({
          ...result.response,
          ...(typeof result.accessToken === "string" && result.accessToken.trim()
            ? { accessToken: result.accessToken.trim() }
            : {}),
        });
        window.location.href = "/";
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
    <main className="agent-auth-screen">
      <div className="agent-auth-card">
        <div className="mb-6 text-center">
          <span className="text-3xl">✈️</span>
          <h1 className="mt-1 text-2xl font-bold tracking-wide">Vivance Travel</h1>
          <p className="agent-auth-subtitle">Agent Portal — B2B</p>
        </div>

        {registered && (
          <div className="mb-4 rounded-lg bg-green-500/20 border border-green-400/40 px-4 py-2 text-sm text-green-300 text-center">
            Account submitted successfully. Please wait for 48 hours for approval
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-400/40 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="agent-auth-label">
              User Name <span className="text-red-400">*</span>
            </label>
            <input
              name="userName" type="text" value={form.userName} onChange={handleChange}
              placeholder="your_username" required
              className="agent-auth-input"
            />
          </div>
          <div>
            <label className="agent-auth-label">
              Password <span className="text-red-400">*</span>
            </label>
            <input
              name="password" type="password" value={form.password} onChange={handleChange}
              placeholder="••••••••" required
              className="agent-auth-input"
            />
          </div>
          <button
            type="submit" disabled={loading}
            className="agent-auth-btn"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-5 text-center text-xs agent-auth-subtitle">
          New to Vivance?{" "}
          {agentPortalSignupUrl ? (
            <a href={agentPortalSignupUrl} className="font-semibold text-white hover:underline">
              Create an Account
            </a>
          ) : (
            <span className="text-white/50">Create an Account (portal not configured)</span>
          )}
        </p>
      </div>
    </main>
  );
}
