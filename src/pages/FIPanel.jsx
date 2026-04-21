import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "../supabaseClient";
import FinancingCalculator from "../components/FinancingCalculator";

const ACCENT = "#a855f7";

export default function FIPanel() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeNav, setActiveNav] = useState("deals");
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);

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
      if (!p || p.role !== "fi_officer") {
        navigate("/login");
        return;
      }
      setProfile(p);
      setLoading(false);
      const loadNotifs = () =>
        supabase
          .from("salesman_notifications")
          .select("*")
          .eq("salesman_id", p.id)
          .order("created_at", { ascending: false })
          .limit(20)
          .then(({ data: d }) => setNotifications(d || []));
      loadNotifs();
      const ch = supabase
        .channel("fi_notifs_" + p.id)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "salesman_notifications",
            filter: `salesman_id=eq.${p.id}`,
          },
          loadNotifs,
        )
        .subscribe();
      return () => supabase.removeChannel(ch);
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
    { id: "deals", label: "Deals" },
    { id: "documents", label: "Documents" },
    { id: "calculator", label: "Calculator" },
    { id: "insurance", label: "Insurance" },
  ];

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
          F&amp;I PANEL
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "#6b7280" }}>
          {profile?.full_name}
        </span>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen((p) => !p)}
            style={{
              position: "relative",
              padding: 6,
              borderRadius: 8,
              background: notifications.some((n) => !n.is_read)
                ? "rgba(168,85,247,0.1)"
                : "transparent",
              border: notifications.some((n) => !n.is_read)
                ? "1px solid rgba(168,85,247,0.25)"
                : "1px solid transparent",
              color: notifications.some((n) => !n.is_read)
                ? "#c084fc"
                : "#6b7280",
              cursor: "pointer",
              display: "flex",
            }}
          >
            <Bell style={{ width: 16, height: 16 }} />
            {notifications.filter((n) => !n.is_read).length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: -3,
                  right: -3,
                  width: 16,
                  height: 16,
                  background: ACCENT,
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #05070e",
                }}
              >
                {notifications.filter((n) => !n.is_read).length > 9
                  ? "9+"
                  : notifications.filter((n) => !n.is_read).length}
              </span>
            )}
          </button>
          {notifOpen && (
            <>
              <div
                onClick={() => setNotifOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 40 }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  right: 0,
                  zIndex: 50,
                  width: 300,
                  maxHeight: 380,
                  overflowY: "auto",
                  background: "#111827",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: "#f3f4f6" }}
                  >
                    Notifications
                  </span>
                  {notifications.some((n) => !n.is_read) && (
                    <button
                      onClick={async () => {
                        const ids = notifications
                          .filter((n) => !n.is_read)
                          .map((n) => n.id);
                        await supabase
                          .from("salesman_notifications")
                          .update({ is_read: true })
                          .in("id", ids);
                        setNotifications((p) =>
                          p.map((n) => ({ ...n, is_read: true })),
                        );
                      }}
                      style={{
                        fontSize: 11,
                        color: "#c084fc",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "#4b5563",
                      padding: "20px",
                      textAlign: "center",
                    }}
                  >
                    No messages yet
                  </p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={async () => {
                        if (!n.is_read) {
                          await supabase
                            .from("salesman_notifications")
                            .update({ is_read: true })
                            .eq("id", n.id);
                          setNotifications((p) =>
                            p.map((x) =>
                              x.id === n.id ? { ...x, is_read: true } : x,
                            ),
                          );
                        }
                      }}
                      style={{
                        padding: "12px 16px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        background: n.is_read
                          ? "transparent"
                          : "rgba(168,85,247,0.04)",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", gap: 8 }}>
                        {!n.is_read && (
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              background: ACCENT,
                              borderRadius: "50%",
                              flexShrink: 0,
                              marginTop: 5,
                            }}
                          />
                        )}
                        <div>
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "#f3f4f6",
                              margin: "0 0 2px",
                            }}
                          >
                            {n.title || "Message from Owner"}
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              color: "#9ca3af",
                              margin: "0 0 3px",
                            }}
                          >
                            {n.body}
                          </p>
                          <p style={{ fontSize: 10, color: "#4b5563" }}>
                            {n.created_at
                              ? new Date(n.created_at).toLocaleDateString(
                                  "en-MY",
                                )
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
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
        {activeNav === "deals" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {[
              { label: "Active Deals", desc: "Deals currently in progress" },
              { label: "Pending Approval", desc: "Awaiting lender decision" },
              { label: "Completed Deals", desc: "Fully disbursed loans" },
              { label: "Declined", desc: "Rejected applications" },
            ].map((s) => (
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
        )}

        {activeNav === "documents" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {[
              {
                label: "Sales Agreement",
                desc: "Generate buyer sales contracts",
              },
              { label: "Deposit Receipt", desc: "Issue deposit confirmation" },
              {
                label: "Handover Checklist",
                desc: "Vehicle delivery document",
              },
              {
                label: "Loan Application",
                desc: "Financing application forms",
              },
            ].map((s) => (
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
                <button
                  style={{
                    fontSize: 12,
                    color: ACCENT,
                    background: `${ACCENT}18`,
                    border: `1px solid ${ACCENT}40`,
                    borderRadius: 8,
                    padding: "6px 14px",
                    cursor: "pointer",
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  Generate
                </button>
              </div>
            ))}
          </div>
        )}

        {activeNav === "calculator" && (
          <div
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 12,
              padding: 24,
            }}
          >
            <p
              style={{
                fontSize: 11,
                color: ACCENT,
                textTransform: "uppercase",
                letterSpacing: 2,
                marginBottom: 16,
              }}
            >
              Financing Calculator
            </p>
            <FinancingCalculator />
          </div>
        )}

        {activeNav === "insurance" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {[
              { label: "Active Policies", desc: "Current insurance coverage" },
              { label: "Renewals Due", desc: "Expiring within 30 days" },
              { label: "Claims", desc: "Open insurance claims" },
              { label: "Providers", desc: "Insurance partner list" },
            ].map((s) => (
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
        )}
      </main>
    </div>
  );
}
