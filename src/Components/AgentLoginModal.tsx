"use client";
import { useState } from "react";
import PasswordInput from "./PasswordInput";

interface AgentLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (agent: any) => void;
}

// ── Dummy Agent API ──────────────────────────────────────────────
const DUMMY_AGENTS: Record<string, any> = {
  AGT001: { agentCode: "AGT001", password: "agent123", name: "Rahul Sharma",    agency: "Skyline Travels",     email: "rahul@skyline.com",  phone: "+91 98765 43210", tier: "Gold",     commission: 8, totalBookings: 142, totalRevenue: 2450000 },
  AGT002: { agentCode: "AGT002", password: "pass456",  name: "Priya Menon",     agency: "Horizon Tours",       email: "priya@horizon.com",  phone: "+91 87654 32109", tier: "Platinum", commission: 10,totalBookings: 287, totalRevenue: 5120000 },
  AGT003: { agentCode: "AGT003", password: "vivance1", name: "Amit Patel",      agency: "TravelEase India",    email: "amit@travelease.com",phone: "+91 76543 21098", tier: "Silver",   commission: 6, totalBookings: 68,  totalRevenue: 980000  },
};

const agentLogin = (agentCode: string, password: string): Promise<{ success: boolean; agent?: any; message?: string }> =>
  new Promise((resolve) => {
    setTimeout(() => {
      const agent = DUMMY_AGENTS[agentCode.toUpperCase()];
      if (agent && agent.password === password) {
        const { password: _p, ...safeAgent } = agent;
        resolve({ success: true, agent: safeAgent });
      } else {
        resolve({ success: false, message: "Invalid Agent Code or Password." });
      }
    }, 800);
  });
// ────────────────────────────────────────────────────────────────

export default function AgentLoginModal({ isOpen, onClose, onLoginSuccess }: AgentLoginModalProps) {
  const [agentCode, setAgentCode] = useState("");
  const [password, setPassword]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await agentLogin(agentCode.trim(), password);
    if (result.success && result.agent) {
      localStorage.setItem("agent", JSON.stringify(result.agent));
      onLoginSuccess(result.agent);
      onClose();
    } else {
      setError(result.message || "Login failed.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="bg-primary px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-white text-xl font-bold">Agent Login</h2>
            <p className="text-white/80 text-sm mt-0.5">Access your agent dashboard</p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6">
          {/* Demo hint */}
          <div className="mb-5 p-3 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
            <span className="font-bold">Demo credentials:</span> Code <code className="bg-orange-100 px-1 rounded">AGT001</code> · Password <code className="bg-orange-100 px-1 rounded">agent123</code>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Agent Code</label>
              <input
                value={agentCode}
                onChange={e => setAgentCode(e.target.value)}
                placeholder="e.g. AGT001"
                required
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                required
                className="border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-primary-dark disabled:opacity-60 transition-colors"
            >
              {loading ? "Verifying..." : "Login as Agent"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
