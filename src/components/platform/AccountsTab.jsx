import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { platformClient as supabase } from "../../lib/platformClient";
import { PLAN_CONFIG } from "../../utils/planConfig";

// One accounts table (P5) with an account record (P6).
//
// Dealers and Salesmen were two tabs, two search boxes, two filter sets and two
// standards: the paying account could not be deleted while the growth account
// could be destroyed in one click, dealers had performance columns and salesmen
// had none. They are the same object with a different `role`.
//
// P6 is the bigger half: to understand ONE account you used to visit Dealers
// (who they are), Billing (what they pay), Approvals (what they submitted) and
// Activity Log (what they did) — four tabs, four searches, and you assembled the
// picture in your head. Clicking a row now opens that picture, and every action
// on an account lives there rather than as a row of buttons in the table.

const ROLE_FILTERS = [
  { id: "all", label: "All" },
  { id: "dealer", label: "Dealers" },
  { id: "solo", label: "Standalone sellers" },
  { id: "linked", label: "Under a dealer" },
];

const STATUS_FILTERS = [
  { id: "all", label: "Any status" },
  { id: "active", label: "Active" },
  { id: "trial", label: "On trial" },
  { id: "expired", label: "Expired" },
  { id: "suspended", label: "Suspended" },
  { id: "deleted", label: "Deleted" },
];

// Written as something the seller can act on, not a verdict about them — this
// text is shown to them verbatim in SuspendedBanner and pushed to their phone.
const SUSPEND_REASONS = [
  "Unpaid subscription — settle the outstanding amount to reactivate",
  "A listing did not match the actual vehicle",
  "Repeated buyer complaints about this account",
  "Suspected duplicate or fake listings",
  "We could not verify your identity documents",
  "Temporary hold while we look into a report",
  "Breach of the seller terms",
];

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(str) {
  if (!str) return null;
  return Math.ceil((new Date(str) - Date.now()) / 86400000);
}

