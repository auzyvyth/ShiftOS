import React, { useState, useEffect } from "react";
import { AlertTriangle, Phone, Search, X } from "lucide-react";
import { supabase } from "../../supabaseClient";

// Shared Customers tab — the SAME customers/post_sale_tasks/service_packages
// tables the dealer dashboard reads, so a salesman's edits (expiry dates, notes,
// service plans) are immediately visible to owner/manager and vice-versa.
// salesmanId (optional): scope to customers from leads this salesman closed.
export default function CustomersTab({ dealerId, salesmanId = null }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [handoverMap, setHandoverMap] = useState({});   // lead_id → progress %
  const [packagesMap, setPackagesMap] = useState({});   // customer_id → [packages]
  const [expandedPkg, setExpandedPkg] = useState(null); // customer_id being expanded
  const [expiryFilter, setExpiryFilter] = useState(null); // 'ins' | 'rt' — show only due/expired
  const [addPkg, setAddPkg] = useState(null);           // customer_id for add form
  const [pkgForm, setPkgForm] = useState({ package_name: '', total_visits: 3, valid_months: 12, sold_price: '' });
  const [pkgSaving, setPkgSaving] = useState(false);

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

      // Handover progress for all leads in one query
      const leadIds = list.map(c => c.lead_id).filter(Boolean);
      if (leadIds.length > 0) {
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

      // Service packages for all customers
      const custIds = list.map(c => c.id);
      if (custIds.length > 0) {
        const { data: pkgs } = await supabase
          .from("service_packages").select("*").in("customer_id", custIds)
          .order("created_at", { ascending: false });
        const pm = {};
        for (const p of pkgs || []) {
          if (!pm[p.customer_id]) pm[p.customer_id] = [];
          pm[p.customer_id].push(p);
        }
        if (!cancelled) setPackagesMap(pm);
      }

      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dealerId, salesmanId]);

  const handleAddPackage = async (customer) => {
    if (!pkgForm.package_name) return;
    setPkgSaving(true);
    const row = {
      dealer_id: dealerId,
      customer_id: customer.id,
      lead_id: customer.lead_id || null,
      listing_id: customer.listing_id || null,
      package_name: pkgForm.package_name,
      total_visits: Number(pkgForm.total_visits) || 3,
      valid_months: Number(pkgForm.valid_months) || 12,
      sold_price: pkgForm.sold_price ? Number(pkgForm.sold_price) : null,
      sold_at: new Date().toISOString().slice(0, 10),
    };
    const { data } = await supabase.from("service_packages").insert(row).select().single();
    if (data) {
      setPackagesMap(p => ({ ...p, [customer.id]: [data, ...(p[customer.id] || [])] }));
      setExpandedPkg(customer.id);
    }
    setAddPkg(null);
    setPkgForm({ package_name: '', total_visits: 3, valid_months: 12, sold_price: '' });
    setPkgSaving(false);
  };

  const handleLogVisit = async (pkg) => {
    if (pkg.used_visits >= pkg.total_visits) return;
    const updated = { used_visits: pkg.used_visits + 1, updated_at: new Date().toISOString() };
    await supabase.from("service_packages").update(updated).eq("id", pkg.id);
    setPackagesMap(p => {
      const list = (p[pkg.customer_id] || []).map(pk => pk.id === pkg.id ? { ...pk, ...updated } : pk);
      return { ...p, [pkg.customer_id]: list };
    });
  };

  const today = new Date();
  const expiryColor = (diff) => diff === null ? "#6b7280" : diff < 0 ? "#f87171" : diff <= 30 ? "#fbbf24" : "#4ade80";
  const expiryLabel = (expiry, diff) => {
    if (!expiry) return "—";
    const d = new Date(expiry).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
    if (diff < 0) return `${d} (Expired)`;
    if (diff <= 30) return `${d} (${Math.round(diff)}d)`;
    return d;
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const { id } = editing;
    await supabase.from("customers").update({
      notes: editing.notes,
      road_tax_expiry: editing.road_tax_expiry || null,
      insurance_expiry: editing.insurance_expiry || null,
      email: editing.email || null,
      ic_number: editing.ic_number || null,
    }).eq("id", id);
    setCustomers(p => p.map(c => c.id === id ? { ...c, ...editing } : c));
    setEditing(null);
    setSaving(false);
  };

  const isDue = (date) => { if (!date) return false; const diff = (new Date(date) - today) / 86400000; return diff <= 30; };
  const isExpired = (date) => { if (!date) return false; return (new Date(date) - today) / 86400000 < 0; };

  const filtered = customers.filter(c => {
    if (search && !`${c.name || ""} ${c.phone || ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (expiryFilter === "ins" && !isDue(c.insurance_expiry)) return false;
    if (expiryFilter === "rt" && !isDue(c.road_tax_expiry)) return false;
    return true;
  });

  const thisMonthCount = customers.filter(c => {
    const d = new Date(c.created_at);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).length;
  const rtDue = customers.filter(c => isDue(c.road_tax_expiry)).length;
  const insDue = customers.filter(c => isDue(c.insurance_expiry)).length;
  const rtExpired = customers.filter(c => isExpired(c.road_tax_expiry)).length;
  const insExpired = customers.filter(c => isExpired(c.insurance_expiry)).length;

  if (loading) return <div className="p-8 text-gray-600 text-sm">Loading…</div>;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {[
          { label: "Total Customers", val: customers.length, color: "#dc2626", filter: null, sub: null },
          { label: "This Month", val: thisMonthCount, color: "#4ade80", filter: null, sub: null },
          { label: "Road Tax Due", val: rtDue, color: "#fbbf24", filter: "rt", sub: rtExpired > 0 ? `${rtExpired} expired` : null },
          { label: "Insurance Due", val: insDue, color: "#c084fc", filter: "ins", sub: insExpired > 0 ? `${insExpired} expired` : null },
        ].map(({ label, val, color, filter, sub }) => {
          const active = filter && expiryFilter === filter;
          return (
            <button key={label} type="button" onClick={() => filter && setExpiryFilter(active ? null : filter)}
              className="bg-white border rounded-xl p-4 text-left transition-colors"
              style={{ borderColor: active ? color : "#e5e7eb", cursor: filter ? "pointer" : "default", boxShadow: active ? `0 0 0 1px ${color}` : "none" }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">{label}</p>
              <p style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 32, color, lineHeight: 1, margin: 0 }}>{val}</p>
              {sub
                ? <p className="text-[10px] font-bold mt-1 m-0" style={{ color: "#dc2626" }}>{sub}</p>
                : filter ? <p className="text-[10px] text-gray-400 mt-1 m-0">{active ? "Showing — clear" : "Click to filter"}</p> : null}
            </button>
          );
        })}
      </div>

      {(insExpired > 0 || rtExpired > 0) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg mb-4" style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.18)" }}>
          <AlertTriangle style={{ width: 15, height: 15, color: "#dc2626", flexShrink: 0 }} />
          <span className="text-[13px] flex-1" style={{ color: "#374151", lineHeight: 1.5 }}>
            {[insExpired > 0 ? `${insExpired} insurance` : null, rtExpired > 0 ? `${rtExpired} road tax` : null].filter(Boolean).join(" and ")} {insExpired + rtExpired > 1 ? "policies have" : "policy has"} expired — renew to keep customers covered.
          </span>
          <button type="button" onClick={() => setExpiryFilter(insExpired > 0 ? "ins" : "rt")} className="text-xs font-bold whitespace-nowrap" style={{ color: "#dc2626" }}>Review →</button>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone…"
          className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-red-400" />
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full border-collapse" style={{ fontFamily: "'DM Sans',sans-serif" }}>
          <thead>
            <tr className="border-b border-gray-100">
              {["Customer", "Phone", "Car Bought", "Purchase Date", "Road Tax", "Insurance", "Handover", ""].map(h => (
                <th key={h} className="px-4 py-2.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold text-left whitespace-nowrap bg-gray-50">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const rtDiff  = c.road_tax_expiry  ? (new Date(c.road_tax_expiry)  - today) / 86400000 : null;
              const insDiff = c.insurance_expiry ? (new Date(c.insurance_expiry) - today) / 86400000 : null;
              const progress = c.lead_id ? (handoverMap[c.lead_id] ?? null) : null;
              const pkgs = packagesMap[c.customer_id] || packagesMap[c.id] || [];
              const isExpanded = expandedPkg === c.id;
              return (
                <React.Fragment key={c.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-semibold text-gray-900 m-0">{c.name || "—"}</p>
                      {pkgs.length > 0 && (
                        <button onClick={() => setExpandedPkg(isExpanded ? null : c.id)} className="text-[10px] text-violet-600 hover:underline mt-0.5 block">
                          {pkgs.length} service plan{pkgs.length > 1 ? 's' : ''}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-gray-500">
                      {c.phone ? (
                        <a href={`https://wa.me/${c.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:text-green-700 flex items-center gap-1 no-underline">
                          <Phone className="w-3 h-3" />{c.phone}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="text-sm text-gray-700 m-0">{[c.car_brand, c.car_model].filter(Boolean).join(" ") || "—"}</p>
                      {c.car_plate && <p className="text-[11px] text-gray-500 mt-0.5 m-0">{c.car_plate}{c.car_year ? ` · ${c.car_year}` : ""}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {c.purchase_date ? new Date(c.purchase_date).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap font-medium" style={{ color: expiryColor(rtDiff) }}>
                      {expiryLabel(c.road_tax_expiry, rtDiff)}
                    </td>
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap font-medium" style={{ color: expiryColor(insDiff) }}>
                      {expiryLabel(c.insurance_expiry, insDiff)}
                    </td>
                    <td className="px-4 py-2.5">
                      {progress === null ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <div style={{ minWidth: 64 }}>
                          <div style={{ height: 5, borderRadius: 3, background: '#f3f4f6', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 3, background: progress === 100 ? '#34d399' : '#6366f1' }} />
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5 m-0">{progress}%</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setEditing({ ...c })} className="text-xs px-3 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300 transition-colors whitespace-nowrap">Edit</button>
                        <button onClick={() => { setAddPkg(c.id); setPkgForm({ package_name: '', total_visits: 3, valid_months: 12, sold_price: '' }); }} className="text-xs px-3 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 hover:bg-violet-100 transition-colors whitespace-nowrap">+ Service Plan</button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && pkgs.length > 0 && (
                    <tr className="border-b border-gray-100 bg-violet-50/40">
                      <td colSpan={8} className="px-6 py-3">
                        <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-2">Service Packages</p>
                        <div className="flex flex-wrap gap-3">
                          {pkgs.map(pkg => {
                            const expired = pkg.expires_at && new Date(pkg.expires_at) < today;
                            return (
                              <div key={pkg.id} className="bg-white border border-violet-200 rounded-xl p-3" style={{ minWidth: 180 }}>
                                <p className="text-sm font-semibold text-gray-900 m-0">{pkg.package_name}</p>
                                <p className="text-[11px] text-gray-500 mt-1 m-0">{pkg.used_visits}/{pkg.total_visits} visits used</p>
                                <div style={{ height: 4, borderRadius: 2, background: '#ede9fe', margin: '6px 0' }}>
                                  <div style={{ height: '100%', width: `${(pkg.used_visits / pkg.total_visits) * 100}%`, borderRadius: 2, background: '#7c3aed' }} />
                                </div>
                                {pkg.expires_at && (
                                  <p className="text-[10px] m-0" style={{ color: expired ? '#f87171' : '#9ca3af' }}>
                                    {expired ? 'Expired' : 'Expires'} {new Date(pkg.expires_at).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
                                  </p>
                                )}
                                {pkg.used_visits < pkg.total_visits && !expired && (
                                  <button onClick={() => handleLogVisit(pkg)} className="mt-2 text-[10px] px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200 transition-colors">Log visit</button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  {addPkg === c.id && (
                    <tr className="border-b border-gray-100 bg-violet-50/60">
                      <td colSpan={8} className="px-6 py-3">
                        <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-2">New Service Package</p>
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Package Name</label>
                            <input value={pkgForm.package_name} onChange={e => setPkgForm(p => ({ ...p, package_name: e.target.value }))} placeholder="e.g. Annual Service Plan" className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-violet-400" style={{ width: 200 }} />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Visits</label>
                            <input type="number" value={pkgForm.total_visits} onChange={e => setPkgForm(p => ({ ...p, total_visits: e.target.value }))} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-violet-400" style={{ width: 70 }} />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Valid (months)</label>
                            <input type="number" value={pkgForm.valid_months} onChange={e => setPkgForm(p => ({ ...p, valid_months: e.target.value }))} className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-violet-400" style={{ width: 70 }} />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 uppercase tracking-widest mb-1">Price (RM)</label>
                            <input type="number" value={pkgForm.sold_price} onChange={e => setPkgForm(p => ({ ...p, sold_price: e.target.value }))} placeholder="0" className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-violet-400" style={{ width: 90 }} />
                          </div>
                          <button onClick={() => handleAddPackage(c)} disabled={pkgSaving || !pkgForm.package_name} className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold disabled:opacity-50">Save</button>
                          <button onClick={() => setAddPkg(null)} className="px-4 py-1.5 rounded-lg bg-gray-100 text-gray-600 text-xs">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-600 text-sm">
                {customers.length === 0
                  ? "No customers yet. Customers are created automatically when a lead is marked as Won."
                  : "No results for your search."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-base font-semibold text-gray-900 m-0">{editing.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{[editing.car_brand, editing.car_model, editing.car_plate].filter(Boolean).join(" · ")}</p>
              </div>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 mb-4">
              {[
                { label: "Road Tax Expiry", key: "road_tax_expiry", type: "date" },
                { label: "Insurance Expiry", key: "insurance_expiry", type: "date" },
                { label: "Email", key: "email", type: "email" },
                { label: "IC Number", key: "ic_number", type: "text" },
              ].map(({ label, key, type }) => (
                <div key={key}>
                  <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">{label}</label>
                  <input type={type} value={editing[key] || ""} onChange={e => setEditing(p => ({ ...p, [key]: e.target.value }))}
                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-400" />
                </div>
              ))}
              <div>
                <label className="block text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Notes</label>
                <textarea rows={3} value={editing.notes || ""} onChange={e => setEditing(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 outline-none focus:border-red-400 resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditing(null)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-500 text-sm hover:text-gray-900 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
