"use client";
import { useState } from "react";

interface AgentDashboardProps {
  agent: any;
  onBack: () => void;
}

const OG = "#FC6603";

const RECENT_BOOKINGS = [
  { ref: "VIV-2024-001", client: "Ananya Roy",   route: "DEL → DXB", date: "15 Mar 2025", amount: "₹18,500", status: "Confirmed", commission: "₹1,480" },
  { ref: "VIV-2024-002", client: "Suresh Nair",  route: "BOM → LHR", date: "18 Mar 2025", amount: "₹62,000", status: "Confirmed", commission: "₹4,960" },
  { ref: "VIV-2024-003", client: "Meena Gupta",  route: "BLR → SIN", date: "20 Mar 2025", amount: "₹24,300", status: "Pending",   commission: "₹1,944" },
  { ref: "VIV-2024-004", client: "Rohan Verma",  route: "MAA → KUL", date: "22 Mar 2025", amount: "₹19,800", status: "Confirmed", commission: "₹1,584" },
  { ref: "VIV-2024-005", client: "Deepa Pillai", route: "HYD → CDG", date: "25 Mar 2025", amount: "₹71,500", status: "Cancelled", commission: "₹0" },
];

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Silver:   { bg: "#f3f4f6", text: "#4b5563",  border: "#d1d5db" },
  Gold:     { bg: "#fef9c3", text: "#92400e",  border: "#fbbf24" },
  Platinum: { bg: "#ede9fe", text: "#5b21b6",  border: "#8b5cf6" },
};

