import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function AdminPage() {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);       // lite only (dealer_id IS NULL)
  const [dealerTeams, setDealerTeams] = useState({}); // { [dealerId]: salesman[] }
  const [stats, setStats] = useState({
    total: 0, active: 0, trial: 0, expired: 0, mrr: 0,
    totalListings: 0, totalEnquiries: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState({});
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [dealerStats, setDealerStats] = useState({});
  const [expandedDealer, setExpandedDealer] = useState(null);
  const [activeTab, setActiveTab] = useState("dealers");
  const [salesmanSearch, setSalesmanSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role !== "superadmin") { navigate("/"); return; }
      await loadAll();
    }
    init();
  }, []);

  async function loadAll() {
    setLoading(true);

    // Load dealers
    const { data: dealerData } = await supabase
      .from("profiles")
      .select("id, full_name, email, dealership, subdomain, role, subscription_status, trial_ends_at, created_at, is_active, city, state, whatsapp_number, business_type")
      .eq("role", "dealer")
      .order("created_at", { ascending: false });

    const dealers = dealerData || [];
    setDealers(dealers);

    // Load salesman lite only (standalone, no dealer_id)
    const { data: salesmanData } = await supabase
      .from("profiles")
      .select("id, full_name, email, slug, plan, created_at, is_active, avatar_url, telegram_chat_id, subscription_status, ic_number, account_status, city, state, car_listings(count), leads(count)")
      .eq("role", "salesman")
      .eq("plan", "salesman_lite")
      .is("dealer_id", null)
      .order("created_at", { ascending: false });
    setSalesmen(salesmanData || []);

    // Global stats
    const active  = dealers.filter(d => d.subscription_status === "active").length;
    const trial   = dealers.filter(d => d.subscription_status === "trial").length;
    const expired = dealers.filter(d => d.subscription_status === "expired").length;
    const mrr     = active * 1000;

    const { count: totalListings }  = await supabase.from("car_listings").select("*", { count: "exact", head: true });
    const { count: totalEnquiries } = await supabase.from("whatsapp_enquiries").select("*", { count: "exact", head: true });

    setStats({ total: dealers.length, active, trial, expired, mrr,
      totalListings: totalListings || 0, totalEnquiries: totalEnquiries || 0 });

    // Per-dealer stats
    if (dealers.length > 0) {
      const ids = dealers.map(d => d.id);
      const { data: listingCounts } = await supabase.from("car_listings").select("dealer_id, status").in("dealer_id", ids);
      const { data: enquiryCounts } = await supabase.from("whatsapp_enquiries").select("dealer_id").in("dealer_id", ids);
      const { data: teamCounts }    = await supabase.from("profiles").select("dealer_id").in("dealer_id", ids).neq("role", "dealer");

      const perDealer = {};
      dealers.forEach(d => {
        perDealer[d.id] = {
          listings:  listingCounts?.filter(l => l.dealer_id === d.id).length || 0,
          available: listingCounts?.filter(l => l.dealer_id === d.id && l.status === "available").length || 0,
          sold:      listingCounts?.filter(l => l.dealer_id === d.id && l.status === "sold").length || 0,
          enquiries: enquiryCounts?.filter(e => e.dealer_id === d.id).length || 0,
          team:      teamCounts?.filter(t => t.dealer_id === d.id).length || 0,
        };
      });
      setDealerStats(perDealer);
    }
    setLoading(false);
  }

  async function loadDealerTeam(dealerId) {
    if (dealerTeams[dealerId]) return; // already cached
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, slug, plan, created_at, avatar_url, car_listings(count), leads(count)")
      .eq("dealer_id", dealerId)
      .eq("role", "salesman");
    setDealerTeams(prev => ({ ...prev, [dealerId]: data || [] }));
  }

  async function saveField(id, field, value) {
    const { error } = await supabase.from("profiles").update({ [field]: value }).eq("id", id);
    if (!error) {
      flashSaved(id);
      setDealers(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
    }
  }

  function flashSaved(id) {
    setSaved(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setSaved(prev => { const n = { ...prev }; delete n[id]; return n; }), 2000);
  }

  function updateLocal(id, field, value) {
    setDealers(prev => prev.map(d => d.id === id ? { ...d, [field]: value } : d));
  }

  async function extendTrial(id, days) {
    const newDate = new Date(Date.now() + days * 86400000).toISOString();
    const { error } = await supabase.from("profiles")
      .update({ trial_ends_at: newDate, subscription_status: "trial" }).eq("id", id);
    if (!error) {
      updateLocal(id, "trial_ends_at", newDate);
      updateLocal(id, "subscription_status", "trial");
      flashSaved(id);
    }
  }

  async function toggleSuspend(dealer) {
    const newActive = !dealer.is_active;
    await supabase.from("profiles").update({ is_active: newActive }).eq("id", dealer.id);
    updateLocal(dealer.id, "is_active", newActive);
  }

  async function toggleSalesmanSuspend(sm) {
    const newActive = !sm.is_active;
    const { error } = await supabase.from("profiles").update({ is_active: newActive }).eq("id", sm.id);
    if (!error) {
      setSalesmen(prev => prev.map(s => s.id === sm.id ? { ...s, is_active: newActive } : s));
      setDealerTeams(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].map(s => s.id === sm.id ? { ...s, is_active: newActive } : s);
        }
        return updated;
      });
    }
  }

  async function approveAgent(sm) {
    const { error } = await supabase.from("profiles").update({ account_status: "active", is_active: true }).eq("id", sm.id);
    if (!error) setSalesmen(prev => prev.map(s => s.id === sm.id ? { ...s, account_status: "active", is_active: true } : s));
  }

  async function deleteSalesman(id) {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (!error) {
      setSalesmen(prev => prev.filter(s => s.id !== id));
      setDealerTeams(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].filter(s => s.id !== id);
        }
        return updated;
      });
      setConfirmDelete(null);
    }
  }

  function fmtDate(str) {
    if (!str) return "—";
    return new Date(str).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
  }

  function trialDaysLeft(str) {
    if (!str) return null;
    return Math.ceil((new Date(str) - Date.now()) / 86400000);
  }

  function toDateInputVal(str) {
    if (!str) return "";
    return new Date(str).toISOString().slice(0, 10);
  }

  function smCount(field, sm) {
    const v = sm[field];
    return Array.isArray(v) ? (v[0]?.count ?? 0) : (v?.count ?? 0);
  }

  const filtered = dealers
    .filter(d => {
      const matchSearch = !search ||
        [d.full_name, d.dealership, d.email, d.subdomain]
          .some(v => v?.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = filterStatus === "all" || d.subscription_status === filterStatus;
      return matchSearch && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === "created_at") return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === "listings") return (dealerStats[b.id]?.listings || 0) - (dealerStats[a.id]?.listings || 0);
      if (sortBy === "name") return (a.dealership || "").localeCompare(b.dealership || "");
      return 0;
    });

  const filteredSalesmen = salesmen.filter(s =>
    !salesmanSearch ||
    [s.full_name, s.email, s.slug]
      .some(v => v?.toLowerCase().includes(salesmanSearch.toLowerCase()))
  );

  const StatCard = ({ label, value, sub, color = "#e5e7eb" }) => (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "20px 24px" }}>
      <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em" }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>{sub}</p>}
    </div>
  );

  const TABS = [
    { id: "dealers",  label: `Dealers (${stats.total})` },
    { id: "platform", label: "Platform Stats" },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; }
        .adm-root { min-height: 100vh; background: #0a0a0f; font-family: 'DM Sans', sans-serif; color: #f5f5f5; }
        .adm-input { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: white; font-family: 'DM Sans', sans-serif; font-size: 12px; padding: 5px 9px; border-radius: 6px; outline: none; }
        .adm-input:focus { border-color: rgba(220,38,38,0.5); }
        .adm-select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); color: white; font-family: 'DM Sans', sans-serif; font-size: 12px; padding: 5px 9px; border-radius: 6px; outline: none; cursor: pointer; }
        .adm-select:focus { border-color: rgba(220,38,38,0.5); }
        .adm-btn { font-family: 'DM Sans', sans-serif; font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer; border: none; transition: all 0.15s; }
        .adm-row:hover { background: rgba(255,255,255,0.015) !important; }
        .adm-expand { background: rgba(220,38,38,0.04); border-top: 1px solid rgba(220,38,38,0.08); }
        ::-webkit-scrollbar { width: 4px; height: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 100; display: flex; align-items: center; justify-content: center; }
        .modal-box { background: #111318; border: 1px solid rgba(220,38,38,0.3); border-radius: 12px; padding: 28px; max-width: 360px; width: 90%; }
      `}</style>

      <div className="adm-root">
        {/* Delete confirm modal */}
        {confirmDelete && (
          <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
            <div className="modal-box" onClick={e => e.stopPropagation()}>
              <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete Salesman Account?</p>
              <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>
                This will permanently delete <strong style={{ color: "#f5f5f5" }}>{confirmDelete.email}</strong> from the platform. This cannot be undone.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button className="adm-btn" onClick={() => setConfirmDelete(null)}
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                  Cancel
                </button>
                <button className="adm-btn" onClick={() => deleteSalesman(confirmDelete.id)}
                  style={{ background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.4)", color: "#f87171" }}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", height: 52, background: "rgba(8,12,20,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", position: "sticky", top: 0, zIndex: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, letterSpacing: 3 }}>
              Shift<span style={{ color: "#dc2626" }}>OS</span>{" "}
              <span style={{ color: "#374151", fontSize: 13, fontFamily: "'DM Sans',sans-serif", fontWeight: 500, letterSpacing: 1 }}>Superadmin</span>
            </span>
            <button onClick={() => navigate("/dashboard")}
              style={{ background: "none", border: "none", color: "#6b7280", fontSize: 12, cursor: "pointer" }}>
              ← Dashboard
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={loadAll}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
              ↻ Refresh
            </button>
            <button onClick={() => supabase.auth.signOut().then(() => navigate("/"))}
              style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171", fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
              Sign out
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "0 28px", background: "rgba(255,255,255,0.01)" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding: "12px 16px", background: "none", border: "none", borderBottom: activeTab === t.id ? "2px solid #dc2626" : "2px solid transparent", color: activeTab === t.id ? "#fff" : "#6b7280", fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 28px 80px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading…</div>
          ) : activeTab === "platform" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 32 }}>
                <StatCard label="Total Dealers" value={stats.total} />
                <StatCard label="Active (Paid)" value={stats.active} color="#4ade80" sub={`RM ${stats.mrr.toLocaleString()} MRR`} />
                <StatCard label="On Trial" value={stats.trial} color="#facc15" />
                <StatCard label="Expired" value={stats.expired} color="#f87171" />
                <StatCard label="Total Listings" value={stats.totalListings.toLocaleString()} />
                <StatCard label="Total Enquiries" value={stats.totalEnquiries.toLocaleString()} />
                <StatCard label="Est. MRR" value={`RM ${stats.mrr.toLocaleString()}`} color="#dc2626" sub="Active × RM1,000" />
              </div>
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 24 }}>
                <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 16 }}>Subscription Breakdown</p>
                <div style={{ display: "flex", gap: 0, height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
                  {stats.total > 0 && (
                    <>
                      <div style={{ flex: stats.active, background: "#16a34a" }} />
                      <div style={{ flex: stats.trial, background: "#ca8a04" }} />
                      <div style={{ flex: stats.expired, background: "#dc2626" }} />
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 20 }}>
                  {[{ label: "Active", count: stats.active, color: "#16a34a" }, { label: "Trial", count: stats.trial, color: "#ca8a04" }, { label: "Expired", count: stats.expired, color: "#dc2626" }].map(({ label, count, color }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>{label}: <strong style={{ color: "#e5e7eb" }}>{count}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            </>

          ) : (
            /* ── DEALERS TAB ── */
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
                <StatCard label="Total" value={stats.total} />
                <StatCard label="Active" value={stats.active} color="#4ade80" sub={`RM ${stats.mrr.toLocaleString()} MRR`} />
                <StatCard label="Trial" value={stats.trial} color="#facc15" />
                <StatCard label="Expired" value={stats.expired} color="#f87171" />
              </div>

              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search dealer, email, subdomain…" className="adm-input" style={{ width: 260 }} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="adm-select">
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="trial">Trial</option>
                  <option value="expired">Expired</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="adm-select">
                  <option value="created_at">Newest First</option>
                  <option value="listings">Most Listings</option>
                  <option value="name">Name A–Z</option>
                </select>
                <span style={{ fontSize: 12, color: "#4b5563", marginLeft: "auto" }}>{filtered.length} dealers</span>
              </div>

              {/* Dealers table */}
              <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                        {["Dealer", "Subdomain", "Status", "Trial Ends", "Listings", "Enquiries", "Team", "Joined", "Actions", ""].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr><td colSpan={10} style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>No dealers found.</td></tr>
                      ) : filtered.map(d => {
                        const ds = dealerStats[d.id] || {};
                        const daysLeft  = trialDaysLeft(d.trial_ends_at);
                        const isExpanded = expandedDealer === d.id;
                        const team       = dealerTeams[d.id];

                        return (
                          <React.Fragment key={d.id}>
                            <tr className="adm-row"
                              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: d.is_active === false ? 0.45 : 1 }}>
                              {/* Dealer */}
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ fontWeight: 600, color: "#f0f0f0", marginBottom: 2 }}>{d.dealership || d.full_name || "—"}</div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>{d.email}</div>
                                {d.city && <div style={{ fontSize: 10, color: "#4b5563" }}>{d.city}{d.state ? ", " + d.state : ""}</div>}
                              </td>
                              {/* Subdomain */}
                              <td style={{ padding: "10px 14px" }}>
                                <input className="adm-input" value={d.subdomain || ""}
                                  onChange={e => updateLocal(d.id, "subdomain", e.target.value)}
                                  onBlur={e => saveField(d.id, "subdomain", e.target.value || null)}
                                  placeholder="none" style={{ width: 110 }} />
                              </td>
                              {/* Status */}
                              <td style={{ padding: "10px 14px" }}>
                                <select className="adm-select" value={d.subscription_status || ""}
                                  onChange={e => { updateLocal(d.id, "subscription_status", e.target.value); saveField(d.id, "subscription_status", e.target.value); }}>
                                  <option value="trial">trial</option>
                                  <option value="active">active</option>
                                  <option value="expired">expired</option>
                                </select>
                              </td>
                              {/* Trial ends */}
                              <td style={{ padding: "10px 14px" }}>
                                <input type="date" className="adm-input" value={toDateInputVal(d.trial_ends_at)}
                                  onChange={e => { updateLocal(d.id, "trial_ends_at", e.target.value); saveField(d.id, "trial_ends_at", e.target.value || null); }}
                                  style={{ width: 130 }} />
                                {d.subscription_status === "trial" && daysLeft !== null && (
                                  <div style={{ fontSize: 10, marginTop: 3, color: daysLeft <= 3 ? "#f87171" : daysLeft <= 7 ? "#facc15" : "#6b7280" }}>
                                    {daysLeft > 0 ? `${daysLeft}d left` : "Expired"}
                                  </div>
                                )}
                              </td>
                              {/* Listings */}
                              <td style={{ padding: "10px 14px", textAlign: "center" }}>
                                <div style={{ fontWeight: 600, color: "#e5e7eb" }}>{ds.listings || 0}</div>
                                <div style={{ fontSize: 10, color: "#6b7280" }}>{ds.available || 0} live · {ds.sold || 0} sold</div>
                              </td>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#e5e7eb", fontWeight: 600 }}>{ds.enquiries || 0}</td>
                              <td style={{ padding: "10px 14px", textAlign: "center", color: "#9ca3af" }}>{ds.team || 0}</td>
                              <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(d.created_at)}</td>
                              {/* Actions */}
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                  <button className="adm-btn" onClick={() => extendTrial(d.id, 14)}
                                    style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", color: "#facc15" }}>+14d</button>
                                  <button className="adm-btn" onClick={() => extendTrial(d.id, 30)}
                                    style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", color: "#facc15" }}>+30d</button>
                                  <button className="adm-btn" onClick={() => toggleSuspend(d)}
                                    style={{ background: d.is_active === false ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${d.is_active === false ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`, color: d.is_active === false ? "#4ade80" : "#f87171" }}>
                                    {d.is_active === false ? "Unsuspend" : "Suspend"}
                                  </button>
                                </div>
                              </td>
                              {/* Expand toggle */}
                              <td style={{ padding: "10px 10px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {saved[d.id] && <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>✓</span>}
                                  <button
                                    onClick={() => {
                                      const next = isExpanded ? null : d.id;
                                      setExpandedDealer(next);
                                      if (next) loadDealerTeam(next);
                                    }}
                                    style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", padding: "2px 4px", display: "flex", alignItems: "center" }}>
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded: salesman sub-table */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={10} style={{ padding: 0 }}>
                                  <div style={{ marginLeft: 16, borderLeft: "2px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                                    {!team ? (
                                      <p style={{ padding: "12px 16px", fontSize: 12, color: "#4b5563" }}>Loading…</p>
                                    ) : team.length === 0 ? (
                                      <p style={{ padding: "12px 16px", fontSize: 12, color: "#374151" }}>No salesmen yet.</p>
                                    ) : (
                                      <>
                                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                          <thead>
                                            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                              {["", "Name", "Slug", "Listings", "Leads", "Joined", "Plan"].map(h => (
                                                <th key={h} style={{ textAlign: "left", padding: "8px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#4b5563", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                                              ))}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {team.map(sm => {
                                              const initials = (sm.full_name || sm.slug || "S").slice(0, 2).toUpperCase();
                                              return (
                                                <tr key={sm.id} className="adm-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                                  <td style={{ padding: "8px 14px", width: 44 }}>
                                                    {sm.avatar_url
                                                      ? <img src={sm.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                                                      : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#6b7280" }}>{initials}</div>
                                                    }
                                                  </td>
                                                  <td style={{ padding: "8px 14px", color: "#e5e7eb", fontWeight: 600 }}>{sm.full_name || "—"}</td>
                                                  <td style={{ padding: "8px 14px", color: "#6b7280" }}>{sm.slug || "—"}</td>
                                                  <td style={{ padding: "8px 14px", color: "#e5e7eb", fontWeight: 600 }}>{smCount("car_listings", sm)}</td>
                                                  <td style={{ padding: "8px 14px", color: "#e5e7eb", fontWeight: 600 }}>{smCount("leads", sm)}</td>
                                                  <td style={{ padding: "8px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(sm.created_at)}</td>
                                                  <td style={{ padding: "8px 14px" }}>
                                                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80" }}>Full</span>
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                        <p style={{ padding: "8px 14px", fontSize: 11, color: "#4b5563" }}>
                                          {team.length} salesman{team.length !== 1 ? "s" : ""}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ── Salesman Lite section ── */}
              <div style={{ marginTop: 48 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Salesman Lite
                  </p>
                  <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 99, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280" }}>
                    {salesmen.length}
                  </span>
                  <input value={salesmanSearch} onChange={e => setSalesmanSearch(e.target.value)}
                    placeholder="Search name, email, slug…" className="adm-input" style={{ width: 240, marginLeft: "auto" }} />
                </div>
                <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                          {["", "Name", "Slug", "Location", "IC", "Listings", "Leads", "Joined", "Actions"].map(h => (
                            <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSalesmen.length === 0 ? (
                          <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>No Salesman Lite accounts.</td></tr>
                        ) : filteredSalesmen.map(sm => {
                          const initials = (sm.full_name || sm.slug || "S").slice(0, 2).toUpperCase();
                          return (
                            <tr key={sm.id} className="adm-row"
                              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: sm.is_active === false ? 0.45 : 1 }}>
                              <td style={{ padding: "10px 14px", width: 44 }}>
                                {sm.avatar_url
                                  ? <img src={sm.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                                  : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6b7280" }}>{initials}</div>
                                }
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ fontWeight: 600, color: "#f0f0f0", marginBottom: 2, display: "flex", alignItems: "center", gap: 6 }}>
                                  {sm.full_name || "—"}
                                  {sm.account_status === "pending" ? (
                                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24", flexShrink: 0 }}>Pending</span>
                                  ) : (
                                    <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 99, background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "#93c5fd", flexShrink: 0 }}>Lite</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: "#6b7280" }}>{sm.email}</div>
                              </td>
                              <td style={{ padding: "10px 14px", color: "#9ca3af" }}>{sm.slug || "—"}</td>
                              <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 11 }}>{[sm.city, sm.state].filter(Boolean).join(", ") || "—"}</td>
                              <td style={{ padding: "10px 14px" }}>
                                {sm.ic_number
                                  ? <span style={{ fontSize: 11, color: "#e5e7eb", fontFamily: "monospace" }}>{sm.ic_number}</span>
                                  : <span style={{ color: "#4b5563" }}>—</span>
                                }
                              </td>
                              <td style={{ padding: "10px 14px", color: "#e5e7eb", fontWeight: 600 }}>{smCount("car_listings", sm)}</td>
                              <td style={{ padding: "10px 14px", color: "#e5e7eb", fontWeight: 600 }}>{smCount("leads", sm)}</td>
                              <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(sm.created_at)}</td>
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ display: "flex", gap: 5 }}>
                                  {sm.account_status === "pending" ? (
                                    <button className="adm-btn" onClick={() => approveAgent(sm)}
                                      style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80", fontWeight: 700 }}>
                                      ✓ Approve
                                    </button>
                                  ) : (
                                    <button className="adm-btn" onClick={() => toggleSalesmanSuspend(sm)}
                                      style={{ background: sm.is_active === false ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${sm.is_active === false ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`, color: sm.is_active === false ? "#4ade80" : "#f87171" }}>
                                      {sm.is_active === false ? "Unsuspend" : "Suspend"}
                                    </button>
                                  )}
                                  <button className="adm-btn" onClick={() => setConfirmDelete(sm)}
                                    style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171" }}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
