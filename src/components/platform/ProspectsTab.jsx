import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { platformClient as supabase } from "../../lib/platformClient";

// OPS-CRM-1: the owner's own prospecting list -- salesmen and dealers being
// signed up, where each conversation stands, and who to follow up today.
//
// The database does the parts that must not be skippable (migration
// 20260926c): phone normalized + unique, waitlist rows arrive on their own, a
// real signup with a matching phone links the prospect and moves it to
// 'signed_up', and logging a contact on a do-not-contact prospect is refused.
// This file only reads and writes rows; it re-implements none of that.
//
// Messaging is a wa.me link sent by a human from their own phone. Never a
// blast and never the Cloud API: Meta requires prior opt-in, and PDPA s.43
// means a "stop" is final -- the Message button disappears for that person.

const STAGES = [
  { id: "new", label: "New", color: "#9ca3af" },
  { id: "contacted", label: "Contacted", color: "#93c5fd" },
  { id: "replied", label: "Replied", color: "#c4b5fd" },
  { id: "demo", label: "Demo", color: "#fcd34d" },
  { id: "signed_up", label: "Signed up", color: "#86efac" },
  { id: "paying", label: "Paying", color: "#4ade80" },
  { id: "lost", label: "Lost", color: "#6b7280" },
];
const STAGE = Object.fromEntries(STAGES.map(s => [s.id, s]));
const CLOSED = new Set(["paying", "lost"]);

const KINDS = [
  { id: "salesman", label: "Salesman" },
  { id: "dealer", label: "Dealer" },
  { id: "other", label: "Other" },
];
const SOURCES = [
  { id: "referral", label: "Referral" },
  { id: "social", label: "Social media" },
  { id: "marketplace", label: "Seen on a marketplace" },
  { id: "event", label: "Event" },
  { id: "walk_in", label: "Walk-in / met in person" },
  { id: "waitlist", label: "Waitlist" },
  { id: "other", label: "Other" },
];
const SOURCE_LABEL = Object.fromEntries(SOURCES.map(s => [s.id, s.label]));

// No price, plan or promise in either opener: the owner edits it before
// sending, and the last line is the opt-out the law expects us to honour.
const DEFAULT_OPENERS = {
  salesman: "Hi {name}, this is XDrive. We built a tool for car salesmen: your listings, buyer leads and follow-ups in one place on your phone. Can I send you a quick look?\n\nIf you'd rather not hear from us, just reply STOP and we won't message again.",
  dealer: "Hi {name}, this is XDrive. We built a dashboard for used-car dealers: stock, your sales team, leads and the handover paperwork in one place. Could I show you in 10 minutes this week?\n\nIf you'd rather not hear from us, just reply STOP and we won't message again.",
};
const OPENER_KEY = "xd_prospect_opener_";

function readOpener(kind) {
  const k = kind === "dealer" ? "dealer" : "salesman";
  try { return localStorage.getItem(OPENER_KEY + k) || DEFAULT_OPENERS[k]; } catch { return DEFAULT_OPENERS[k]; }
}
function saveOpener(kind, text) {
  const k = kind === "dealer" ? "dealer" : "salesman";
  try { localStorage.setItem(OPENER_KEY + k, text); } catch { /* per-viewer convenience only */ }
}

function errText(e) {
  const m = e?.message || "";
  if (m.includes("prospect_do_not_contact")) return "This person asked not to be contacted.";
  if (m.includes("prospect_bad_phone")) return "That phone number is too short.";
  if (e?.code === "23505") return "Someone with that phone number is already on the list.";
  return m || "Something went wrong.";
}

