import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { useModalHistory } from '../../hooks/useModalHistory';
import ServicePackages from "./ServicePackages";
import { useServicePackages } from "../../hooks/useServicePackages";
import { MessageCircle, Search, X } from "lucide-react";
import { premiumLight as PL } from "../../theme/tokens";
import { StatusPills, INV_CARD, INV_INPUT, INV_GHOST_BTN, INV_MICRO } from "../inventory/InventoryUi";
import { supabase } from "../../supabaseClient";
import { usePersistentState } from "../../hooks/usePersistentState";

// IC numbers never go to disk; the edit form reads the live row.
const redactCustomers = (rows) => (rows || []).map(({ ic_number, ...rest }) => rest);

// Shared Customers tab — the SAME customers/post_sale_tasks/service_packages
// tables the dealer dashboard reads, so a salesman's edits (expiry dates, notes,
// service plans) are immediately visible to owner/manager and vice-versa.
// salesmanId (optional): scope to customers from leads this salesman closed.
// handover (optional): the page's useHandover() instance. The dealer dashboard's
// Sold tab passes the one it also gives the Handover board, so the progress
// figure is read once, not fetched again here. Without it (linked salesman
// panel) this tab still reads post_sale_tasks itself.
export default function CustomersTab({ dealerId, salesmanId = null, handover = null }) {
  const cacheKey = dealerId ? `customers:${salesmanId || 'all'}:${dealerId}` : null;
  const [customers, setCustomers, cached] = usePersistentState(cacheKey, [], { redact: redactCustomers });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  useModalHistory(!!editing, () => setEditing(null), { isDirty: () => true });
  const [saving, setSaving] = useState(false);
  const [handoverMap, setHandoverMap] = usePersistentState(cacheKey && `${cacheKey}:handover`, {}); // lead_id → progress %
  const [expandedPkg, setExpandedPkg] = useState(null); // customer_id being expanded
  const [expiryFilter, setExpiryFilter] = useState(null); // 'ins' | 'rt' — show only due/expired
  // Packages + visits live in useServicePackages, shared with the Salesman
  // Premium Customers tab. Both pages used to carry their own copy of
  // add-package / log-visit; a visit is a dated row now, so one owner only.
  const {
    packages: packagesMap, visits: pkgVisits, products: pkgProducts,
    addPackage, logVisit, undoVisit,
  } = useServicePackages(dealerId, customers.map((c) => c.id));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Salesman context: only customers from leads this salesman closed.
      let leadFilter = null;
      if (salesmanId) {
        const { data: myLeads } = await supabase
          .from("leads").select("id").eq("dealer_id", dealerId).eq("salesman_id", salesmanId);
        leadFilter = (myLeads || []).map(l => l.id);
        if (leadFilter.length === 0) { if (!cancelled) { setCustomers([]); setLoading(false); } return; }
      }
      let q = supabase.from("customers").select("*").eq("dealer_id", dealerId)
        .order("created_at", { ascending: false });
      if (leadFilter) q = q.in("lead_id", leadFilter);
      const { data } = await q;
      if (cancelled) return;
      const list = data || [];
      setCustomers(list);

      // Handover progress for all leads in one query (skipped when the page shares
      // its handover state: that already holds every won deal's steps).
      const leadIds = list.map(c => c.lead_id).filter(Boolean);
      if (!handover && leadIds.length > 0) {
        const { data: tasks } = await supabase
          .from("post_sale_tasks").select("lead_id, status").in("lead_id", leadIds);
        const map = {};
        for (const t of tasks || []) {
          if (!map[t.lead_id]) map[t.lead_id] = { total: 0, done: 0 };
          if (t.status !== 'na') {
            map[t.lead_id].total++;
            if (t.status === 'done') map[t.lead_id].done++;
          }
        }
        const pct = {};
        for (const [lid, v] of Object.entries(map))
          pct[lid] = v.total === 0 ? 0 : Math.round((v.done / v.total) * 100);
        if (!cancelled) setHandoverMap(pct);
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealerId, salesmanId, !!handover]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = new Date();
  const daysTo = (date) => (date ? (new Date(date) - today) / 86400000 : null);
  const fmtDate = (d) => new Date(d).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
  // One renewal line: the date, and only when it needs action, a red word.
  const renewal = (label, date) => {
    if (!date) return { text: `${label}: not set`, tone: "muted" };
    const diff = daysTo(date);
    if (diff < 0) return { text: `${label} expired ${fmtDate(date)}`, tone: "bad" };
    if (diff <= 30) return { text: `${label} due in ${Math.max(0, Math.round(diff))}d`, tone: "bad" };
    return { text: `${label} ${fmtDate(date)}`, tone: "ok" };
  };

  // The edit pop-up sits above the page (dashboard overlay rule: portal + scroll lock).
  useEffect(() => {
    if (!editing) return undefined;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [!!editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    // A cached row has no ic_number (redacted); saving one would blank the IC.
    if (!editing || !('ic_number' in editing)) return;
    setSaving(true);
    const { id } = editing;
    const { data, error } = await supabase.from("customers").update({
      notes: editing.notes,
      road_tax_expiry: editing.road_tax_expiry || null,
      insurance_expiry: editing.insurance_expiry || null,
      email: editing.email || null,
      ic_number: editing.ic_number || null,
    }).eq("id", id).select("id");
    setSaving(false);
    // RLS refuses as "0 rows, no error": both mean nothing was saved.
    if (error || !data?.length) { toast.error("Could not save this customer. Try again."); return; }
    setCustomers(p => p.map(c => c.id === id ? { ...c, ...editing } : c));
    setEditing(null);
    toast.success("Saved");
  };

  const isDue = (date) => { const d = daysTo(date); return d !== null && d <= 30; };

  const filtered = customers.filter(c => {
    if (search && !`${c.name || ""} ${c.phone || ""} ${c.car_plate || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (expiryFilter === "ins" && !isDue(c.insurance_expiry)) return false;
    if (expiryFilter === "rt" && !isDue(c.road_tax_expiry)) return false;
    return true;
  });

  const rtDue = customers.filter(c => isDue(c.road_tax_expiry)).length;
  const insDue = customers.filter(c => isDue(c.insurance_expiry)).length;

  if (loading && !cached) return <div style={{ padding: 32, fontSize: 14, color: PL.textMuted }}>Loading…</div>;

  // Renewals are the one thing this list is for between sales: one switch (it
  // used to be two tiles plus a pink banner). "Expired" is said in red on the row.
  const pills = [
    { key: "all", label: "All", count: customers.length },
    { key: "rt", label: "Road tax due", count: rtDue },
    { key: "ins", label: "Insurance due", count: insDue },
  ];
  const tone = (t) => (t === "bad" ? PL.accentText : t === "muted" ? PL.textMuted : PL.textSec);
  const btn = { ...INV_GHOST_BTN, padding: "7px 12px", fontSize: 12 };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <StatusPills items={pills} active={expiryFilter || "all"} onChange={k => setExpiryFilter(k === "all" ? null : k)} />
        </div>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 360 }}>
          <Search style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: PL.textMuted, pointerEvents: "none" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone or plate"
            style={{ ...INV_INPUT, paddingLeft: 32, background: PL.card, boxShadow: PL.shadow }} />
        </div>
      </div>

      <div style={{ ...INV_CARD, padding: 8 }}>
        {filtered.length === 0 && (
          <p style={{ padding: "36px 16px", textAlign: "center", fontSize: 14, color: PL.textMuted, margin: 0 }}>
            {customers.length === 0
              ? "No customers yet. A buyer lands here the moment their lead is marked Won."
              : expiryFilter ? "Nothing due in the next 30 days." : "No customer matches that search."}
          </p>
        )}
        {filtered.map((c, i) => {
          // -1 from useHandover = steps not loaded yet: show nothing rather than 0%.
          const shared = handover && c.lead_id ? handover.progressByLead[c.lead_id] : undefined;
          const progress = !c.lead_id ? null
            : handover ? (shared == null || shared < 0 ? null : shared)
            : (handoverMap[c.lead_id] ?? null);
          const pkgs = packagesMap[c.customer_id] || packagesMap[c.id] || [];
          const isExpanded = expandedPkg === c.id;
          const rt = renewal("Road tax", c.road_tax_expiry);
          const ins = renewal("Insurance", c.insurance_expiry);
          const car = [c.car_year, c.car_brand, c.car_model].filter(Boolean).join(" ") || "Car not recorded";
          return (
            <div key={c.id} style={{ borderTop: i ? `1px solid ${PL.line}` : "none" }}>
              <div className="cust-row" style={{ display: "grid", gap: "8px 16px", padding: "12px 10px", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: PL.text }}>{c.name || "Unnamed buyer"}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: PL.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {car}{c.car_plate ? ` · ${c.car_plate}` : ""}{c.purchase_date ? ` · bought ${fmtDate(c.purchase_date)}` : ""}
                  </p>
                </div>
                <div style={{ minWidth: 0, fontSize: 12, lineHeight: 1.6 }}>
                  <div style={{ color: tone(rt.tone), fontWeight: rt.tone === "bad" ? 700 : 500 }}>{rt.text}</div>
                  <div style={{ color: tone(ins.tone), fontWeight: ins.tone === "bad" ? 700 : 500 }}>{ins.text}</div>
                </div>
                <div style={{ fontSize: 12, color: progress === 100 ? PL.up : PL.textSec, fontWeight: 600, whiteSpace: "nowrap" }}>
                  {progress === null ? "" : progress === 100 ? "Handover done" : `Handover ${progress}%`}
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  {c.phone && (
                    <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      aria-label={`WhatsApp ${c.name || "buyer"}`} style={{ ...btn, textDecoration: "none" }}>
                      <MessageCircle style={{ width: 14, height: 14 }} />
                    </a>
                  )}
                  <button onClick={() => setExpandedPkg(isExpanded ? null : c.id)} style={{ ...btn, background: isExpanded ? PL.hover : PL.raised }}>
                    Aftercare{pkgs.length ? ` (${pkgs.length})` : ""}
                  </button>
                  <button disabled={loading} title={loading ? "Loading latest details" : undefined} onClick={() => setEditing({ ...c })}
                    style={{ ...btn, opacity: loading ? 0.5 : 1 }}>Edit</button>
                </div>
              </div>
              {isExpanded && (
                <div style={{ margin: "0 10px 12px", padding: "12px 14px", background: PL.raised, borderRadius: PL.radius.row }}>
                  <p style={{ ...INV_MICRO, marginBottom: 6 }}>Aftercare plans</p>
                  {/* Same component the Salesman Premium Customers tab renders */}
                  <ServicePackages
                    customer={c} packages={pkgs} visits={pkgVisits} products={pkgProducts}
                    onAdd={addPackage} onLogVisit={logVisit} onUndoVisit={undoVisit} theme="light"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <style>{`
        .cust-row { grid-template-columns: 1fr; }
        @media (min-width: 900px) { .cust-row { grid-template-columns: minmax(0,1.4fr) minmax(0,1.1fr) 120px auto; } }
      `}</style>

      {editing && createPortal(
        <div onClick={() => setEditing(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(17,24,39,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...INV_CARD, width: "100%", maxWidth: 440, padding: 22, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: PL.text }}>{editing.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: PL.textMuted }}>{[editing.car_brand, editing.car_model, editing.car_plate].filter(Boolean).join(" · ")}</p>
              </div>
              <button onClick={() => setEditing(null)} aria-label="Close" style={{ ...btn, padding: 8 }}><X style={{ width: 16, height: 16 }} /></button>
            </div>
            <div style={{ display: "grid", gap: 12, marginBottom: 18 }}>
              {[
                { label: "Road tax expiry", key: "road_tax_expiry", type: "date" },
                { label: "Insurance expiry", key: "insurance_expiry", type: "date" },
                { label: "Email", key: "email", type: "email" },
                { label: "IC number", key: "ic_number", type: "text" },
              ].map(({ label, key, type }) => (
                <label key={key} style={{ display: "block" }}>
                  <span style={{ ...INV_MICRO, display: "block", marginBottom: 5 }}>{label}</span>
                  <input type={type} value={editing[key] || ""} onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))} style={INV_INPUT} />
                </label>
              ))}
              <label style={{ display: "block" }}>
                <span style={{ ...INV_MICRO, display: "block", marginBottom: 5 }}>Notes</span>
                <textarea rows={3} value={editing.notes || ""} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))} style={{ ...INV_INPUT, resize: "none" }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditing(null)} style={{ ...INV_GHOST_BTN, flex: 1, justifyContent: "center" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...INV_GHOST_BTN, flex: 1, justifyContent: "center", background: PL.accent, color: PL.onAccent, opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