function sinceLabel(str) {
  if (!str) return "never";
  const d = Math.floor((Date.now() - new Date(str)) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  if (d < 365) return `${Math.floor(d / 30)} mo ago`;
  return `${Math.floor(d / 365)} yr ago`;
}

// A row's kind, stated once. "dealer_id IS NULL means they are their own
// dealer" is the rule the whole platform turns on, so it is named here rather
// than re-derived inline every time it is needed.
function accountKind(a) {
  if (["dealer", "owner", "superadmin"].includes(a.role)) return "dealer";
  return a.dealer_id ? "linked" : "solo";
}

function kindLabel(a) {
  const k = accountKind(a);
  if (k === "dealer") return PLAN_CONFIG[a.plan]?.label || "Dealer";
  if (k === "linked") return "Salesman · under a dealer";
  return a.plan === "salesman_full" ? "Salesman Premium" : "Salesman Lite";
}

// Deleted rows also carry is_active=false, so 'deleted' must be checked first
// or a soft-deleted account reads as merely suspended.
//
// A brand-new signup (or a rejected one) is ALSO is_active=false — approval
// never flips it true until decide_user_approval runs — but neither was ever
// suspended. Only set_account_suspended() stamps suspended_at, so that is the
// one reliable "actually suspended" signal; approval_status carries the rest.
// Without this split, every unreviewed seller showed up here as "Suspended"
// with a "Reinstate" button that would have activated them while skipping the
// real approval flow entirely (no approved_by/is_verified stamp, no KYC check).
function statusOf(a) {
  if (a.account_status === "deleted") {
    const left = a.deleted_at
      ? Math.max(0, 30 - Math.floor((Date.now() - new Date(a.deleted_at)) / 86400000))
      : null;
    return { id: "deleted", text: left !== null ? `Deleted · purges in ${left}d` : "Deleted", color: "#9ca3af" };
  }
  if (a.is_active === false && a.suspended_at) return { id: "suspended", text: "Suspended", color: "#f87171" };
  if (a.approval_status === "pending") return { id: "pending_review", text: "Pending review", color: "#facc15" };
  if (a.approval_status === "rejected") return { id: "rejected", text: "Rejected", color: "#f87171" };
  if (a.subscription_status === "trial") {
    const left = daysUntil(a.trial_ends_at);
    return { id: "trial", text: left === null ? "Trial" : left < 0 ? "Trial ended" : `Trial · ${left}d left`, color: "#facc15" };
  }
  if (a.subscription_status === "expired") return { id: "expired", text: "Expired", color: "#f87171" };
  return { id: "active", text: "Active", color: "#4ade80" };
}

// "They have done their part; nobody has reviewed it yet." — the state an
// operator most needs to spot while scanning the list, and the one the table
// never showed: ic_last4 / kyc_submitted_at were fetched with every row
// (AdminPage.jsx:506) but only rendered as plain text deep inside the drawer,
// so an account waiting on an ID check looked identical to one that had never
// submitted anything. No extra query — both columns are already on the row.
//
// Suppressed once is_verified, because the green "verified" pill beside it
// then says strictly more, and two pills about the same fact is noise.
const icSubmitted = (a) => !a.is_verified && Boolean(a.kyc_submitted_at || a.ic_last4);

function Pill({ children, color = "#94a3b8", bg = "rgba(148,163,184,0.14)" }) {
  return (
    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: bg, color, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function Field({ label, value, mono }) {
  if (value === null || value === undefined || value === "" || value === "—") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "5px 0", fontSize: 12.5, borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      <span style={{ color: "#6b7280", flexShrink: 0 }}>{label}</span>
      <span style={{ color: "#e5e7eb", fontWeight: 600, textAlign: "right", wordBreak: "break-word", fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p style={{ margin: "22px 0 8px", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>
      {children}
    </p>
  );
}

const btn = (tone = "neutral") => {
  const tones = {
    neutral: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.1)", "#9ca3af"],
    good: ["rgba(74,222,128,0.1)", "rgba(74,222,128,0.3)", "#4ade80"],
    warn: ["rgba(251,191,36,0.1)", "rgba(251,191,36,0.3)", "#fbbf24"],
    bad: ["rgba(220,38,38,0.1)", "rgba(220,38,38,0.32)", "#f87171"],
  };
  const [background, borderColor, color] = tones[tone] || tones.neutral;
  return {
    background, color, border: `1px solid ${borderColor}`, borderRadius: 7,
    padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  };
};

export default function AccountsTab({ accounts, stats, loading, error, setError, onRefresh, onPatch, focusId, onFocusHandled }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("created_at");
  const [openId, setOpenId] = useState(null);
  const [suspendFor, setSuspendFor] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  // "Show this dealer's team" (A8). Filters by dealer_id -- a linked salesman
  // has no dealership of their own, so searching the dealer's name would match
  // nothing.
  const [teamOf, setTeamOf] = useState(null);
  const [busy, setBusy] = useState(null);
  const [saved, setSaved] = useState(null);
  // A9: billing state used to write straight through on the change event, so a
  // misclick moved a dealer between trial/active/expired silently and there was
  // no way back. The previous value is kept for a moment so it can be put back.
  const [undo, setUndo] = useState(null);

  // Global search (P7) and the dealer <-> team links (A8) both arrive as an id
  // to open. Clearing the filters as well, or the row we are told to show can
  // be filtered out from under us.
  // The callback is held in a ref and the effect keys on focusId only: the host
  // passes an inline arrow, so keying on it would re-run this on every render.
  const onFocusHandledRef = useRef(onFocusHandled);
  onFocusHandledRef.current = onFocusHandled;
  useEffect(() => {
    if (!focusId) return;
    setSearch(""); setRoleFilter("all"); setStatusFilter("all"); setTeamOf(null);
    setOpenId(focusId);
    onFocusHandledRef.current?.();
  }, [focusId]);

  // Overlay rule 2: lock body scroll while the record is open.
  useEffect(() => {
    if (!openId) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [openId]);

  const byId = useMemo(() => {
    const m = {};
    accounts.forEach(a => { m[a.id] = a; });
    return m;
  }, [accounts]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts
      .filter(a => {
        if (teamOf && a.dealer_id !== teamOf) return false;
        if (roleFilter !== "all" && accountKind(a) !== roleFilter) return false;
        if (statusFilter !== "all" && statusOf(a).id !== statusFilter) return false;
        if (!q) return true;
        return [a.full_name, a.email, a.dealership, a.subdomain, a.slug, a.phone, a.whatsapp_number]
          .some(v => v && String(v).toLowerCase().includes(q));
      })
      .sort((a, b) => {
        if (sortBy === "activity") return (stats[b.id]?.last_active_at ? new Date(stats[b.id].last_active_at) : 0) - (stats[a.id]?.last_active_at ? new Date(stats[a.id].last_active_at) : 0);
        if (sortBy === "listings") return (stats[b.id]?.listings || 0) - (stats[a.id]?.listings || 0);
        if (sortBy === "name") return (a.dealership || a.full_name || "").localeCompare(b.dealership || b.full_name || "");
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [accounts, stats, search, roleFilter, statusFilter, sortBy, teamOf]);

  const open = openId ? byId[openId] : null;

  function flash(id) {
    setSaved(id);
    setTimeout(() => setSaved(s => (s === id ? null : s)), 2000);
  }

  async function run(id, label, fn) {
    setBusy(id); setError(null);
    const { error: e } = await fn();
    setBusy(null);
    if (e) { setError(`${label} failed: ${e.message}`); return false; }
    flash(id);
    return true;
  }

  const saveField = (a, field, value) =>
    run(a.id, `Saving ${field}`, async () => {
      const r = await supabase.from("profiles").update({ [field]: value }).eq("id", a.id);
      if (!r.error) onPatch(a.id, { [field]: value });
      return r;
    });

  // Same write, plus a short window to put it back (A9).
  const saveBillingField = async (a, field, value, label) => {
    const prev = a[field] ?? null;
    if (prev === value) return;
    const ok = await saveField(a, field, value);
    if (!ok) return;
    const token = { id: a.id, field, prev, label };
    setUndo(token);
    setTimeout(() => setUndo(u => (u === token ? null : u)), 10000);
  };

  // Verification is available for every account type now (A6): e-KYC gives solo
  // sellers a badge on their marketplace cards, but the only way to grant one
  // was to catch them in the review queue.
  const toggleVerified = async (a) => {
    const next = !a.is_verified;
    const { data: { user } } = await supabase.auth.getUser();
    const patch = next
      ? { is_verified: true, verified_at: new Date().toISOString(), verified_by: user?.id ?? null }
      : { is_verified: false, verified_at: null, verified_by: null };
    await run(a.id, next ? "Verifying" : "Removing verification", async () => {
      const r = await supabase.from("profiles").update(patch).eq("id", a.id);
      if (!r.error) onPatch(a.id, patch);
      return r;
    });
  };

  // Suspend/unsuspend goes through set_account_suspended, which also writes the
  // reason and notifies the seller (A5). Never write is_active here directly.
  const setSuspended = async (a, suspended, reason) => {
    const ok = await run(a.id, suspended ? "Suspending" : "Reinstating", () =>
      supabase.rpc("set_account_suspended", { p_user_id: a.id, p_suspended: suspended, p_reason: reason || null }));
    if (ok) {
      onPatch(a.id, suspended
        ? { is_active: false, suspension_reason: reason || null, suspended_at: new Date().toISOString() }
        : { is_active: true, suspension_reason: null, suspended_at: null });
      setSuspendFor(null); setSuspendReason("");
    }
  };

  // Soft delete: the same three columns delete-account writes, so admin and
  // self-service deletion land in one state and the 30-day purge covers both.
  const softDelete = async (a) => {
    const patch = { account_status: "deleted", is_active: false, deleted_at: new Date().toISOString() };
    const ok = await run(a.id, "Deleting", async () => {
      const r = await supabase.from("profiles").update(patch).eq("id", a.id);
      if (!r.error) onPatch(a.id, patch);
      return r;
    });
    if (ok) setConfirmDelete(null);
  };

  const restore = async (a) => {
    const patch = { account_status: "active", is_active: true, deleted_at: null };
    await run(a.id, "Restoring", async () => {
      const r = await supabase.from("profiles").update(patch).eq("id", a.id);
      if (!r.error) onPatch(a.id, patch);
      return r;
    });
  };

  const extendTrial = (a, days) =>
    run(a.id, "Extending trial", async () => {
      const trial_ends_at = new Date(Date.now() + days * 86400000).toISOString();
      const r = await supabase.from("profiles")
        .update({ trial_ends_at, subscription_status: "trial" }).eq("id", a.id);
      if (!r.error) onPatch(a.id, { trial_ends_at, subscription_status: "trial" });
      return r;
    });

  const markPaid = (a) =>
    run(a.id, "Marking paid", async () => {
      const patch = { payment_status: "received", subscription_status: "active" };
      const r = await supabase.from("profiles").update(patch).eq("id", a.id);
      if (!r.error) onPatch(a.id, patch);
      return r;
    });

  const counts = useMemo(() => ({
    all: accounts.length,
    dealer: accounts.filter(a => accountKind(a) === "dealer").length,
    solo: accounts.filter(a => accountKind(a) === "solo").length,
    linked: accounts.filter(a => accountKind(a) === "linked").length,
  }), [accounts]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Accounts</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Everyone who sells on the platform. Open a row for the full record.</p>
        </div>
        <button onClick={onRefresh} style={btn()}>↻ Refresh</button>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, padding: "10px 12px" }}>
          <span style={{ fontSize: 12, color: "#f87171", flex: 1, minWidth: 0 }}>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss"
            style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 12 }}>
        {ROLE_FILTERS.map(f => {
          const on = roleFilter === f.id;
          return (
            <button key={f.id} onClick={() => setRoleFilter(f.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 99, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
                background: on ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${on ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.08)"}`,
                color: on ? "#f87171" : "#9ca3af" }}>
              {f.label}
              <span style={{ fontSize: 11, fontWeight: 700, color: on ? "#f87171" : "#4b5563" }}>{counts[f.id]}</span>
            </button>
          );
        })}
      </div>

      {teamOf && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "8px 12px" }}>
          <span style={{ fontSize: 12, color: "#93c5fd", flex: 1, minWidth: 0 }}>
            Showing the team of {byId[teamOf]?.dealership || byId[teamOf]?.full_name || "that dealer"}
          </span>
          <button onClick={() => setTeamOf(null)} style={btn()}>Show everyone</button>
        </div>
      )}

      <div className="adm-toolbar" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, dealership, subdomain, phone…"
          className="adm-input adm-search" style={{ width: 300 }} />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="adm-select">
          {STATUS_FILTERS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="adm-select">
          <option value="created_at">Newest first</option>
          <option value="activity">Recently active</option>
          <option value="listings">Most listings</option>
          <option value="name">Name A–Z</option>
        </select>
        <span style={{ fontSize: 12, color: "#4b5563", marginLeft: "auto" }}>{rows.length} accounts</span>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Account", "Type", "Status", "Listings", "Leads", "Last active", "Joined", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>No accounts match those filters.</td></tr>
              ) : rows.map(a => {
                const st = statusOf(a);
                const s = stats[a.id] || {};
                // A dead account should read as dead at a glance (A4): no
                // listings and no leads is the signal, not a missing column.
                const dormant = !s.listings && !s.leads;
                return (
                  <tr key={a.id} className="adm-row" onClick={() => setOpenId(a.id)}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", opacity: st.id === "deleted" ? 0.45 : 1 }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <span style={{ fontWeight: 600, color: "#f0f0f0" }}>{a.dealership || a.full_name || "No name"}</span>
                        {a.is_verified && <Pill color="#4ade80" bg="rgba(74,222,128,0.14)">verified</Pill>}
                        {icSubmitted(a) && <Pill color="#60a5fa" bg="rgba(96,165,250,0.14)">IC submitted</Pill>}
                        {saved === a.id && <span style={{ fontSize: 10, color: "#4ade80" }}>✓</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{a.email}</div>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#9ca3af", whiteSpace: "nowrap" }}>{kindLabel(a)}</td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: st.color }}>{st.text}</span>
                    </td>
                    <td style={{ padding: "10px 14px", color: dormant ? "#374151" : "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>
                      {s.listings ?? 0}
                      {s.sold ? <span style={{ color: "#4ade80", fontSize: 11 }}> · {s.sold} sold</span> : null}
                    </td>
                    <td style={{ padding: "10px 14px", color: dormant ? "#374151" : "#e5e7eb", fontVariantNumeric: "tabular-nums" }}>{s.leads ?? 0}</td>
                    <td style={{ padding: "10px 14px", color: dormant ? "#4b5563" : "#9ca3af", whiteSpace: "nowrap" }}>{sinceLabel(s.last_active_at)}</td>
                    <td style={{ padding: "10px 14px", color: "#6b7280", whiteSpace: "nowrap" }}>{fmtDate(a.created_at)}</td>
                    <td style={{ padding: "10px 14px", color: "#475569" }}>›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Account record (P6) ─────────────────────────────────────────── */}
      {open && createPortal(
        <div onClick={() => setOpenId(null)}
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }}>
          <div key={open.id} onClick={e => e.stopPropagation()}
            style={{ width: "min(520px, 100%)", height: "100%", overflowY: "auto", background: "#0b0f16", borderLeft: "1px solid rgba(255,255,255,0.08)", padding: "22px 22px 60px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f1f5f9", wordBreak: "break-word" }}>
                  {open.dealership || open.full_name || "No name"}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280", wordBreak: "break-word" }}>{open.email}</p>
              </div>
              <button onClick={() => setOpenId(null)} aria-label="Close"
                style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <Pill color="#60a5fa" bg="rgba(96,165,250,0.14)">{kindLabel(open)}</Pill>
              <Pill color={statusOf(open).color} bg="rgba(255,255,255,0.06)">{statusOf(open).text}</Pill>
              {open.is_verified
                ? <Pill color="#4ade80" bg="rgba(74,222,128,0.14)">verified</Pill>
                : <Pill color="#f59e0b" bg="rgba(245,158,11,0.12)">not verified</Pill>}
              {icSubmitted(open) && <Pill color="#60a5fa" bg="rgba(96,165,250,0.14)">IC submitted</Pill>}
            </div>

            {open.is_active === false && open.suspension_reason && (
              <p style={{ margin: "14px 0 0", fontSize: 12, color: "#fca5a5", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "9px 11px" }}>
                Suspended {sinceLabel(open.suspended_at)}: {open.suspension_reason}
              </p>
            )}

            <SectionTitle>Actions</SectionTitle>
            {open.role === "superadmin" ? (
              // The console lists every account including the platform's own.
              // Nothing here should be able to suspend or delete the account
              // running it -- that is a locked door with the key inside.
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
                This is a platform administrator account. Suspend, delete and verification controls are not available here.
              </p>
            ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button disabled={busy === open.id} onClick={() => toggleVerified(open)} style={btn(open.is_verified ? "neutral" : "good")}>
                {open.is_verified ? "Remove verified badge" : "Mark verified"}
              </button>
              {open.account_status === "deleted" ? (
                <button disabled={busy === open.id} onClick={() => restore(open)} style={btn("good")}>Restore account</button>
              ) : (
                <>
                  {open.is_active === false && open.suspended_at ? (
                    <button disabled={busy === open.id} onClick={() => setSuspended(open, false)} style={btn("good")}>Reinstate</button>
                  ) : (
                    <button disabled={busy === open.id} onClick={() => { setSuspendReason(""); setSuspendFor(open); }} style={btn("warn")}>Suspend…</button>
                  )}
                  <button disabled={busy === open.id} onClick={() => setConfirmDelete(open)} style={btn("bad")}>Delete…</button>
                </>
              )}
            </div>
            )}

            <SectionTitle>Activity</SectionTitle>
            {(() => {
              const s = stats[open.id] || {};
              return (
                <>
                  <Field label="Listings" value={`${s.listings ?? 0} total · ${s.available ?? 0} live · ${s.sold ?? 0} sold${s.pending ? ` · ${s.pending} pending review` : ""}`} />
                  <Field label="Leads" value={s.leads ?? 0} />
                  <Field label="Enquiries" value={s.enquiries ?? 0} />
                  <Field label="Last activity" value={`${sinceLabel(s.last_active_at)}${s.last_active_at ? ` (${fmtDate(s.last_active_at)})` : ""}`} />
                  {accountKind(open) === "dealer" && (
                    <Field label="Team" value={
                      s.team ? (
                        <button onClick={() => { setOpenId(null); setRoleFilter("all"); setStatusFilter("all"); setSearch(""); setTeamOf(open.id); }}
                          style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", font: "inherit", fontWeight: 600, padding: 0 }}>
                          {s.team} {s.team === 1 ? "person" : "people"} →
                        </button>
                      ) : "none"
                    } />
                  )}
                  {accountKind(open) === "linked" && (
                    <Field label="Works for" value={
                      // A7: the table used to print a truncated raw UUID here.
                      byId[open.dealer_id] ? (
                        <button onClick={() => setOpenId(open.dealer_id)}
                          style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", font: "inherit", fontWeight: 600, padding: 0 }}>
                          {byId[open.dealer_id].dealership || byId[open.dealer_id].full_name || byId[open.dealer_id].email} →
                        </button>
                      ) : "a dealer no longer on the platform"
                    } />
                  )}
                </>
              );
            })()}

            <SectionTitle>Plan and billing</SectionTitle>
            <Field label="Plan" value={PLAN_CONFIG[open.plan]?.label || open.plan || "—"} />
            <Field label="Price" value={PLAN_CONFIG[open.plan] ? `RM ${PLAN_CONFIG[open.plan].price.toLocaleString()}/mo` : "—"} />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "5px 0", fontSize: 12.5, borderBottom: "1px solid rgba(255,255,255,0.03)", alignItems: "center" }}>
              <span style={{ color: "#6b7280" }}>Subscription</span>
              <select value={open.subscription_status || "trial"} className="adm-select"
                onChange={e => saveBillingField(open, "subscription_status", e.target.value, "subscription")}>
                <option value="trial">trial</option>
                <option value="active">active</option>
                <option value="expired">expired</option>
              </select>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "5px 0", fontSize: 12.5, borderBottom: "1px solid rgba(255,255,255,0.03)", alignItems: "center" }}>
              <span style={{ color: "#6b7280" }}>Trial ends</span>
              <input type="date" className="adm-input"
                value={open.trial_ends_at ? new Date(open.trial_ends_at).toISOString().slice(0, 10) : ""}
                onChange={e => saveBillingField(open, "trial_ends_at", e.target.value ? new Date(e.target.value).toISOString() : null, "trial end date")} />
            </div>
            {undo && undo.id === open.id && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10, background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)", borderRadius: 8, padding: "8px 11px" }}>
                <span style={{ fontSize: 12, color: "#93c5fd", flex: 1 }}>Changed the {undo.label}.</span>
                <button onClick={async () => {
                  const ok = await saveField(open, undo.field, undo.prev);
                  if (ok) setUndo(null);
                }} style={btn()}>Undo</button>
              </div>
            )}

            <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
              {[7, 14, 30].map(d => (
                <button key={d} disabled={busy === open.id} onClick={() => extendTrial(open, d)} style={btn()}>+{d} days</button>
              ))}
              {open.payment_status === "pending" && (
                <button disabled={busy === open.id} onClick={() => markPaid(open)} style={btn("good")}>Mark payment received</button>
              )}
            </div>

            <SectionTitle>Identity</SectionTitle>
            <Field label="Full name" value={open.full_name} />
            <Field label="Phone" value={open.phone || open.whatsapp_number} />
            <Field label="Location" value={[open.city, open.state].filter(Boolean).join(", ")} />
            <Field label="Business type" value={open.business_type} />
            <Field label="SSM" value={open.ssm_number} mono />
            <Field label="IC" value={open.ic_last4 ? `•••• ${open.ic_last4}` : null} mono />
            <Field label="IC on file" value={open.ic_verified_at ? fmtDate(open.ic_verified_at) : null} />
            <Field label="ID submitted" value={open.kyc_submitted_at ? fmtDate(open.kyc_submitted_at) : null} />
            <Field label="Verified on" value={open.verified_at ? fmtDate(open.verified_at) : null} />
            <Field label="Joined" value={fmtDate(open.created_at)} />
            <Field label="Account id" value={open.id} mono />

            <SectionTitle>Storefront</SectionTitle>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "5px 0", fontSize: 12.5, alignItems: "center" }}>
              <span style={{ color: "#6b7280" }}>{accountKind(open) === "dealer" ? "Subdomain" : "Public slug"}</span>
              <input className="adm-input" defaultValue={accountKind(open) === "dealer" ? (open.subdomain || "") : (open.slug || "")}
                onBlur={e => {
                  const field = accountKind(open) === "dealer" ? "subdomain" : "slug";
                  const next = e.target.value.trim() || null;
                  if (next !== (open[field] || null)) saveField(open, field, next);
                }}
                style={{ width: 190, textAlign: "right" }} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Suspend, with a reason the seller actually receives (A5) */}
      {suspendFor && createPortal(
        <div className="modal-overlay" onClick={() => setSuspendFor(null)} style={{ zIndex: 950 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Suspend this account?</p>
            <p style={{ fontSize: 12.5, color: "#9ca3af", marginBottom: 14 }}>
              {suspendFor.email} comes off the marketplace immediately. They see this reason when they sign in, and it is pushed to their phone.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {SUSPEND_REASONS.map(r => (
                <button key={r} onClick={() => setSuspendReason(r)}
                  style={{ textAlign: "left", padding: "7px 11px", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                    background: suspendReason === r ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${suspendReason === r ? "rgba(251,191,36,0.35)" : "rgba(255,255,255,0.08)"}`,
                    color: suspendReason === r ? "#fbbf24" : "#9ca3af" }}>
                  {r}
                </button>
              ))}
            </div>
            <textarea value={suspendReason} onChange={e => setSuspendReason(e.target.value)}
              placeholder="Or write your own reason…" rows={3} className="adm-input"
              style={{ width: "100%", resize: "vertical", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setSuspendFor(null)} style={btn()}>Cancel</button>
              <button disabled={!suspendReason.trim() || busy === suspendFor.id}
                onClick={() => setSuspended(suspendFor, true, suspendReason)}
                style={{ ...btn("bad"), opacity: suspendReason.trim() ? 1 : 0.45 }}>
                Suspend
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {confirmDelete && createPortal(
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)} style={{ zIndex: 950 }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Delete this account?</p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>
              <strong style={{ color: "#f5f5f5" }}>{confirmDelete.email}</strong> comes off the marketplace straight away and their public page stops loading.
            </p>
            <ul style={{ fontSize: 12, color: "#9ca3af", margin: "0 0 16px", paddingLeft: 18, lineHeight: 1.7 }}>
              <li>Nothing is destroyed today. Their cars, leads and sold deals stay in the database.</li>
              <li>You can restore them from this table for 30 days.</li>
              <li>After 30 days the account is purged for good, automatically.</li>
            </ul>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDelete(null)} style={btn()}>Cancel</button>
              <button disabled={busy === confirmDelete.id} onClick={() => softDelete(confirmDelete)} style={btn("bad")}>Delete account</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
