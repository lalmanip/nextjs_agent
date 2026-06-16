"use client";

import { useEffect, useState } from "react";
import {
  fetchWalletLedger,
  formatWalletAmount,
  formatWalletDateTime,
  submitCreditLimitRequest,
  submitSettlementRequest,
  submitTopupRequest,
  type WalletLedgerEntry,
} from "@/lib/agentWallet";

type Tab = "topup" | "settlement" | "credit-limit" | "ledger";

interface AgentWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | string;
  performedByUserId: number | string;
  onWalletUpdated?: () => void;
}

const TABS: { id: Tab; label: string }[] = [
  { id: "topup", label: "Top-up Request" },
  { id: "settlement", label: "Settlement Request" },
  { id: "credit-limit", label: "Credit Limit Request" },
  { id: "ledger", label: "Ledger View" },
];

export default function AgentWalletModal({
  isOpen,
  onClose,
  userId,
  performedByUserId,
  onWalletUpdated,
}: AgentWalletModalProps) {
  const [tab, setTab] = useState<Tab>("topup");
  const [amount, setAmount] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTab("topup");
    setAmount("");
    setCreditLimit("");
    setDescription("");
    setMessage("");
    setError("");
    setLedger([]);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || tab !== "ledger") return;
    setLedgerLoading(true);
    setError("");
    fetchWalletLedger(userId)
      .then(setLedger)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load ledger");
        setLedger([]);
      })
      .finally(() => setLedgerLoading(false));
  }, [isOpen, tab, userId]);

  if (!isOpen) return null;

  const resetForm = () => {
    setAmount("");
    setCreditLimit("");
    setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");
    try {
      let result;
      if (tab === "topup") {
        const val = Number(amount);
        if (!val || val <= 0) throw new Error("Enter a valid top-up amount.");
        if (!description.trim()) throw new Error("Description is required.");
        result = await submitTopupRequest(userId, performedByUserId, val, description.trim());
      } else if (tab === "settlement") {
        const val = Number(amount);
        if (!val || val <= 0) throw new Error("Enter a valid settlement amount.");
        if (!description.trim()) throw new Error("Description is required.");
        result = await submitSettlementRequest(userId, performedByUserId, val, description.trim());
      } else if (tab === "credit-limit") {
        const val = Number(creditLimit);
        if (!val || val <= 0) throw new Error("Enter a valid credit limit.");
        if (!description.trim()) throw new Error("Description is required.");
        result = await submitCreditLimitRequest(userId, performedByUserId, val, description.trim());
      } else {
        return;
      }
      setMessage(result.message || "Request submitted successfully.");
      resetForm();
      onWalletUpdated?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Manage Wallet</h2>
            <p className="text-xs text-gray-500">Agent ID: {userId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b px-3 py-2 bg-gray-50">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => { setTab(t.id); setMessage(""); setError(""); }}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-white hover:text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {message && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
              {message}
            </div>
          )}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          {tab === "ledger" ? (
            ledgerLoading ? (
              <p className="text-sm text-gray-500">Loading ledger…</p>
            ) : ledger.length === 0 ? (
              <p className="text-sm text-gray-500">No ledger entries found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-gray-500">
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Balance</th>
                      <th className="py-2 pr-3">Due</th>
                      <th className="py-2 pr-3">Description</th>
                      <th className="py-2">Ref</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <tr key={row.id} className="border-b border-gray-100">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatWalletDateTime(row.createdDatetime)}</td>
                        <td className="py-2 pr-3 font-medium">{row.transactionType}</td>
                        <td className="py-2 pr-3">{formatWalletAmount(row.amount)}</td>
                        <td className="py-2 pr-3">{formatWalletAmount(row.balanceAfter)}</td>
                        <td className="py-2 pr-3">{formatWalletAmount(row.dueAmountAfter)}</td>
                        <td className="py-2 pr-3 max-w-[160px] truncate" title={row.description ?? ""}>
                          {row.description || "—"}
                        </td>
                        <td className="py-2 max-w-[120px] truncate" title={row.appReference ?? ""}>
                          {row.appReference || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
              {tab !== "credit-limit" ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter amount"
                  />
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    Credit Limit <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Enter new credit limit"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={
                    tab === "topup"
                      ? "e.g. Bank transfer ref XYZ"
                      : tab === "settlement"
                        ? "e.g. NEFT payment"
                        : "e.g. Limit increased after review"
                  }
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-60"
              >
                {loading ? "Submitting…" : "Submit Request"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
