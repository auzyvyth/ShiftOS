import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { invalidateMarketplaceSettingsCache, MARKETPLACE_FALLBACK } from "../hooks/useMarketplaceSettings";

export default function AdminPage() {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
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
  const [waitlist, setWaitlist] = useState([]);
  const [waitlistSearch, setWaitlistSearch] = useState("");
  const [pendingListings, setPendingListings] = useState([]);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvalActioning, setApprovalActioning] = useState(null);
  const [blastModal, setBlastModal] = useState(false);
  const [blastMsg, setBlastMsg] = useState("Hi! ShiftOS Lite is launching soon — free car listings, your own profile page, and lead tracking. You're on the early list. Stay tuned!");
  const [blastCopied, setBlastCopied] = useState(null); // "numbers" | "msg" | null

  // Marketplace settings tab
  const [mktSettings, setMktSettings] = useState(null);
  const [mktLoading,  setMktLoading]  = useState(false);
  const [mktSaving,   setMktSaving]   = useState(false);
  const [mktSaved,    setMktSaved]    = useState(false);

  const MKT_ID = '00000000-0000-0000-0000-000000000001';

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
      .select("id, full_name, email, dealership, subdomain, role, subscription_status, trial_ends_at, created_at, is_active, city, state, whatsapp_number, business_type, payment_status")
      .eq("role", "dealer")
      .order("created_at", { ascending: false });

    const dealers = dealerData || [];
    setDealers(dealers);

    // Load ALL salesmen with plan info
    const { data: salesmanData } = await supabase
      .from("profiles")
      .select("id, full_name, email, created_at, is_active, role, dealer_id, subdomain, subscription_status, plan, slug")
      .eq("role", "salesman")
      .order("created_at", { ascending: false });
    setSalesmen(salesmanData || []);

    // Global stats
    const active = dealers.filter(d => d.subscription_status === "active").length;
    const trial  = dealers.filter(d => d.subscription_status === "trial").length;
    const expired = dealers.filter(d => d.subscription_status === "expired").length;
    const mrr = active * 1000;

    const { count: totalListings } = await supabase
      .from("car_listings").select("*", { count: "exact", head: true });
    const { count: totalEnquiries } = await supabase
      .from("whatsapp_enquiries").select("*", { count: "exact", head: true });

    setStats({ total: dealers.length, active, trial, expired, mrr,
      totalListings: totalListings || 0, totalEnquiries: totalEnquiries || 0 });

    // Per-dealer stats
    if (dealers.length > 0) {
      const ids = dealers.map(d => d.id);
      const { data: listingCounts } = await supabase
        .from("car_listings").select("dealer_id, status").in("dealer_id", ids);
      const { data: enquiryCounts } = await supabase
        .from("whatsapp_enquiries").select("dealer_id").in("dealer_id", ids);
      const { data: teamCounts } = await supabase
        .from("profiles").select("dealer_id").in("dealer_id", ids).neq("role", "dealer");

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

    // Load waitlist
    const { data: wl } = await supabase
      .from("waitlist_signups")
      .select("id, name, phone, referral_code, referred_by, position, founding_member, created_at")
      .order("position", { ascending: true });
    setWaitlist(wl || []);

    // Load pending approval listings (salesman-lite standalone accounts)
    const { data: pending } = await supabase
      .from("car_listings")
      .select("id, year, brand, model, variant, selling_price, images, status, created_at, rejection_reason, dealer_id, profiles!car_listings_dealer_id_fkey(full_name, slug, dealership)")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: true });
    setPendingListings(pending || []);
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
    if (!error) setSalesmen(prev => prev.map(s => s.id === sm.id ? { ...s, is_active: newActive } : s));
  }

  async function deleteSalesman(id) {
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (!error) {
      setSalesmen(prev => prev.filter(s => s.id !== id));
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
    [s.full_name, s.email, s.subdomain]
      .some(v => v?.toLowerCase().includes(salesmanSearch.toLowerCase()))
  );

  // Load marketplace settings when tab is first opened
  useEffect(() => {
    if (activeTab === 'marketplace' && !mktSettings && !mktLoading) {
      setMktLoading(true);
      supabase.from('marketplace_settings').select('*')
        .eq('id', MKT_ID).maybeSingle()
        .then(({ data }) => { setMktSettings(data || { ...MARKETPLACE_FALLBACK }); setMktLoading(false); });
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveMarketplaceSettings() {
    setMktSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('marketplace_settings')
      .update({ ...mktSettings, updated_at: new Date().toISOString(), updated_by: user.id })
      .eq('id', MKT_ID);
    setMktSaving(false);
    if (!error) {
      setMktSaved(true);
      invalidateMarketplaceSettingsCache();
      setTimeout(() => setMktSaved(false), 2500);
    }
  }

  // Inner helpers for marketplace form
  const MktSection = ({ label, hint, children }) => (
    <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: "20px 24px" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: hint ? 6 : 16 }}>{label}</p>
      {hint && <p style={{ fontSize: 11, color: "#4b5563", marginBottom: 14 }}>{hint}</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
    </div>
  );
  const MktField = ({ label, hint, children }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
      <div style={{ minWidth: 190 }}>
        <p style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500, margin: 0 }}>{label}</p>
        {hint && <p style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
  const MktToggle = ({ label, value, onChange }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button onClick={() => onChange(!value)} style={{ width: 36, height: 20, borderRadius: 10, background: value ? "rgba(220,38,38,0.7)" : "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <span style={{ position: "absolute", top: 2, left: value ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white", transition: "left 0.2s", display: "block" }} />
      </button>
      <span style={{ fontSize: 13, color: "#9ca3af" }}>{label}</span>
    </div>
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
    { id: "salesman", label: `Salesmen (${salesmen.length})` },
    { id: "approvals", label: "Approvals", badge: pendingListings.length },
    { id: "waitlist", label: `Waitlist (${waitlist.length})` },
    { id: "platform",    label: "Platform Stats" },
    { id: "marketplace", label: "Marketplace" },
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

        {/* Blast modal */}
        {blastModal && (() => {
          const filtered = waitlist.filter(w =>
            !waitlistSearch || w.name?.toLowerCase().includes(waitlistSearch.toLowerCase()) || w.phone?.includes(waitlistSearch)
          );
          const numbers = filtered.map(w => w.phone).join("\n");
          const copyNumbers = () => {
            navigator.clipboard.writeText(numbers);
            setBlastCopied("numbers");
            setTimeout(() => setBlastCopied(null), 2500);
          };
          const copyMsg = () => {
            navigator.clipboard.writeText(blastMsg);
            setBlastCopied("msg");
            setTimeout(() => setBlastCopied(null), 2500);
          };
          return (
            <div className="modal-overlay" onClick={() => setBlastModal(false)}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#111318", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 28, width: "min(560px,95vw)", maxHeight: "90vh", overflowY: "auto" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: "#f5f5f5", marginBottom: 2 }}>📣 Blast Waitlist</p>
                    <p style={{ fontSize: 12, color: "#6b7280" }}>{filtered.length} recipients — copy numbers + message, paste into WA Business broadcast</p>
                  </div>
                  <button onClick={() => setBlastModal(false)} style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer", lineHeight: 1 }}>×</button>
                </div>

                {/* Message composer */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Message</p>
                  <textarea
                    value={blastMsg}
                    onChange={e => setBlastMsg(e.target.value)}
                    rows={5}
                    style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "10px 14px", color: "#f1f5f9", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none" }}
                  />
                  <button onClick={copyMsg} style={{ marginTop: 8, fontSize: 12, padding: "6px 14px", borderRadius: 6, background: blastCopied === "msg" ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.05)", border: blastCopied === "msg" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)", color: blastCopied === "msg" ? "#4ade80" : "#9ca3af", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    {blastCopied === "msg" ? "✓ Copied!" : "Copy Message"}
                  </button>
                </div>

                {/* Numbers */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Phone Numbers ({filtered.length})</p>
                  <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "10px 14px", maxHeight: 180, overflowY: "auto", marginBottom: 10 }}>
                    {filtered.map(w => (
                      <p key={w.id} style={{ margin: "2px 0", fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>{w.phone}</p>
                    ))}
                  </div>
                  <button onClick={copyNumbers} style={{ width: "100%", fontSize: 13, padding: "10px 16px", borderRadius: 7, background: blastCopied === "numbers" ? "rgba(34,197,94,0.12)" : "rgba(220,38,38,0.12)", border: blastCopied === "numbers" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(220,38,38,0.3)", color: blastCopied === "numbers" ? "#4ade80" : "#f87171", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                    {blastCopied === "numbers" ? `✓ ${filtered.length} numbers copied!` : `Copy All ${filtered.length} Numbers`}
                  </button>
                  <p style={{ marginTop: 10, fontSize: 11, color: "#4b5563", lineHeight: 1.6 }}>
                    Paste numbers into <strong style={{ color: "#9ca3af" }}>WhatsApp Business → New Broadcast</strong>, then paste the message separately.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

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
              style={{ padding: "12px 16px", background: "none", border: "none", borderBottom: activeTab === t.id ? "2px solid #dc2626" : "2px solid transparent", color: activeTab === t.id ? "#fff" : "#6b7280", fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 6 }}>
              {t.label}
              {t.badge > 0 && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: "rgba(220,38,38,0.18)", border: "1px solid rgba(220,38,38,0.35)", color: "#f87171" }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 28px 80px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading…</div>
          ) : activeTab === "approvals" ? (
            /* ── APPROVALS TAB ── */
            <div>
              <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Listing Approvals</p>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Listings from standalone salesman-lite accounts waiting for review</p>
                </div>
                {pendingListings.length === 0 && (
                  <span style={{ fontSize: 12, color: "#4ade80" }}>✓ All clear</span>
                )}
              </div>

              {pendingListings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 0", color: "#374151" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>✓</p>
                  <p style={{ fontSize: 14, color: "#4b5563" }}>No listings pending approval</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {pendingListings.map(listing => {
                    const salesman = listing.profiles;
                    const img = listing.images?.[0];
                    const carName = [listing.year, listing.brand, listing.model, listing.variant].filter(Boolean).join(" ");
                    const price = listing.selling_price ? `RM ${Number(listing.selling_price).toLocaleString("en-MY")}` : "—";
                    const submittedAgo = (() => {
                      const s = Math.floor((Date.now() - new Date(listing.created_at)) / 1000);
                      if (s < 3600) return `${Math.floor(s / 60)}m ago`;
                      if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
                      return `${Math.floor(s / 86400)}d ago`;
                    })();
                    const isActioning = approvalActioning === listing.id;
                    const isRejecting = rejectingId === listing.id;

                    return (
                      <div key={listing.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "16px 18px" }}>
                        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                          {/* Thumbnail */}
                          {img ? (
                            <img src={img} alt={carName} style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 7, flexShrink: 0, border: "1px solid rgba(255,255,255,0.06)" }} />
                          ) : (
                            <div style={{ width: 80, height: 60, borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 20 }}>🚗</span>
                            </div>
                          )}

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{carName || "—"}</p>
                            <p style={{ margin: "0 0 4px", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{price}</p>
                            <p style={{ margin: 0, fontSize: 11, color: "#6b7280" }}>
                              by <span style={{ color: "#9ca3af", fontWeight: 600 }}>{salesman?.full_name || "—"}</span>
                              {salesman?.slug && <span style={{ color: "#4b5563" }}> · @{salesman.slug}</span>}
                              <span style={{ color: "#374151" }}> · submitted {submittedAgo}</span>
                            </p>
                          </div>

                          {/* Action buttons */}
                          {!isRejecting && (
                            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                              <button
                                disabled={isActioning}
                                onClick={async () => {
                                  setApprovalActioning(listing.id);
                                  const { error } = await supabase.rpc("approve_listing", { p_listing_id: listing.id });
                                  if (error) { alert("Error: " + error.message); }
                                  else { setPendingListings(p => p.filter(l => l.id !== listing.id)); }
                                  setApprovalActioning(null);
                                }}
                                style={{ fontSize: 12, fontWeight: 700, padding: "7px 16px", borderRadius: 8, background: isActioning ? "rgba(34,197,94,0.06)" : "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", cursor: isActioning ? "not-allowed" : "pointer", opacity: isActioning ? 0.6 : 1 }}
                              >
                                {isActioning ? "…" : "✓ Approve"}
                              </button>
                              <button
                                onClick={() => { setRejectingId(listing.id); setRejectReason(""); }}
                                style={{ fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer" }}
                              >
                                ✕ Reject
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Inline reject reason input */}
                        {isRejecting && (
                          <div style={{ marginTop: 12, padding: "12px 14px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8 }}>
                            <p style={{ margin: "0 0 8px", fontSize: 12, color: "#f87171", fontWeight: 600 }}>Reason for rejection (shown to salesman)</p>
                            <textarea
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              placeholder="e.g. Price seems too high, missing photos, suspected duplicate listing…"
                              rows={2}
                              style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#e5e7eb", fontSize: 13, padding: "8px 10px", resize: "vertical", fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
                            />
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}
                              >
                                Cancel
                              </button>
                              <button
                                disabled={!rejectReason.trim() || isActioning}
                                onClick={async () => {
                                  if (!rejectReason.trim()) return;
                                  setApprovalActioning(listing.id);
                                  const { error } = await supabase.rpc("reject_listing", { p_listing_id: listing.id, p_reason: rejectReason.trim() });
                                  if (error) { alert("Error: " + error.message); }
                                  else { setPendingListings(p => p.filter(l => l.id !== listing.id)); setRejectingId(null); setRejectReason(""); }
                                  setApprovalActioning(null);
                                }}
                                style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 700, background: rejectReason.trim() ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", border: rejectReason.trim() ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)", color: rejectReason.trim() ? "#f87171" : "#374151", cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: isActioning ? 0.6 : 1 }}
                              >
                                {isActioning ? "Rejecting…" : "Confirm Reject"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === "waitlist" ? (
            /* ── WAITLIST TAB ── */
            (() => {
              const filtered = waitlist.filter(w =>
                !waitlistSearch ||
                w.name?.toLowerCase().includes(waitlistSearch.toLowerCase()) ||
                w.phone?.includes(waitlistSearch) ||
                w.referral_code?.includes(waitlistSearch)
              );
              const founding = waitlist.filter(w => w.founding_member).length;
              const referred = waitlist.filter(w => w.referred_by).length;
              return (
                <>
                  {/* Stats strip */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
                    {[
                      { label: "Total on Waitlist", value: waitlist.length, color: "#f5f5f5" },
                      { label: "Founding Members", value: founding, color: "#fbbf24" },
                      { label: "Via Referral", value: referred, color: "#4ade80" },
                      { label: "Referral Rate", value: waitlist.length > 0 ? `${Math.round((referred/waitlist.length)*100)}%` : "—", color: "#60a5fa" },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "16px 18px" }}>
                        <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</p>
                        <p style={{ fontSize: 26, fontWeight: 700, color, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em" }}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Toolbar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                    <input
                      value={waitlistSearch} onChange={e => setWaitlistSearch(e.target.value)}
                      placeholder="Search name, phone, code…" className="adm-input" style={{ width: 260 }}
                    />
                    <span style={{ fontSize: 12, color: "#4b5563" }}>{filtered.length} shown</span>
                    <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {
                          const csv = ["position,name,phone,referral_code,referred_by,founding_member,created_at",
                            ...filtered.map(w => [w.position, `"${w.name}"`, w.phone, w.referral_code, w.referred_by||"", w.founding_member, w.created_at].join(","))
                          ].join("\n");
                          navigator.clipboard.writeText(csv);
                        }}
                        style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                        Copy CSV
                      </button>
                      <button
                        onClick={() => {
                          const vcf = filtered.map(w =>
                            `BEGIN:VCARD\nVERSION:3.0\nFN:${w.name} (ShiftOS #${w.position})\nTEL;TYPE=CELL:+${w.phone.replace(/^\+/, "")}\nEND:VCARD`
                          ).join("\n");
                          const blob = new Blob([vcf], { type: "text/vcard" });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "shiftos-waitlist.vcf";
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                        Download Contacts (.vcf)
                      </button>
                      <button
                        onClick={() => setBlastModal(true)}
                        style={{ fontSize: 12, padding: "6px 16px", borderRadius: 6, background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                        📣 Blast Waitlist
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 11, color: "#374151", marginBottom: 14 }}>
                    💡 Import .vcf into phone contacts → WA Business → New Broadcast → select all ShiftOS contacts
                  </p>

                  {/* Table */}
                  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                            {["#", "Name", "Phone", "Referral Code", "Referred By", "Status", "Joined"].map(h => (
                              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((w, i) => (
                            <tr key={w.id} className="adm-row" style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                              <td style={{ padding: "11px 14px", color: "#6b7280", fontWeight: 700 }}>#{w.position}</td>
                              <td style={{ padding: "11px 14px", color: "#f5f5f5", fontWeight: 600 }}>
                                {w.name}
                                {w.founding_member && (
                                  <span style={{ marginLeft: 7, fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", fontWeight: 700 }}>FOUNDING</span>
                                )}
                              </td>
                              <td style={{ padding: "11px 14px" }}>
                                <a href={`https://wa.me/${w.phone}`} target="_blank" rel="noreferrer"
                                  style={{ color: "#4ade80", textDecoration: "none", fontSize: 12, fontFamily: "monospace" }}>
                                  {w.phone}
                                </a>
                              </td>
                              <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 12, color: "#94a3b8" }}>{w.referral_code}</td>
                              <td style={{ padding: "11px 14px", fontFamily: "monospace", fontSize: 12, color: w.referred_by ? "#60a5fa" : "#374151" }}>{w.referred_by || "—"}</td>
                              <td style={{ padding: "11px 14px" }}>
                                <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: w.founding_member ? "rgba(251,191,36,0.1)" : "rgba(255,255,255,0.05)", border: `1px solid ${w.founding_member ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.08)"}`, color: w.founding_member ? "#fbbf24" : "#6b7280", fontWeight: 700 }}>
                                  {w.founding_member ? "Founding" : "Waitlist"}
                                </span>
                              </td>
                              <td style={{ padding: "11px 14px", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>{fmtDate(w.created_at)}</td>
                            </tr>
                          ))}
                          {filtered.length === 0 && (
                            <tr><td colSpan={7} style={{ padding: "40px 14px", textAlign: "center", color: "#4b5563" }}>No entries found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()
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

          ) : activeTab === "salesman" ? (
            /* ── SALESMEN TAB ── */
            <>
              <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <input value={salesmanSearch} onChange={e => setSalesmanSearch(e.target.value)}
                  placeholder="Search name, email, slug…" className="adm-input" style={{ width: 280 }} />
                <span style={{ fontSize: 12, color: "#4b5563", marginLeft: "auto" }}>{filteredSalesmen.length} accounts</span>
              </div>

              {/* ── Group 1: Standalone Lite ── */}
              {(() => {
                const lites = filteredSalesmen.filter(s => s.plan === 'salesman_lite' && !s.dealer_id);
                return (
                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.08em" }}>Standalone Lite</span>
                      <span style={{ fontSize: 11, color: "#4b5563", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 20, padding: "1px 8px" }}>{lites.length}</span>
                      <span style={{ fontSize: 10, color: "#374151", marginLeft: 4 }}>Own listings · no dealer</span>
                    </div>
                    <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                              {["Account", "Slug / Profile", "Sub Status", "Joined", "Status", "Actions"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {lites.length === 0 ? (
                              <tr><td colSpan={6} style={{ textAlign: "center", padding: 32, color: "#4b5563", fontSize: 12 }}>No standalone lite accounts.</td></tr>
                            ) : lites.map(sm => (
                              <tr key={sm.id} className="adm-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: sm.is_active === false ? 0.45 : 1 }}>
                                <td style={{ padding: "10px 14px" }}>
                                  <div style={{ fontWeight: 600, color: "#f0f0f0", marginBottom: 2 }}>{sm.full_name || "—"}</div>
                                  <div style={{ fontSize: 11, color: "#6b7280" }}>{sm.email}</div>
                                </td>
                                <td style={{ padding: "10px 14px", color: "#9ca3af" }}>
                                  {sm.slug ? (
                                    <a href={`https://xdrive.my/s/${sm.slug}`} target="_blank" rel="noreferrer" style={{ color: "#fbbf24", textDecoration: "none" }}>
                                      /s/{sm.slug} ↗
                                    </a>
                                  ) : "—"}
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  <select className="adm-select" value={sm.subscription_status || "trial"}
                                    onChange={async e => {
                                      const val = e.target.value;
                                      const { error } = await supabase.from("profiles").update({ subscription_status: val }).eq("id", sm.id);
                                      if (!error) { setSalesmen(prev => prev.map(s => s.id === sm.id ? { ...s, subscription_status: val } : s)); flashSaved(sm.id); }
                                    }}>
                                    <option value="trial">trial</option>
                                    <option value="active">active</option>
                                    <option value="expired">expired</option>
                                  </select>
                                </td>
                                <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(sm.created_at)}</td>
                                <td style={{ padding: "10px 14px" }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: sm.is_active === false ? "#f87171" : "#4ade80" }}>
                                    {sm.is_active === false ? "○ Suspended" : "● Active"}
                                  </span>
                                  {saved[sm.id] && <span style={{ fontSize: 10, color: "#4ade80", marginLeft: 6 }}>✓</span>}
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  <div style={{ display: "flex", gap: 5 }}>
                                    <button className="adm-btn" onClick={() => toggleSalesmanSuspend(sm)}
                                      style={{ background: sm.is_active === false ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${sm.is_active === false ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`, color: sm.is_active === false ? "#4ade80" : "#f87171" }}>
                                      {sm.is_active === false ? "Unsuspend" : "Suspend"}
                                    </button>
                                    <button className="adm-btn" onClick={() => setConfirmDelete(sm)}
                                      style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171" }}>
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Group 2: Under Dealer (salesman_full) ── */}
              {(() => {
                const full = filteredSalesmen.filter(s => s.plan === 'salesman_full' && s.dealer_id);
                if (full.length === 0) return null;
                return (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa", textTransform: "uppercase", letterSpacing: "0.08em" }}>Under Dealer (SalesmanPanel)</span>
                      <span style={{ fontSize: 11, color: "#4b5563", background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)", borderRadius: 20, padding: "1px 8px" }}>{full.length}</span>
                      <span style={{ fontSize: 10, color: "#374151", marginLeft: 4 }}>Created by or merged into a dealer</span>
                    </div>
                    <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                              {["Account", "Dealer ID", "Joined", "Status", "Actions"].map(h => (
                                <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {full.map(sm => (
                              <tr key={sm.id} className="adm-row" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: sm.is_active === false ? 0.45 : 1 }}>
                                <td style={{ padding: "10px 14px" }}>
                                  <div style={{ fontWeight: 600, color: "#f0f0f0", marginBottom: 2 }}>{sm.full_name || "—"}</div>
                                  <div style={{ fontSize: 11, color: "#6b7280" }}>{sm.email}</div>
                                </td>
                                <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 11, fontFamily: "monospace" }}>{sm.dealer_id?.slice(0, 12)}…</td>
                                <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(sm.created_at)}</td>
                                <td style={{ padding: "10px 14px" }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: sm.is_active === false ? "#f87171" : "#4ade80" }}>
                                    {sm.is_active === false ? "○ Suspended" : "● Active"}
                                  </span>
                                </td>
                                <td style={{ padding: "10px 14px" }}>
                                  <div style={{ display: "flex", gap: 5 }}>
                                    <button className="adm-btn" onClick={() => toggleSalesmanSuspend(sm)}
                                      style={{ background: sm.is_active === false ? "rgba(74,222,128,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${sm.is_active === false ? "rgba(74,222,128,0.2)" : "rgba(239,68,68,0.2)"}`, color: sm.is_active === false ? "#4ade80" : "#f87171" }}>
                                      {sm.is_active === false ? "Unsuspend" : "Suspend"}
                                    </button>
                                    <button className="adm-btn" onClick={() => setConfirmDelete(sm)}
                                      style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#f87171" }}>
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>

          ) : activeTab === "marketplace" ? (
            /* ── MARKETPLACE TAB ── */
            <div style={{ maxWidth: 760 }}>
              <div style={{ marginBottom: 28, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                <div>
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>Marketplace Settings</p>
                  <p style={{ fontSize: 12, color: "#6b7280" }}>Controls what appears on xdrive.my — changes go live immediately after saving.</p>
                </div>
                <button
                  onClick={saveMarketplaceSettings}
                  disabled={mktSaving || !mktSettings}
                  className="adm-btn"
                  style={{ fontSize: 13, padding: "9px 22px", background: mktSaved ? "rgba(34,197,94,0.15)" : "rgba(220,38,38,0.15)", border: `1px solid ${mktSaved ? "rgba(34,197,94,0.35)" : "rgba(220,38,38,0.35)"}`, color: mktSaved ? "#4ade80" : "#f87171", opacity: mktSaving || !mktSettings ? 0.6 : 1, cursor: mktSaving || !mktSettings ? "not-allowed" : "pointer" }}>
                  {mktSaved ? "✓ Saved" : mktSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>

              {mktLoading || !mktSettings ? (
                <div style={{ textAlign: "center", padding: 60, color: "#4b5563" }}>Loading settings…</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                  {/* Branding */}
                  <MktSection label="Branding">
                    <MktField label="Brand Tagline" hint="Shown in footer brand column">
                      <textarea
                        value={mktSettings.brand_tagline || ""}
                        onChange={e => setMktSettings(s => ({ ...s, brand_tagline: e.target.value }))}
                        rows={3}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240, resize: "vertical", lineHeight: 1.5 }}
                      />
                    </MktField>
                  </MktSection>

                  {/* Support Contacts */}
                  <MktSection label="Support Contacts">
                    <MktField label="Support Email">
                      <input
                        type="email"
                        value={mktSettings.support_email || ""}
                        onChange={e => setMktSettings(s => ({ ...s, support_email: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                      />
                    </MktField>
                    <MktField label="WhatsApp Number" hint="Digits only, no + sign (e.g. 60174155191)">
                      <input
                        type="text"
                        value={mktSettings.support_whatsapp || ""}
                        onChange={e => setMktSettings(s => ({ ...s, support_whatsapp: e.target.value.replace(/\D/g, "") }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="60174155191"
                      />
                    </MktField>
                    <MktField label="Phone Display Text" hint="Human-readable format shown in header/footer">
                      <input
                        type="text"
                        value={mktSettings.support_phone || ""}
                        onChange={e => setMktSettings(s => ({ ...s, support_phone: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="+60 17-415 5191"
                      />
                    </MktField>
                  </MktSection>

                  {/* Social Links */}
                  <MktSection label="Social Links">
                    <MktField label="Instagram URL">
                      <input
                        type="url"
                        value={mktSettings.social_instagram || ""}
                        onChange={e => setMktSettings(s => ({ ...s, social_instagram: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="https://instagram.com/xdrive.my"
                      />
                    </MktField>
                    <MktField label="Facebook URL">
                      <input
                        type="url"
                        value={mktSettings.social_facebook || ""}
                        onChange={e => setMktSettings(s => ({ ...s, social_facebook: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="https://facebook.com/xdrive.my"
                      />
                    </MktField>
                    <MktField label="TikTok URL" hint="Leave blank to hide the TikTok icon">
                      <input
                        type="url"
                        value={mktSettings.social_tiktok || ""}
                        onChange={e => setMktSettings(s => ({ ...s, social_tiktok: e.target.value || null }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="https://tiktok.com/@xdrive.my"
                      />
                    </MktField>
                  </MktSection>

                  {/* Trust Bar */}
                  <MktSection label="Trust Bar" hint="4 badges shown below the header on xdrive.my">
                    {(mktSettings.trust_badges || []).map((badge, i) => (
                      <MktField key={i} label={`Badge ${i + 1}`}>
                        <input
                          type="text"
                          value={badge.text || ""}
                          onChange={e => {
                            const badges = [...(mktSettings.trust_badges || [])];
                            badges[i] = { ...badges[i], text: e.target.value };
                            setMktSettings(s => ({ ...s, trust_badges: badges }));
                          }}
                          className="adm-input"
                          style={{ flex: 1, minWidth: 240 }}
                        />
                      </MktField>
                    ))}
                  </MktSection>

                  {/* Footer */}
                  <MktSection label="Footer" hint="Use {year} as a placeholder for the current year">
                    <MktField label="Copyright Text">
                      <input
                        type="text"
                        value={mktSettings.footer_copyright || ""}
                        onChange={e => setMktSettings(s => ({ ...s, footer_copyright: e.target.value }))}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240 }}
                        placeholder="© {year} XDrive Malaysia Sdn Bhd. All rights reserved."
                      />
                    </MktField>
                  </MktSection>

                  {/* ShiftOS DMS Band */}
                  <MktSection label="ShiftOS DMS Band" hint="The dark promotional band at the bottom of the footer">
                    <MktToggle
                      label="Show ShiftOS DMS promotional band in footer"
                      value={!!mktSettings.shiftos_band_enabled}
                      onChange={val => setMktSettings(s => ({ ...s, shiftos_band_enabled: val }))}
                    />
                  </MktSection>

                  {/* Announcement Bar */}
                  <MktSection label="Announcement Bar" hint="Dismissible red banner shown above the navigation on xdrive.my">
                    <MktToggle
                      label="Show announcement bar"
                      value={!!mktSettings.announcement_enabled}
                      onChange={val => setMktSettings(s => ({ ...s, announcement_enabled: val }))}
                    />
                    <MktField label="Announcement Text">
                      <input
                        type="text"
                        value={mktSettings.announcement_text || ""}
                        onChange={e => setMktSettings(s => ({ ...s, announcement_text: e.target.value || null }))}
                        disabled={!mktSettings.announcement_enabled}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240, opacity: mktSettings.announcement_enabled ? 1 : 0.4 }}
                        placeholder="e.g. Ramadan sale — all listings verified this week"
                      />
                    </MktField>
                    <MktField label="Link (optional)" hint="Makes the bar clickable — leave blank for no link">
                      <input
                        type="url"
                        value={mktSettings.announcement_link || ""}
                        onChange={e => setMktSettings(s => ({ ...s, announcement_link: e.target.value || null }))}
                        disabled={!mktSettings.announcement_enabled}
                        className="adm-input"
                        style={{ flex: 1, minWidth: 240, opacity: mktSettings.announcement_enabled ? 1 : 0.4 }}
                        placeholder="https://xdrive.my/…"
                      />
                    </MktField>
                  </MktSection>

                  {/* Bottom Save */}
                  <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
                    <button
                      onClick={saveMarketplaceSettings}
                      disabled={mktSaving}
                      className="adm-btn"
                      style={{ fontSize: 13, padding: "9px 28px", background: mktSaved ? "rgba(34,197,94,0.15)" : "rgba(220,38,38,0.15)", border: `1px solid ${mktSaved ? "rgba(34,197,94,0.35)" : "rgba(220,38,38,0.35)"}`, color: mktSaved ? "#4ade80" : "#f87171", opacity: mktSaving ? 0.6 : 1, cursor: mktSaving ? "not-allowed" : "pointer" }}>
                      {mktSaved ? "✓ Saved" : mktSaving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>

                </div>
              )}
            </div>

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
                        const daysLeft = trialDaysLeft(d.trial_ends_at);
                        const isExpanded = expandedDealer === d.id;

                        return (
                          <React.Fragment key={d.id}>
                            <tr className="adm-row"
                              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", opacity: d.is_active === false ? 0.45 : 1 }}>
                              {/* Dealer */}
                              <td style={{ padding: "10px 14px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 2 }}>
                                  <span style={{ fontWeight: 600, color: "#f0f0f0" }}>{d.dealership || d.full_name || "—"}</span>
                                  {d.payment_status === "pending" && (
                                    <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 99, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", fontWeight: 700, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>PAYMENT PENDING</span>
                                  )}
                                </div>
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
                              {/* Expand */}
                              <td style={{ padding: "10px 10px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  {saved[d.id] && <span style={{ fontSize: 10, color: "#4ade80", fontWeight: 700 }}>✓</span>}
                                  <button onClick={() => setExpandedDealer(isExpanded ? null : d.id)}
                                    style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}>
                                    {isExpanded ? "▲" : "▼"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {/* Expanded row */}
                            {isExpanded && (
                              <tr className="adm-expand">
                                <td colSpan={10} style={{ padding: "16px 24px" }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                                    <div>
                                      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Contact</p>
                                      <p style={{ fontSize: 12, color: "#e5e7eb", marginBottom: 4 }}>{d.full_name || "—"}</p>
                                      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{d.email}</p>
                                      {d.whatsapp_number && <p style={{ fontSize: 12, color: "#9ca3af" }}>📱 {d.whatsapp_number}</p>}
                                    </div>
                                    <div>
                                      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Business</p>
                                      <p style={{ fontSize: 12, color: "#e5e7eb", marginBottom: 4 }}>{d.business_type || "—"}</p>
                                      <p style={{ fontSize: 12, color: "#9ca3af" }}>{d.city}{d.state ? ", " + d.state : ""}</p>
                                    </div>
                                    <div>
                                      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Performance</p>
                                      <p style={{ fontSize: 12, color: "#e5e7eb", marginBottom: 4 }}>{ds.listings || 0} total listings</p>
                                      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 4 }}>{ds.sold || 0} sold · {ds.available || 0} live</p>
                                      <p style={{ fontSize: 12, color: "#9ca3af" }}>{ds.enquiries || 0} enquiries · {ds.team || 0} team members</p>
                                    </div>
                                    <div>
                                      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Quick Actions</p>
                                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {d.subdomain && (
                                          <a href={`https://${d.subdomain}.xdrive.my`} target="_blank" rel="noreferrer"
                                            style={{ fontSize: 12, color: "#dc2626", textDecoration: "none" }}>↗ View Storefront</a>
                                        )}
                                        <button onClick={() => { saveField(d.id, "subscription_status", "active"); updateLocal(d.id, "subscription_status", "active"); }}
                                          style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ade80", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, textAlign: "left" }}>
                                          ✓ Mark as Active (Paid)
                                        </button>
                                        {d.payment_status === "pending" && (
                                          <button onClick={() => { saveField(d.id, "payment_status", "received"); updateLocal(d.id, "payment_status", "received"); }}
                                            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24", padding: "5px 10px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, textAlign: "left" }}>
                                            ✓ Mark Payment Received
                                          </button>
                                        )}
                                      </div>
                                    </div>
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
