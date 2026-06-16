"use client";

import { useCallback, useEffect, useState } from "react";

const OG = "#FC6603";

type MarkupRule = {
  id: number;
  ruleScope: string;
  userOid?: number | null;
  productType: string;
  tripType?: string | null;
  airlineCode?: string | null;
  markupType: string;
  markupValue: number;
  maxMarkupAmount?: number | null;
  priority?: number;
  channel?: string;
  status?: string;
  description?: string;
};

type AgentMarkupPanelProps = {
  userId: number | string;
};

export default function AgentMarkupPanel({ userId }: AgentMarkupPanelProps) {
  const [rules, setRules] = useState<MarkupRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [productType, setProductType] = useState("FLIGHT");
  const [tripType, setTripType] = useState("ALL");
  const [markupType, setMarkupType] = useState("PERCENT");
  const [markupValue, setMarkupValue] = useState("5");
  const [maxMarkup, setMaxMarkup] = useState("");
  const [description, setDescription] = useState("");

  const [quoteBase, setQuoteBase] = useState("15000");
  const [quoteTrip, setQuoteTrip] = useState("DOMESTIC");
  const [quoteResult, setQuoteResult] = useState<Record<string, unknown> | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/markup/rules/agent/${encodeURIComponent(String(userId))}`);
      const data = await res.json();
      if (!res.ok || data?.status === "failed") {
        throw new Error(data?.message || `Failed to load markup rules (${res.status})`);
      }
      setRules(Array.isArray(data?.response) ? data.response : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load markup rules");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleCreate = async () => {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = {
        ruleScope: "AGENT",
        userOid: Number(userId),
        productType,
        tripType,
        markupType,
        markupValue: Number(markupValue),
        maxMarkupAmount: maxMarkup.trim() ? Number(maxMarkup) : null,
        channel: "B2B",
        description: description.trim() || null,
        createdById: Number(userId),
      };
      const res = await fetch("/api/markup/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data?.status === "failed") {
        throw new Error(data?.message || "Failed to save markup rule");
      }
      setMessage("Markup rule saved.");
      setDescription("");
      await loadRules();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save markup rule");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (ruleId: number) => {
    if (!confirm("Deactivate this markup rule?")) return;
    setError("");
    try {
      const res = await fetch(
        `/api/markup/rules/${ruleId}?actorUserId=${encodeURIComponent(String(userId))}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (!res.ok || data?.status === "failed") {
        throw new Error(data?.message || "Failed to deactivate rule");
      }
      setMessage("Rule deactivated.");
      await loadRules();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to deactivate rule");
    }
  };

  const handleQuote = async () => {
    setQuoteResult(null);
    setError("");
    try {
      const res = await fetch("/api/markup/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userOid: Number(userId),
          channel: "B2B",
          productType: "FLIGHT",
          tripType: quoteTrip,
          baseFare: Number(quoteBase),
          actorUserId: Number(userId),
        }),
      });
      const data = await res.json();
      if (!res.ok || data?.status === "failed") {
        throw new Error(data?.message || "Quote failed");
      }
      setQuoteResult(data?.response ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Quote failed");
    }
  };

  const inputCls =
    "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-200";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">Markup Settings</h2>
        <p className="text-sm text-gray-500 mt-1">
          View platform defaults and set your own B2B markup on flight fares. Lower priority numbers
          apply first when multiple rules match.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {error}
        </div>
      )}
      {message && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
          {message}
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Try markup on a sample fare</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Base fare (INR)</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              value={quoteBase}
              onChange={(e) => setQuoteBase(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trip type</label>
            <select
              className={inputCls}
              value={quoteTrip}
              onChange={(e) => setQuoteTrip(e.target.value)}
            >
              <option value="DOMESTIC">Domestic</option>
              <option value="INTERNATIONAL">International</option>
              <option value="ALL">All</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleQuote}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: OG }}
          >
            Calculate
          </button>
        </div>
        {quoteResult && (
          <div className="mt-3 text-sm text-gray-700 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-gray-500">Markup</span>
              <div className="font-semibold">₹{String(quoteResult.markupAmount ?? "0")}</div>
            </div>
            <div>
              <span className="text-gray-500">Total fare</span>
              <div className="font-semibold">₹{String(quoteResult.fareAfterMarkup ?? "0")}</div>
            </div>
            <div>
              <span className="text-gray-500">Rule</span>
              <div className="font-semibold">#{String(quoteResult.ruleId ?? "—")}</div>
            </div>
            <div>
              <span className="text-gray-500">Scope</span>
              <div className="font-semibold">{String(quoteResult.ruleScope ?? "—")}</div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add your markup rule</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
            <select className={inputCls} value={productType} onChange={(e) => setProductType(e.target.value)}>
              <option value="FLIGHT">Flight</option>
              <option value="HOTEL">Hotel</option>
              <option value="ALL">All products</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Trip type</label>
            <select className={inputCls} value={tripType} onChange={(e) => setTripType(e.target.value)}>
              <option value="ALL">All</option>
              <option value="DOMESTIC">Domestic</option>
              <option value="INTERNATIONAL">International</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Markup type</label>
            <select className={inputCls} value={markupType} onChange={(e) => setMarkupType(e.target.value)}>
              <option value="PERCENT">Percent (%)</option>
              <option value="FLAT">Flat (INR)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Value</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              step="0.01"
              value={markupValue}
              onChange={(e) => setMarkupValue(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Max cap (optional)</label>
            <input
              className={inputCls}
              type="number"
              min={0}
              value={maxMarkup}
              onChange={(e) => setMaxMarkup(e.target.value)}
              placeholder="For % markup"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
            <input
              className={inputCls}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Domestic flights"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleCreate}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: OG }}
          >
            {saving ? "Saving…" : "Save agent markup"}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Active rules for your account</h3>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-500">No markup rules found.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-100">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-3 py-2">Scope</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Trip</th>
                  <th className="px-3 py-2">Markup</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{r.ruleScope}</td>
                    <td className="px-3 py-2">{r.productType}</td>
                    <td className="px-3 py-2">{r.tripType || "ALL"}</td>
                    <td className="px-3 py-2">
                      {r.markupType === "PERCENT"
                        ? `${r.markupValue}%${r.maxMarkupAmount ? ` (max ₹${r.maxMarkupAmount})` : ""}`
                        : `₹${r.markupValue}`}
                    </td>
                    <td className="px-3 py-2">{r.priority ?? "—"}</td>
                    <td className="px-3 py-2">{r.description || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {r.ruleScope === "AGENT" && r.status !== "INACTIVE" && (
                        <button
                          type="button"
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => handleDeactivate(r.id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
