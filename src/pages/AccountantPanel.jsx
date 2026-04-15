import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";

const ACCENT = "#22c55e";

export default function AccountantPanel() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("stock");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        navigate("/login");
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (!p || p.role !== "accountant") {
        navigate("/login");
        return;
      }
      setProfile(p);
      setLoading(false);
    });
  }, [navigate]);

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#05070e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ color: "#6b7280", fontFamily: "'DM Sans',sans-serif" }}>
          Loading...
        </p>
      </div>
    );

  const NAV = [
    { id: "stock", label: "Stock" },
    { id: "commissions", label: "Commissions" },
    { id: "reports", label: "Reports" },
    { id: "documents", label: "Documents" },
  ];

  const STAT_CARDS = [
    { label: "Total Revenue", value: "—", sub: "All time" },
    { label: "Gross Profit", value: "—", sub: "This month" },
    { label: "Commissions Paid", value: "—", sub: "This month" },
    { label: "Stock Value", value: "—", sub: "Current inventory" },
  ];

  const SECTIONS = {
    stock: [
      { label: "Stock Overview", desc: "Total units in inventory" },
      { label: "Stock Value", desc: "Current inventory worth" },
      { label: "Aged Stock", desc: "Listings over 60 days" },
      { label: "Turnover Rate", desc: "Average days to sell" },
    ],
    commissions: [
      { label: "Commission Breakdown", desc: "Per salesman this month" },
      { label: "Pending Commissions", desc: "Approved but not paid" },
      { label: "Commission History", desc: "Historical payouts" },
      { label: "Top Earners", desc: "Highest commission this month" },
    ],
    reports: [
      { label: "Monthly P&L", desc: "Profit and loss statement" },
      { label: "Sales Report", desc: "Units sold by period" },
      { label: "Revenue Breakdown", desc: "By car model and category" },
      { label: "Export", desc: "Download CSV / PDF reports" },
    ],
    documents: [
      { label: "Invoices", desc: "All generated invoices" },
      { label: "Purchase Orders", desc: "Stock acquisition records" },
      { label: "Payment Receipts", desc: "Confirmed payments" },
      { label: "Tax Documents", desc: "GST and tax filings" },
    ],
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#05070e",
        fontFamily: "'DM Sans',sans-serif",
        color: "#f0f2f5",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "rgba(255,255,255,0.03)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: ACCENT,
          }}
        />
        <span
          style={{
            fontFamily: "'Bebas Neue',sans-serif",
            fontSize: 20,
            letterSpacing: 3,
            color: ACCENT,
          }}
        >
          ACCOUNTS
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>
          {profile?.full_name}
        </span>
        <button
          onClick={() => supabase.auth.signOut().then(() => navigate("/login"))}
          style={{
            fontSize: 12,
            color: "#6b7280",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </header>

      {/* Nav */}
      <nav
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 24px",
          display: "flex",
          gap: 0,
        }}
      >
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => setActiveNav(n.id)}
            style={{
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderBottom:
                activeNav === n.id
                  ? `2px solid ${ACCENT}`
                  : "2px solid transparent",
              color: activeNav === n.id ? ACCENT : "#6b7280",
              fontSize: 13,
              fontWeight: activeNav === n.id ? 600 : 400,
              cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif",
              transition: "all 0.15s",
            }}
          >
            {n.label}
          </button>
        ))}
      </nav>

      {/* Main */}
      <main style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        {/* Financial Summary stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {STAT_CARDS.map((c) => (
            <div
              key={c.label}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "16px 20px",
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  color: ACCENT,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginBottom: 6,
                }}
              >
                {c.label}
              </p>
              <p
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#e5e7eb",
                  marginBottom: 2,
                }}
              >
                {c.value}
              </p>
              <p style={{ fontSize: 11, color: "#374151" }}>{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Section cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {(SECTIONS[activeNav] || []).map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: 20,
                minHeight: 140,
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: ACCENT,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                  marginBottom: 8,
                }}
              >
                {s.label}
              </p>
              <p style={{ fontSize: 13, color: "#374151", marginBottom: 12 }}>
                {s.desc}
              </p>
              <div
                style={{
                  height: 60,
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 11, color: "#1f2937" }}>
                  Coming soon
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