export default function AgentDashboard({ agent, onBack }: AgentDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "bookings" | "clients" | "commissions">("overview");

  const tier = TIER_COLORS[agent.tier] || TIER_COLORS.Silver;
  const monthlyCommission = Math.round(agent.totalRevenue * (agent.commission / 100) * 0.08);

  const tabs = [
    { id: "overview",     icon: "🏠", label: "Overview"    },
    { id: "bookings",     icon: "✈️", label: "Bookings"    },
    { id: "clients",      icon: "👥", label: "Clients"     },
    { id: "commissions",  icon: "💰", label: "Commissions" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: "sans-serif" }}>

      {/* Top bar */}
      <div style={{ background: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onBack} style={{ color: OG, fontWeight: 700, background: "none", border: "none", cursor: "pointer", fontSize: 14 }}>← Back</button>
            <span style={{ color: "#d1d5db" }}>|</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#1f2937" }}>Agent Portal</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: tier.bg, color: tier.text, border: `1px solid ${tier.border}` }}>
              {agent.tier} Agent
            </span>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: OG, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15 }}>
              {agent.name[0]}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{agent.name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{agent.agentCode}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px", display: "flex", gap: 18, alignItems: "flex-start" }}>

        {/* Sidebar */}
        <div style={{ width: 200, flexShrink: 0, background: "white", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 16, position: "sticky", top: 80 }}>
          <div style={{ textAlign: "center", paddingBottom: 14, marginBottom: 14, borderBottom: "1px solid #f0f0f0" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: OG, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, margin: "0 auto 8px" }}>
              {agent.name[0]}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{agent.name}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{agent.agency}</div>
            <div style={{ marginTop: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: tier.bg, color: tier.text, border: `1px solid ${tier.border}` }}>
                ★ {agent.tier}
              </span>
            </div>
          </div>
          <nav>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                style={{ width: "100%", textAlign: "left", padding: "9px 12px", borderRadius: 8, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, marginBottom: 3, fontSize: 13, background: activeTab === t.id ? OG : "transparent", color: activeTab === t.id ? "white" : "#374151", fontWeight: activeTab === t.id ? 600 : 400 }}>
                <span>{t.icon}</span><span>{t.label}</span>
              </button>
            ))}
          </nav>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f0f0" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>Commission Rate</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: OG }}>{agent.commission}%</div>
            <button onClick={() => {
              localStorage.removeItem("agent");
              onBack();
            }} style={{ marginTop: 14, width: "100%", padding: "7px 0", border: "1.5px solid #fca5a5", color: "#ef4444", borderRadius: 8, background: "white", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              🚪 Logout
            </button>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div>
              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
                {[
                  { icon: "✈️", label: "Total Bookings",    value: agent.totalBookings,                               color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
                  { icon: "💰", label: "Total Revenue",     value: `₹${(agent.totalRevenue/100000).toFixed(1)}L`,     color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
                  { icon: "🏆", label: "Commission Earned", value: `₹${Math.round(agent.totalRevenue*agent.commission/100).toLocaleString()}`, color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
                  { icon: "📅", label: "This Month",        value: `₹${monthlyCommission.toLocaleString()}`,          color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
                ].map(({ icon, label, value, color, bg, border }) => (
                  <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                    <div style={{ fontSize: 11, color, fontWeight: 500, marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Profile + Quick Actions */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 18 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Agent Profile</h3>
                  {[
                    ["Agent Code", agent.agentCode],
                    ["Agency",     agent.agency],
                    ["Email",      agent.email],
                    ["Phone",      agent.phone],
                    ["Tier",       agent.tier],
                    ["Commission", `${agent.commission}% per booking`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ color: "#9ca3af" }}>{k}</span>
                      <span style={{ fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 18 }}>
                  <h3 style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Quick Actions</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { icon: "✈️", label: "Search & Book Flights",  desc: "Find best fares for clients",   action: onBack  },
                      { icon: "👥", label: "Manage Clients",          desc: "View client profiles",          action: () => setActiveTab("clients") },
                      { icon: "💰", label: "Commission Report",       desc: "Track your earnings",           action: () => setActiveTab("commissions") },
                      { icon: "📋", label: "Recent Bookings",         desc: "View all bookings",             action: () => setActiveTab("bookings") },
                    ].map(({ icon, label, desc, action }) => (
                      <button key={label} onClick={action}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", textAlign: "left" }}>
                        <span style={{ fontSize: 20 }}>{icon}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#1f2937" }}>{label}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BOOKINGS */}
          {activeTab === "bookings" && (
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Recent Bookings</h2>
                <button onClick={onBack} style={{ background: OG, color: "white", border: "none", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  + New Booking
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                      {["Reference", "Client", "Route", "Date", "Amount", "Commission", "Status"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#9ca3af", fontWeight: 600, fontSize: 11, textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RECENT_BOOKINGS.map((b, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: OG }}>{b.ref}</td>
                        <td style={{ padding: "10px 12px" }}>{b.client}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 500 }}>{b.route}</td>
                        <td style={{ padding: "10px 12px", color: "#6b7280" }}>{b.date}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>{b.amount}</td>
                        <td style={{ padding: "10px 12px", color: "#15803d", fontWeight: 600 }}>{b.commission}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: b.status === "Confirmed" ? "#dcfce7" : b.status === "Pending" ? "#fef9c3" : "#fee2e2", color: b.status === "Confirmed" ? "#15803d" : b.status === "Pending" ? "#92400e" : "#dc2626" }}>
                            {b.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CLIENTS */}
          {activeTab === "clients" && (
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 20 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Client Management</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                {[
                  { name: "Ananya Roy",   email: "ananya@gmail.com",  trips: 4, spend: "₹74,000",  initials: "AR" },
                  { name: "Suresh Nair",  email: "suresh@yahoo.com",  trips: 7, spend: "₹1,82,000", initials: "SN" },
                  { name: "Meena Gupta",  email: "meena@outlook.com", trips: 2, spend: "₹48,600",  initials: "MG" },
                  { name: "Rohan Verma",  email: "rohan@gmail.com",   trips: 5, spend: "₹99,000",  initials: "RV" },
                  { name: "Deepa Pillai", email: "deepa@gmail.com",   trips: 3, spend: "₹71,500",  initials: "DP" },
                  { name: "Karan Shah",   email: "karan@yahoo.com",   trips: 6, spend: "₹1,24,000", initials: "KS" },
                ].map(c => (
                  <div key={c.name} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: OG, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>{c.initials}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.email}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                      <span style={{ color: "#6b7280" }}>Trips: <b>{c.trips}</b></span>
                      <span style={{ color: "#6b7280" }}>Total: <b>{c.spend}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* COMMISSIONS */}
          {activeTab === "commissions" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
                {[
                  { label: "Total Earned",    value: `₹${Math.round(agent.totalRevenue * agent.commission / 100).toLocaleString()}`, icon: "💰", color: OG },
                  { label: "This Month",      value: `₹${monthlyCommission.toLocaleString()}`,                                       icon: "📅", color: "#7c3aed" },
                  { label: "Pending Payout",  value: `₹${Math.round(monthlyCommission * 0.3).toLocaleString()}`,                     icon: "⏳", color: "#d97706" },
                ].map(({ label, value, icon, color }) => (
                  <div key={label} style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 18, textAlign: "center" }}>
                    <div style={{ fontSize: 28 }}>{icon}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color, margin: "6px 0" }}>{value}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: "white", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Commission Breakdown</h3>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #f3f4f6" }}>
                      {["Month", "Bookings", "Revenue", `Commission (${agent.commission}%)`, "Status"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", color: "#9ca3af", fontWeight: 600, fontSize: 11, textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { month: "March 2025",    bkgs: 18, rev: "₹3,24,000", comm: `₹${(324000 * agent.commission / 100).toLocaleString()}`, status: "Processing" },
                      { month: "February 2025", bkgs: 22, rev: "₹4,18,500", comm: `₹${(418500 * agent.commission / 100).toLocaleString()}`, status: "Paid" },
                      { month: "January 2025",  bkgs: 19, rev: "₹3,61,000", comm: `₹${(361000 * agent.commission / 100).toLocaleString()}`, status: "Paid" },
                      { month: "December 2024", bkgs: 31, rev: "₹5,92,000", comm: `₹${(592000 * agent.commission / 100).toLocaleString()}`, status: "Paid" },
                    ].map((r, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 500 }}>{r.month}</td>
                        <td style={{ padding: "10px 12px" }}>{r.bkgs}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.rev}</td>
                        <td style={{ padding: "10px 12px", fontWeight: 700, color: "#15803d" }}>{r.comm}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, background: r.status === "Paid" ? "#dcfce7" : "#fef9c3", color: r.status === "Paid" ? "#15803d" : "#92400e" }}>{r.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