function endOfToday() {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d;
}
function isDue(p) {
  return !p.do_not_contact && !CLOSED.has(p.stage) && p.next_follow_up_at && new Date(p.next_follow_up_at) <= endOfToday();
}
function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n); d.setHours(9, 0, 0, 0); return d.toISOString();
}
function fmtDay(str) {
  if (!str) return "—";
  const d = new Date(str);
  const diff = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff < 0) return `${-diff}d overdue`;
  if (diff < 7) return `In ${diff}d`;
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}
function since(str) {
  if (!str) return "never";
  const d = Math.floor((Date.now() - new Date(str)) / 86400000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  return new Date(str).toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}
const firstName = (n) => (n || "").trim().split(/\s+/)[0] || "";

const btn = (tone = "neutral") => {
  const tones = {
    neutral: ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.1)", "#9ca3af"],
    primary: ["#dc2626", "#dc2626", "#fff"],
    good: ["rgba(74,222,128,0.1)", "rgba(74,222,128,0.3)", "#4ade80"],
    bad: ["rgba(220,38,38,0.1)", "rgba(220,38,38,0.32)", "#f87171"],
  };
  const [background, borderColor, color] = tones[tone] || tones.neutral;
  return { background, color, border: `1px solid ${borderColor}`, borderRadius: 7, padding: "7px 13px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
};

function SectionTitle({ children }) {
  return <p style={{ margin: "22px 0 8px", fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>{children}</p>;
}
function Label({ children }) {
  return <span style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{children}</span>;
}

const EMPTY = { name: "", phone: "", business: "", kind: "salesman", area: "", source: "referral", notes: "" };

export default function ProspectsTab({ onOpenAccount }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [kind, setKind] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error: e } = await supabase.from("platform_prospects").select("*").order("created_at", { ascending: false }).limit(2000);
    if (e) setError(errText(e)); else setRows(data || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Overlay rule 2.
  useEffect(() => {
    if (!openId && !adding) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [openId, adding]);

  const counts = useMemo(() => {
    const c = { all: rows.length, due: rows.filter(isDue).length };
    STAGES.forEach(s => { c[s.id] = rows.filter(r => r.stage === s.id).length; });
    return c;
  }, [rows]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    return rows
      .filter(r => filter === "all" ? true : filter === "due" ? isDue(r) : r.stage === filter)
      .filter(r => kind === "all" || r.kind === kind)
      .filter(r => !q || [r.name, r.business, r.area, r.notes].some(v => v?.toLowerCase().includes(q)) || (qDigits.length >= 3 && r.phone?.includes(qDigits)))
      // Due and overdue first, then upcoming, then those with no date.
      .sort((a, b) => {
        const fa = a.next_follow_up_at && !CLOSED.has(a.stage) && !a.do_not_contact ? new Date(a.next_follow_up_at).getTime() : Infinity;
        const fb = b.next_follow_up_at && !CLOSED.has(b.stage) && !b.do_not_contact ? new Date(b.next_follow_up_at).getTime() : Infinity;
        if (fa !== fb) return fa - fb;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [rows, filter, kind, search]);

  function replaceRow(row) {
    setRows(rs => rs.map(r => r.id === row.id ? row : r));
  }

  async function addProspect() {
    if (!form.name.trim()) return;
    setBusy(true);
    const payload = { ...form, name: form.name.trim(), phone: form.phone.trim() || null };
    const { data, error: e } = await supabase.from("platform_prospects").insert(payload).select().single();
    setBusy(false);
    if (e) {
      setError(errText(e));
      // Duplicate: open the person who is already there instead of a dead end.
      if (e.code === "23505") {
        const digits = form.phone.replace(/\D/g, "");
        const hit = rows.find(r => r.phone && digits && r.phone.endsWith(digits.replace(/^0/, "")));
        if (hit) { setAdding(false); setOpenId(hit.id); }
      }
      return;
    }
    setRows(rs => [data, ...rs]);
    setForm(EMPTY);
    setAdding(false);
    setOpenId(data.id);
  }

  const open = rows.find(r => r.id === openId) || null;
  const filters = [{ id: "all", label: "All" }, { id: "due", label: "Follow up today" }, ...STAGES];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Prospects</p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Salesmen and dealers you are signing up. Waitlist signups land here on their own.</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} style={btn()}>Refresh</button>
          <button onClick={() => { setForm(EMPTY); setAdding(true); }} style={btn("primary")}>Add prospect</button>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 14, background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 10, padding: "10px 12px" }}>
          <span style={{ fontSize: 12, color: "#f87171", flex: 1, minWidth: 0 }}>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss" style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4, marginBottom: 12 }}>
        {filters.map(f => {
          const on = filter === f.id;
          return (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 13px", borderRadius: 99, fontSize: 12.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
                background: on ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${on ? "rgba(220,38,38,0.35)" : "rgba(255,255,255,0.08)"}`,
                color: on ? "#f87171" : "#9ca3af" }}>
              {f.label}
              <span style={{ fontSize: 11, fontWeight: 700, color: on ? "#f87171" : "#4b5563" }}>{counts[f.id] ?? 0}</span>
            </button>
          );
        })}
      </div>

      <div className="adm-toolbar" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, business, area, phone…"
          className="adm-input adm-search" style={{ flex: "1 1 220px", minWidth: 0, maxWidth: 320 }} />
        <select value={kind} onChange={e => setKind(e.target.value)} className="adm-select">
          <option value="all">Salesmen and dealers</option>
          {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}s</option>)}
        </select>
        <span style={{ fontSize: 12, color: "#4b5563", marginLeft: "auto" }}>{shown.length} shown</span>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.025)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Prospect", "Stage", "Follow up", "Last contact", "Source", ""].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "10px 14px", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em", color: "#6b7280", fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>Loading…</td></tr>
              ) : shown.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "#4b5563" }}>
                  {rows.length === 0 ? "No prospects yet. Add the first person you plan to message." : "Nobody matches those filters."}
                </td></tr>
              ) : shown.map(p => {
                const due = isDue(p);
                return (
                  <tr key={p.id} className="adm-row" onClick={() => setOpenId(p.id)}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer", opacity: p.do_not_contact || p.stage === "lost" ? 0.5 : 1 }}>
                    <td style={{ padding: "10px 14px", minWidth: 170 }}>
                      <div style={{ fontWeight: 600, color: "#f0f0f0" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        {[KINDS.find(k => k.id === p.kind)?.label, p.business, p.area].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>
                      {p.do_not_contact
                        ? <span style={{ fontSize: 11, fontWeight: 600, color: "#f87171" }}>Do not contact</span>
                        : <span style={{ fontSize: 11, fontWeight: 600, color: STAGE[p.stage]?.color }}>{STAGE[p.stage]?.label}</span>}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: due ? "#fbbf24" : "#9ca3af", fontWeight: due ? 600 : 400 }}>
                      {CLOSED.has(p.stage) || p.do_not_contact ? "—" : fmtDay(p.next_follow_up_at)}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#9ca3af" }}>
                      {since(p.last_contacted_at)}{p.contact_count > 1 ? <span style={{ color: "#4b5563" }}> · {p.contact_count}x</span> : null}
                    </td>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap", color: "#6b7280" }}>{SOURCE_LABEL[p.source] || p.source}</td>
                    <td style={{ padding: "10px 14px", color: "#475569" }}>›</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {adding && createPortal(
        <div onClick={() => setAdding(false)}
          style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }}>
          <div onClick={e => e.stopPropagation()}
            style={{ width: "min(480px, 100%)", height: "100%", overflowY: "auto", background: "#0b0f16", borderLeft: "1px solid rgba(255,255,255,0.08)", padding: "22px 22px 60px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f1f5f9", flex: 1 }}>Add prospect</p>
              <button onClick={() => setAdding(false)} aria-label="Close" style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <ProspectFields value={form} onChange={setForm} />
            <p style={{ fontSize: 11, color: "#6b7280", margin: "14px 0 0", lineHeight: 1.5 }}>
              Only add people you have a reason to contact one-to-one. Do not paste in a scraped list.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => setAdding(false)} style={btn()}>Cancel</button>
              <button disabled={busy || !form.name.trim()} onClick={addProspect} style={{ ...btn("primary"), opacity: busy || !form.name.trim() ? 0.5 : 1 }}>
                {busy ? "Saving…" : "Add"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {open && createPortal(
        <ProspectRecord key={open.id} p={open} onClose={() => setOpenId(null)} onChange={replaceRow}
          onDeleted={() => { setRows(rs => rs.filter(r => r.id !== open.id)); setOpenId(null); }}
          onOpenAccount={onOpenAccount} setError={setError} />,
        document.body
      )}
    </div>
  );
}

function ProspectFields({ value, onChange }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
      <label><Label>Name *</Label><input className="adm-input" style={{ width: "100%" }} value={value.name} onChange={set("name")} /></label>
      <label><Label>WhatsApp number</Label><input className="adm-input" style={{ width: "100%" }} inputMode="tel" placeholder="012-345 6789" value={value.phone || ""} onChange={set("phone")} /></label>
      <label><Label>Business / dealership</Label><input className="adm-input" style={{ width: "100%" }} value={value.business || ""} onChange={set("business")} /></label>
      <label><Label>Area</Label><input className="adm-input" style={{ width: "100%" }} placeholder="e.g. Shah Alam" value={value.area || ""} onChange={set("area")} /></label>
      <label><Label>Type</Label>
        <select className="adm-select" style={{ width: "100%" }} value={value.kind} onChange={set("kind")}>
          {KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </label>
      <label><Label>Where you found them</Label>
        <select className="adm-select" style={{ width: "100%" }} value={value.source} onChange={set("source")}>
          {SOURCES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label style={{ gridColumn: "1 / -1" }}><Label>Notes</Label>
        <textarea className="adm-input" rows={3} style={{ width: "100%", resize: "vertical" }} value={value.notes || ""} onChange={set("notes")} />
      </label>
    </div>
  );
}

function ProspectRecord({ p, onClose, onChange, onDeleted, onOpenAccount, setError }) {
  const [draft, setDraft] = useState({ name: p.name, phone: p.phone ? "0" + p.phone.slice(2) : "", business: p.business, kind: p.kind, area: p.area, source: p.source, notes: p.notes });
  const [activity, setActivity] = useState([]);
  const [note, setNote] = useState("");
  const [composer, setComposer] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function loadActivity() {
    const { data } = await supabase.from("platform_prospect_activity").select("*").eq("prospect_id", p.id).order("created_at", { ascending: false }).limit(100);
    setActivity(data || []);
  }
  useEffect(() => { loadActivity(); }, [p.id]);

  // Every write reads the row back: the triggers change stage, phone and link.
  async function patch(fields) {
    setBusy(true);
    const { data, error } = await supabase.from("platform_prospects").update(fields).eq("id", p.id).select().single();
    setBusy(false);
    if (error) { setError(errText(error)); return null; }
    onChange(data);
    loadActivity();
    return data;
  }
  async function refetch() {
    const { data } = await supabase.from("platform_prospects").select("*").eq("id", p.id).single();
    if (data) onChange(data);
  }

  async function logActivity(kind, body) {
    const { error } = await supabase.from("platform_prospect_activity").insert({ prospect_id: p.id, kind, body });
    if (error) { setError(errText(error)); return false; }
    // No follow-up date yet: default one, so nobody contacted once is forgotten.
    if (kind === "contacted" && !p.next_follow_up_at && !CLOSED.has(p.stage)) {
      await patch({ next_follow_up_at: daysFromNow(3) });
    } else {
      await refetch();
      loadActivity();
    }
    return true;
  }

  function openComposer() {
    setComposer(readOpener(p.kind).replaceAll("{name}", firstName(p.name)));
  }
  // wa.me opens synchronously inside the click so no popup blocker gets in the way.
  function sendWhatsApp() {
    const text = composer || "";
    window.open(`https://wa.me/${p.phone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    const first = firstName(p.name);
    saveOpener(p.kind, first ? text.split(first).join("{name}") : text);
    setComposer(null);
    logActivity("contacted", "WhatsApp: " + text.slice(0, 160));
  }

  async function addNote() {
    if (!note.trim()) return;
    const ok = await logActivity("note", note.trim());
    if (ok) setNote("");
  }

  async function remove() {
    setBusy(true);
    const { error } = await supabase.from("platform_prospects").delete().eq("id", p.id);
    setBusy(false);
    if (error) { setError(errText(error)); return; }
    onDeleted();
  }

  const closed = CLOSED.has(p.stage);
  const canContact = p.phone && !p.do_not_contact;
  const dirty = ["name", "business", "kind", "area", "source", "notes"].some(k => (draft[k] || "") !== (p[k] || ""))
    || (draft.phone || "").replace(/\D/g, "") !== (p.phone ? "0" + p.phone.slice(2) : "");

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", display: "flex", justifyContent: "flex-end" }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: "min(520px, 100%)", height: "100%", overflowY: "auto", background: "#0b0f16", borderLeft: "1px solid rgba(255,255,255,0.08)", padding: "22px 22px 60px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#f1f5f9", wordBreak: "break-word" }}>{p.name}</p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
              {[p.phone ? "+" + p.phone : "No number", p.business].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {p.do_not_contact && (
          <p style={{ margin: "14px 0 0", fontSize: 12, color: "#fca5a5", background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.25)", borderRadius: 8, padding: "9px 11px" }}>
            Asked not to be contacted {since(p.dnc_at)}. Messaging is switched off for this person.
          </p>
        )}
        {p.converted_profile_id && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, background: "rgba(74,222,128,0.07)", border: "1px solid rgba(74,222,128,0.22)", borderRadius: 8, padding: "9px 11px" }}>
            <span style={{ fontSize: 12, color: "#86efac", flex: 1 }}>Has an account on the platform.</span>
            {onOpenAccount && <button onClick={() => { onClose(); onOpenAccount(p.converted_profile_id); }} style={btn("good")}>Open account</button>}
          </div>
        )}

        <SectionTitle>Reach out</SectionTitle>
        {composer !== null ? (
          <div>
            <textarea className="adm-input" rows={6} style={{ width: "100%", resize: "vertical" }} value={composer} onChange={e => setComposer(e.target.value)} />
            <p style={{ fontSize: 11, color: "#6b7280", margin: "6px 0 10px" }}>Opens WhatsApp with this text. You press send. Your edits are remembered as the opener for next time.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setComposer(null)} style={btn()}>Cancel</button>
              <button disabled={!composer.trim()} onClick={sendWhatsApp} style={btn("primary")}>Open WhatsApp</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canContact && <button onClick={openComposer} style={btn("primary")}>Message on WhatsApp</button>}
            {canContact && (
              <a href={`tel:+${p.phone}`} onClick={() => logActivity("contacted", "Phone call")} style={{ ...btn(), textDecoration: "none" }}>Call</a>
            )}
            {canContact && <button onClick={() => logActivity("contacted", "Contacted another way")} style={btn()}>Log contact</button>}
            {!p.phone && <span style={{ fontSize: 12, color: "#6b7280" }}>Add a number below to message them.</span>}
          </div>
        )}

        <SectionTitle>Stage</SectionTitle>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STAGES.map(s => {
            const on = p.stage === s.id;
            return (
              <button key={s.id} disabled={busy || on} onClick={() => patch({ stage: s.id })}
                style={{ padding: "6px 11px", borderRadius: 99, fontSize: 12, fontWeight: on ? 700 : 500, fontFamily: "inherit", cursor: on ? "default" : "pointer",
                  background: on ? "rgba(255,255,255,0.08)" : "transparent", border: `1px solid ${on ? s.color : "rgba(255,255,255,0.08)"}`, color: on ? s.color : "#6b7280" }}>
                {s.label}
              </button>
            );
          })}
        </div>
        {p.stage === "lost" && (
          <input className="adm-input" style={{ width: "100%", marginTop: 10 }} placeholder="Why? (e.g. happy with Carlist, too small, no reply)"
            defaultValue={p.lost_reason || ""} onBlur={e => e.target.value !== (p.lost_reason || "") && patch({ lost_reason: e.target.value || null })} />
        )}

        {!closed && !p.do_not_contact && (
          <>
            <SectionTitle>Next follow-up · {fmtDay(p.next_follow_up_at)}</SectionTitle>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {[["Tomorrow", 1], ["3 days", 3], ["1 week", 7], ["2 weeks", 14], ["1 month", 30]].map(([l, n]) => (
                <button key={l} disabled={busy} onClick={() => patch({ next_follow_up_at: daysFromNow(n) })} style={btn()}>{l}</button>
              ))}
              {p.next_follow_up_at && <button disabled={busy} onClick={() => patch({ next_follow_up_at: null })} style={btn()}>Clear</button>}
            </div>
          </>
        )}

        <SectionTitle>Timeline</SectionTitle>
        <div style={{ display: "flex", gap: 8 }}>
          <input className="adm-input" style={{ flex: 1, minWidth: 0 }} placeholder="Add a note (what they said, objections…)" value={note}
            onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()} />
          <button disabled={!note.trim()} onClick={addNote} style={btn()}>Add</button>
        </div>
        <div style={{ marginTop: 10 }}>
          {activity.length === 0 ? (
            <p style={{ fontSize: 12, color: "#4b5563", margin: 0 }}>Nothing yet.</p>
          ) : activity.map(a => (
            <div key={a.id} style={{ display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
              <span style={{ color: "#4b5563", width: 70, flexShrink: 0 }}>{since(a.created_at)}</span>
              <span style={{ color: a.kind === "note" ? "#e5e7eb" : "#9ca3af", minWidth: 0, wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
                {a.kind === "stage" ? "Stage: " + a.body.split(" -> ").map(s => STAGE[s]?.label || s).join(" to ") : a.body}
              </span>
            </div>
          ))}
        </div>

        <SectionTitle>Details</SectionTitle>
        <ProspectFields value={draft} onChange={setDraft} />
        {dirty && (
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button disabled={busy || !draft.name?.trim()} onClick={() => patch({ ...draft, name: draft.name.trim(), phone: (draft.phone || "").trim() || null })} style={btn("primary")}>Save details</button>
          </div>
        )}
        <p style={{ fontSize: 11, color: "#4b5563", margin: "10px 0 0" }}>
          Added {since(p.created_at)} · from {SOURCE_LABEL[p.source] || p.source}
        </p>

        <SectionTitle>If they say stop</SectionTitle>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={busy} onClick={() => patch({ do_not_contact: !p.do_not_contact })} style={btn(p.do_not_contact ? "neutral" : "bad")}>
            {p.do_not_contact ? "Remove do not contact" : "Mark do not contact"}
          </button>
          {confirmDelete ? (
            <>
              <button onClick={() => setConfirmDelete(false)} style={btn()}>Keep</button>
              <button disabled={busy} onClick={remove} style={btn("bad")}>Delete for good</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={btn()}>Delete…</button>
          )}
        </div>
        <p style={{ fontSize: 11, color: "#4b5563", margin: "8px 0 0", lineHeight: 1.5 }}>
          Mark do not contact keeps the record so they are never re-added and messaged again. Delete only if they asked for their data to be erased.
        </p>
      </div>
    </div>
  );
}
