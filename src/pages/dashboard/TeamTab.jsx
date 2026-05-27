import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import {
  Users,
  Check,
  X,
  UserPlus,
  Copy,
  Link,
  ToggleLeft,
  ToggleRight,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Send,
} from "lucide-react";

const SERVER_URL = "https://lemdkdizdlcirhbzqlos.supabase.co/functions/v1";

const T = {
  cardDark: {
    position: 'relative',
    background: 'rgba(8,10,18,0.95)',
    border: '1px solid rgba(255,255,255,0.055)',
  },
  divider: { borderBottom: '1px solid rgba(255,255,255,0.048)' },
  btnRed: {
    background: 'linear-gradient(135deg, rgba(59,130,246,0.9), rgba(29,78,216,0.95))',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 2px 12px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.12)',
  },
};

function TeamTab({ managerDealership, dealerId }) {
  const [salespeople, setSalespeople] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [teamError, setTeamError] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [addSuccess, setAddSuccess] = useState("");
  const [copiedId, setCopiedId] = useState(null);
  const [copiedPw, setCopiedPw] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [newRole, setNewRole] = useState("salesman");
  const [teamTab, setTeamTab] = useState("salesman");
  const [msgTarget, setMsgTarget] = useState('all');
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [msgDone, setMsgDone] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+60");
  const [slug, setSlug] = useState("");
  const [tempPw, setTempPw] = useState("");
  const [createdAccount, setCreatedAccount] = useState(null); // one-time password modal
  const [teamSoldCount, setTeamSoldCount] = useState(0);
  const [analyticsMap, setAnalyticsMap] = useState({});
  const [salesmanStatsMap, setSalesmanStatsMap] = useState({});

  const fetchAnalytics = async () => {
    if (!dealerId) return;
    const { data } = await supabase
      .from("analytics_events")
      .select("salesman_slug,event_type")
      .eq("dealer_id", dealerId);   // scope to this dealer's salesmen only
    if (!data) return;
    const map = {};
    data.forEach(({ salesman_slug, event_type }) => {
      if (!map[salesman_slug]) map[salesman_slug] = { clicks: 0, whatsapp: 0 };
      if (event_type === "link_visit" || event_type === "car_view")
        map[salesman_slug].clicks++;
      if (event_type === "whatsapp_click")
        map[salesman_slug].whatsapp++;
    });
    setAnalyticsMap(map);
  };

  const fetchSalesmanStats = async () => {
    if (!dealerId) return;
    const [{ data: soldData }, { data: leadsData }] = await Promise.all([
      supabase
        .from("car_listings")
        .select("assigned_to")
        .eq("dealer_id", dealerId)
        .eq("status", "sold"),
      supabase
        .from("leads")
        .select("salesman_id, stage")
        .eq("dealer_id", dealerId)
        .eq("is_deleted", false),
    ]);
    const map = {};
    (soldData || []).forEach(({ assigned_to }) => {
      if (!assigned_to) return;
      if (!map[assigned_to]) map[assigned_to] = { sold: 0, activeLeads: 0 };
      map[assigned_to].sold++;
    });
    const CLOSED = ["won", "lost", "closed_won", "closed_lost"];
    (leadsData || []).forEach(({ salesman_id, stage }) => {
      if (!salesman_id) return;
      if (!map[salesman_id]) map[salesman_id] = { sold: 0, activeLeads: 0 };
      if (!CLOSED.includes(stage)) map[salesman_id].activeLeads++;
    });
    setSalesmanStatsMap(map);
  };

  useEffect(() => {
    fetchTeam();
    fetchAnalytics();
    fetchSalesmanStats();
  }, [managerDealership]);

  useEffect(() => {
    if (!managerDealership || !dealerId) return;
    const fetchSold = async () => {
      const { count } = await supabase
        .from("car_listings")
        .select("id", { count: "exact", head: true })
        .eq("dealer_id", dealerId)
        .eq("status", "sold");
      setTeamSoldCount(count || 0);
    };
    fetchSold();
    const ch = supabase
      .channel("team_sold")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "car_listings", filter: `dealer_id=eq.${dealerId}` },
        fetchSold,
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [managerDealership, dealerId]);

  const fetchTeam = async () => {
    if (!managerDealership) {
      setSalespeople([]);
      setTeamError("Dealership profile missing.");
      setLoadingTeam(false);
      return;
    }
    setLoadingTeam(true);
    setTeamError("");
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["salesman","manager","accountant","fi_officer","admin"])
      .eq("dealer_id", dealerId)
      .order("created_at", { ascending: false });
    if (error) {
      setTeamError(error.message || "Failed to load team.");
      setSalespeople([]);
    } else setSalespeople(data || []);
    setLoadingTeam(false);
  };

  const slugify = (v) =>
    v
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "");
  const handleNameChange = (v) => {
    setName(v);
    setSlug(slugify(v.trim().split(/\s+/)[0]));
  };
  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("+60");
    setSlug("");
    setTempPw("");
    setAddError("");
    setAddSuccess("");
    setNewRole("salesman");
  };

  const handleAdd = async () => {
    setAddError("");
    const n = name.trim(),
      e = email.trim().toLowerCase(),
      s = slug.trim(),
      p = phone.trim() || null;
    if (!managerDealership) {
      setAddError("Dealership required.");
      return;
    }
    const isSalesman = newRole === "salesman";
    if (!n || !e || !s || (!isSalesman && !tempPw)) {
      setAddError("All fields required.");
      return;
    }
    if (!isSalesman && tempPw.length < 8) {
      setAddError("Password min 8 chars.");
      return;
    }
    if (!/^[a-z0-9]+$/.test(s)) {
      setAddError("Slug: lowercase + numbers only.");
      return;
    }
    setAddLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (isSalesman) {
        // Auth-first salesman creation via edge function
        const res = await fetch(`${SERVER_URL}/create-salesman`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            email: e,
            full_name: n,
            phone: p,
            slug: s,
            dealer_id: dealerId,
            plan: "salesman_full",
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddError(
            data.error === "email_taken"
              ? "Email already in use."
              : data.message || data.error || "Failed to create account.",
          );
          setAddLoading(false);
          return;
        }
        setShowAddForm(false);
        setCreatedAccount({ full_name: n, email: e, temp_password: data.temp_password });
        await fetchTeam();
        resetForm();
      } else {
        // Non-salesman roles use existing invites function
        const res = await fetch(`${SERVER_URL}/invites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            full_name: n,
            email: e,
            phone: p,
            dealership: managerDealership,
            dealer_id: dealerId,
            slug: s,
            password: tempPw,
            role: newRole,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAddError(data.message || "Failed.");
          setAddLoading(false);
          return;
        }
        setSalespeople((prev) => [data.invite, ...prev]);
        setAddSuccess(`${n} added successfully.`);
        resetForm();
        setShowAddForm(false);
      }
    } catch {
      setAddError("Server unreachable.");
    }
    setAddLoading(false);
  };

  const copyLink = (s) => {
    navigator.clipboard.writeText(
      `${window.location.origin}/cars?ref=${s.slug}`,
    );
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 2000);
  };
  const toggleActive = async (s) => {
    setTogglingId(s.id);
    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !s.is_active })
      .eq("id", s.id);
    if (!error)
      setSalespeople((p) =>
        p.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)),
      );
    setTogglingId(null);
  };
  const deleteSalesman = async (id) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(`${SERVER_URL}/invites/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    if (res.ok) setSalespeople((p) => p.filter((x) => x.id !== id));
    setDeleteConfirmId(null);
  };

  const ROLE_COLORS = {
    salesman:   '#3b82f6',
    manager:    '#f97316',
    accountant: '#22c55e',
    fi_officer: '#a855f7',
    admin:      '#94a3b8',
  };
  const ROLE_TABS = [
    { role: 'salesman',   label: 'Salesmen',    color: '#3b82f6' },
    { role: 'manager',    label: 'Managers',    color: '#f97316' },
    { role: 'accountant', label: 'Accountants', color: '#22c55e' },
    { role: 'fi_officer', label: 'F&I',         color: '#a855f7' },
    { role: 'admin',      label: 'Admins',      color: '#94a3b8' },
  ];

  const activeCount = salespeople.filter((s) => s.is_active !== false).length;
  const inactiveCount = salespeople.filter((s) => s.is_active === false).length;
  const activeRate = salespeople.length
    ? Math.round((activeCount / salespeople.length) * 100)
    : 0;
  const inputCls =
    "w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-red-600/10 transition-all";

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-3"
        style={{
          background: "rgba(34,197,94,0.05)",
          border: "1px solid rgba(34,197,94,0.15)",
        }}
      >
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="flex-1">
          <p className="text-emerald-300 text-sm font-semibold">
            {teamSoldCount} car{teamSoldCount !== 1 ? "s" : ""} sold
          </p>
          <p className="text-emerald-600/60 text-xs">
            Live count · updates automatically
          </p>
        </div>
        <p className="text-3xl font-black grad-green tabular-nums">
          {teamSoldCount}
        </p>
      </div>
      <div className="card-top rounded-xl overflow-hidden" style={T.cardDark}>
        <div
          className="flex items-center justify-between gap-3 p-4"
          style={T.divider}
        >
          <div>
            <h2 className="font-semibold text-white">Salespeople</h2>
            <p className="text-xs text-gray-600 mt-0.5 hidden sm:block">
              {salespeople.length > 0
                ? `${activeCount} active · ${inactiveCount} inactive · ${activeRate}% active rate`
                : "Manage accounts, links, and status."}
            </p>
          </div>
          <button
            onClick={() => {
              setShowAddForm(true);
              resetForm();
            }}
            disabled={!managerDealership}
            className="btn-shimmer inline-flex items-center gap-2 text-white px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
            style={T.btnRed}
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Salesman</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
        {/* Role tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', overflowX: 'auto' }}>
          {ROLE_TABS.map(({ role, label, color }) => {
            const count = salespeople.filter(s => s.role === role).length;
            return (
              <button
                key={role}
                onClick={() => setTeamTab(role)}
                style={{
                  padding: '10px 16px',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: 'none',
                  color: teamTab === role ? '#f3f4f6' : '#6b7280',
                  borderBottom: teamTab === role ? `2px solid ${color}` : '2px solid transparent',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
                {label}
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  padding: '1px 7px', borderRadius: 10,
                  background: teamTab === role ? `${color}18` : 'rgba(255,255,255,0.05)',
                  color: teamTab === role ? color : '#4b5563',
                }}>{count}</span>
              </button>
            );
          })}
        </div>
        {teamError && (
          <div
            className="m-4 rounded-lg px-3 py-2.5 text-amber-300 text-xs"
            style={{
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.14)",
            }}
          >
            ⚠ {teamError}
          </div>
        )}
        {loadingTeam ? (
          <div className="p-12 text-center text-gray-600 text-sm">
            Loading team...
          </div>
        ) : salespeople.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{
                background: "rgba(59,130,246,0.07)",
                border: "1px solid rgba(59,130,246,0.12)",
              }}
            >
              <Users className="w-5 h-5 text-blue-500/40" />
            </div>
            <p className="text-gray-600 text-sm mb-4">
              No salespeople added yet
            </p>
            <button
              onClick={() => {
                setShowAddForm(true);
                resetForm();
              }}
              disabled={!managerDealership}
              className="btn-shimmer text-white px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={T.btnRed}
            >
              Add your first salesman
            </button>
          </div>
        ) : (
          <div>
            {(() => {
              const filteredTeam = salespeople.filter(s => s.role === teamTab);
              return (
                <>
                  {filteredTeam.length === 0 && (
                    <div style={{ padding: '32px', textAlign: 'center', color: '#4b5563', fontSize: 13 }}>
                      No {ROLE_TABS.find(t => t.role === teamTab)?.label} yet.
                    </div>
                  )}
                  {filteredTeam.map((s) => (
              <div
                key={s.id}
                className={`p-4 transition-colors ${s.is_active === false ? "opacity-50" : "hover:bg-white/[0.02]"}`}
              >
                <div className="flex items-start gap-3">
                  {s.avatar_url ? (
                    <img
                      src={s.avatar_url}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg,#3b82f6,#7c3aed)",
                      }}
                    >
                      {(s.full_name || "S")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLORS[s.role] || '#6b7280', flexShrink: 0 }} />
                      <p className="font-semibold text-white truncate">
                        {s.full_name}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium border ${s.is_active !== false ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/20" : "bg-white/5 text-gray-500 border-white/8"}`}
                      >
                        {s.is_active !== false ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2 text-xs text-gray-500">
                      <span className="truncate max-w-[200px]">{s.email}</span>
                      {s.phone && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span>{s.phone}</span>
                        </>
                      )}
                    </div>
                    {s.slug ? (
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-500"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <Link className="w-3 h-3 text-gray-600" />
                          /cars?ref=
                          <span className="text-white font-medium">
                            {s.slug}
                          </span>
                        </div>
                        <button
                          onClick={() => copyLink(s)}
                          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white rounded-lg px-2 py-1.5 transition-all"
                          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          {copiedId === s.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <span
                          className="text-xs text-amber-500/70 px-2.5 py-1.5 rounded-lg"
                          style={{
                            background: "rgba(251,191,36,0.06)",
                            border: "1px solid rgba(251,191,36,0.12)",
                          }}
                        >
                          ⚠ No slug — referral link unavailable
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 max-w-[200px]">
                      {[
                        [String(analyticsMap[s.slug]?.clicks || 0), "Clicks"],
                        [String(analyticsMap[s.slug]?.whatsapp || 0), "WhatsApp"],
                        [String(salesmanStatsMap[s.id]?.sold || 0), "Sold"],
                        [String(salesmanStatsMap[s.id]?.activeLeads || 0), "Active Leads"],
                      ].map(([v, lbl]) => (
                        <div
                          key={lbl}
                          className="rounded-lg px-2.5 py-2"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          <p
                            className={`text-sm font-bold ${lbl === "Sold" && Number(v) > 0 ? "grad-green" : lbl === "WhatsApp" && Number(v) > 0 ? "grad-green" : "grad-white"}`}
                          >
                            {v}
                          </p>
                          <p className="text-[10px] text-gray-600 mt-0.5">
                            {lbl}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => toggleActive(s)}
                      disabled={togglingId === s.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-white transition-all disabled:opacity-40"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {s.is_active !== false ? (
                        <>
                          <ToggleRight className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="hidden sm:inline">Deactivate</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-3.5 h-3.5 text-gray-600" />
                          <span className="hidden sm:inline">Activate</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setDeleteConfirmId(s.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-blue-500 hover:bg-blue-500/10 transition-all"
                      style={{ border: "1px solid rgba(59,130,246,0.18)" }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
                </>
              );
            })()}
          </div>
        )}
      </div>
      {deleteConfirmId && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md"
            style={undefined}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-white">Remove Salesman?</h3>
                <p className="text-gray-500 text-xs mt-0.5">
                  Deletes their account and referral link permanently.
                </p>
              </div>
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteSalesman(deleteConfirmId)}
                className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                style={T.btnRed}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── One-time Password Modal ── */}
      {createdAccount && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.82)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl p-5 w-full max-w-md relative"
            style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.22)" }}
                >
                  <Check className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Account Created</h3>
                  <p className="text-gray-500 text-xs mt-0.5">Share these credentials with your salesman</p>
                </div>
              </div>
              <button
                onClick={() => setCreatedAccount(null)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="rounded-xl px-3.5 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Name</p>
                <p className="text-white text-sm font-medium">{createdAccount.full_name}</p>
              </div>
              <div className="rounded-xl px-3.5 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Email</p>
                <p className="text-white text-sm font-medium">{createdAccount.email}</p>
              </div>
              <div className="rounded-xl px-3.5 py-3" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Temporary Password</p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(createdAccount.temp_password);
                      setCopiedPw(true);
                      setTimeout(() => setCopiedPw(false), 2000);
                    }}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-all"
                    style={copiedPw
                      ? { color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }
                      : { color: "#9ca3af", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {copiedPw ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <p className="text-white text-base font-mono font-bold tracking-widest">{createdAccount.temp_password}</p>
              </div>
            </div>

            <div
              className="rounded-xl px-3.5 py-2.5 mb-4 flex items-start gap-2.5"
              style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.16)" }}
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-300/80 text-xs leading-relaxed">
                This password will <span className="font-semibold text-amber-300">not be shown again</span>. Share it securely with your salesman now.
              </p>
            </div>

            <button
              onClick={() => setCreatedAccount(null)}
              className="btn-shimmer w-full px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
              style={T.btnRed}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {/* ── Message Team Panel ── */}
      {(() => {
        const MSG_ROLES = [
          { value: 'all',        label: 'Everyone',    color: '#f3f4f6' },
          { value: 'salesman',   label: 'Salesmen',    color: '#3b82f6' },
          { value: 'manager',    label: 'Managers',    color: '#f97316' },
          { value: 'accountant', label: 'Accountants', color: '#22c55e' },
          { value: 'fi_officer', label: 'F&I',         color: '#a855f7' },
          { value: 'admin',      label: 'Admins',      color: '#94a3b8' },
        ];
        const recipients = salespeople.filter(s =>
          (msgTarget === 'all' || s.role === msgTarget) && s.is_active !== false
        );
        const sendToTeam = async () => {
          if (!msgText.trim() || recipients.length === 0 || msgSending) return;
          setMsgSending(true);
          const inserts = recipients.map(s => ({
            salesman_id: s.id,
            type: 'broadcast',
            title: '📢 Message from Owner',
            body: msgText.trim(),
          }));
          const { error } = await supabase.from('salesman_notifications').insert(inserts);
          setMsgSending(false);
          if (error) { alert('Failed to send: ' + error.message); return; }
          setMsgDone(true);
          setMsgText('');
          setTimeout(() => setMsgDone(false), 3000);
        };
        return (
          <div className="rounded-xl overflow-hidden" style={T.cardDark}>
            {/* Header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: '#f3f4f6', margin: 0 }}>Message Team</h2>
                <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>Sends to each member's dashboard notification</p>
              </div>
              <Send style={{ width: 16, height: 16, color: '#4b5563' }} />
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Role filter pills */}
              <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>Send To</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {MSG_ROLES.map(({ value, label, color }) => {
                  const cnt = value === 'all'
                    ? salespeople.filter(s => s.is_active !== false).length
                    : salespeople.filter(s => s.role === value && s.is_active !== false).length;
                  return (
                    <button
                      key={value}
                      onClick={() => setMsgTarget(value)}
                      style={{
                        padding: '6px 14px', borderRadius: 20,
                        border: `1px solid ${msgTarget === value ? color : 'rgba(255,255,255,0.08)'}`,
                        background: msgTarget === value ? `${color}18` : 'rgba(255,255,255,0.03)',
                        color: msgTarget === value ? color : '#6b7280',
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                        display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
                      }}
                    >
                      {value !== 'all' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />}
                      {label}
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                        background: msgTarget === value ? `${color}22` : 'rgba(255,255,255,0.05)',
                        color: msgTarget === value ? color : '#4b5563',
                      }}>{cnt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Recipient preview */}
              {recipients.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {recipients.map(s => (
                    <span key={s.id} style={{ fontSize: 11, color: '#9ca3af', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '2px 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: ROLE_COLORS[s.role] || '#6b7280', flexShrink: 0, display: 'inline-block' }} />
                      {s.full_name}
                    </span>
                  ))}
                </div>
              )}

              {/* Message input */}
              <p style={{ fontSize: 10, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 6px' }}>Message</p>
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                rows={4}
                placeholder="Type your message here…"
                style={{
                  width: '100%', boxSizing: 'border-box', resize: 'vertical',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '10px 12px', color: '#f3f4f6', fontSize: 13,
                  fontFamily: "'DM Sans',sans-serif", outline: 'none', lineHeight: 1.6,
                  marginBottom: 12,
                }}
              />

              <button
                onClick={sendToTeam}
                disabled={!msgText.trim() || recipients.length === 0 || msgSending}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 16px', borderRadius: 10, cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600,
                  border: 'none', transition: 'all 0.15s',
                  ...(msgDone
                    ? { background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }
                    : { ...T.btnRed, opacity: (!msgText.trim() || recipients.length === 0) ? 0.4 : 1 }),
                }}
              >
                {msgDone ? (
                  <><Check style={{ width: 15, height: 15 }} /> Sent to {recipients.length} member{recipients.length !== 1 ? 's' : ''}</>
                ) : msgSending ? (
                  'Sending…'
                ) : (
                  <><Send style={{ width: 14, height: 14 }} /> Send to {recipients.length} member{recipients.length !== 1 ? 's' : ''}</>
                )}
              </button>
            </div>
          </div>
        );
      })()}

      {showAddForm && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          style={{ background: "rgba(0,0,0,0.78)" }}
        >
          <div
            className="modal-top rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col"
            style={undefined}
          >
            <div
              className="flex items-center justify-between px-5 py-4 flex-shrink-0"
              style={T.divider}
            >
              <div>
                <h3 className="font-semibold text-white">Add Salesman</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Create account and trackable referral link
                </p>
              </div>
              <button
                onClick={() => setShowAddForm(false)}
                className="text-gray-500 hover:text-white p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              {addSuccess ? (
                <div className="text-center py-8">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{
                      background: "rgba(52,211,153,0.12)",
                      border: "1px solid rgba(52,211,153,0.22)",
                    }}
                  >
                    <Check className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-emerald-400 font-semibold mb-1">
                    Salesman added!
                  </p>
                  <p className="text-gray-500 text-sm mb-6">{addSuccess}</p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      Done
                    </button>
                    <button
                      onClick={resetForm}
                      className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold"
                      style={T.btnRed}
                    >
                      Add Another
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Role selector */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-2.5">Select Role</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { role: 'salesman',   label: 'Salesman',    color: '#3b82f6', desc: 'Sells cars, manages leads' },
                        { role: 'manager',    label: 'Manager',     color: '#f97316', desc: 'Manages sales team' },
                        { role: 'accountant', label: 'Accountant',  color: '#22c55e', desc: 'Financial view only' },
                        { role: 'fi_officer', label: 'F&I Officer', color: '#a855f7', desc: 'Finance & insurance' },
                        { role: 'admin',      label: 'Admin',       color: '#94a3b8', desc: 'Listings management' },
                      ].map(({ role, label, color, desc }) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setNewRole(role)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: `1px solid ${newRole === role ? color : 'rgba(255,255,255,0.08)'}`,
                            background: newRole === role ? `${color}18` : 'rgba(255,255,255,0.03)',
                            cursor: 'pointer',
                            fontFamily: "'DM Sans',sans-serif",
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                            <span style={{ fontSize: 13, fontWeight: 600, color: newRole === role ? color : '#9ca3af' }}>{label}</span>
                          </div>
                          <p style={{ fontSize: 10, color: '#4b5563', margin: '2px 0 0', textAlign: 'left' }}>{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        placeholder="Ahmad bin Abdullah"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        autoComplete="off"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Email *
                      </label>
                      <input
                        type="email"
                        placeholder="ahmad@autocity.my"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                        Phone
                      </label>
                      <div className={`flex items-center overflow-hidden ${inputCls}`} style={{ padding:0 }}>
                        <span className="px-3 py-2.5 text-gray-500 text-sm whitespace-nowrap border-r border-gray-700 bg-gray-800/50 flex-shrink-0">+60</span>
                        <input
                          type="tel"
                          value={(phone||'').replace(/^\+?60/,'')}
                          onChange={(e) => setPhone('+60'+e.target.value.replace(/\D/g,''))}
                          placeholder="X-XXXXXXX"
                          autoComplete="off"
                          className="flex-1 bg-transparent border-none outline-none text-white text-sm px-3 py-2.5"
                        />
                      </div>
                    </div>
                    {newRole !== "salesman" && (
                      <div>
                        <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                          Temp Password *
                        </label>
                        <input
                          type="text"
                          placeholder="Min 8 characters"
                          value={tempPw}
                          onChange={(e) => setTempPw(e.target.value)}
                          autoComplete="off"
                          className={inputCls}
                        />
                      </div>
                    )}
                    {newRole === "salesman" && (
                      <div className="flex items-end">
                        <div
                          className="w-full rounded-xl px-3 py-2.5 text-xs text-emerald-400"
                          style={{
                            background: "rgba(52,211,153,0.06)",
                            border: "1px solid rgba(52,211,153,0.18)",
                          }}
                        >
                          Password auto-generated — shown once after creation.
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                      Unique Slug *
                    </label>
                    <div className="flex">
                      <span
                        className="rounded-l-xl px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap"
                        style={{
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRight: "none",
                        }}
                      >
                        /cars?ref=
                      </span>
                      <input
                        type="text"
                        placeholder="ahmad"
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value))}
                        autoComplete="off"
                        className="flex-1 rounded-r-xl px-3 py-2.5 text-sm text-white placeholder-gray-700 focus:outline-none focus:border-blue-500/50 transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-700 mt-1">
                      Auto-filled from first name. Lowercase + numbers only.
                    </p>
                  </div>
                  {addError && (
                    <div
                      className="rounded-xl px-3 py-2.5 text-blue-400 text-xs"
                      style={{
                        background: "rgba(59,130,246,0.07)",
                        border: "1px solid rgba(59,130,246,0.18)",
                      }}
                    >
                      ⚠ {addError}
                    </div>
                  )}
                  <div className="flex gap-3 pt-1">
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="flex-1 px-4 py-2.5 rounded-xl text-sm text-gray-500 hover:text-white transition-all"
                      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={addLoading}
                      className="btn-shimmer flex-1 px-4 py-2.5 rounded-xl text-sm text-white font-semibold disabled:opacity-40"
                      style={T.btnRed}
                    >
                      {addLoading ? "Creating..." : newRole === "salesman" ? "Create Salesman" : "Add Team Member"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TeamTab;
