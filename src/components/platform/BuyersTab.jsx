import React, { useEffect, useState, useMemo, useCallback } from "react";
import { platformClient as supabase } from "../../lib/platformClient";
import InfoHint from "../ui/InfoHint";

// XDrive Ops — marketplace buyer accounts (profiles.role = 'buyer').
//
// Everything here comes from two superadmin-guarded RPCs, never from direct table
// reads, for two reasons:
//   1. signup date / provider / last login / 2FA / ban state live in auth.users,
//      which the anon key cannot select at all.
//   2. saved_cars, price_alerts, reviews and listing_comments are owner-only RLS.
//      A superadmin selecting them from the client gets an EMPTY ARRAY WITH NO
//      ERROR — the panel would show "0 saved" for every buyer and look correct.
// If you ever "optimise" this into plain .from() calls, both break silently.

function num(n) { return Number(n || 0).toLocaleString("en-MY"); }

function timeAgo(str) {
  if (!str) return "never";
  const s = Math.floor((Date.now() - new Date(str)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtDate(str) {
  return str ? new Date(str).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function daysSince(str) {
  if (!str) return Infinity;
  return Math.floor((Date.now() - new Date(str)) / 86400000);
}

function money(n) {
  if (n == null) return null;
  return "RM " + Number(n).toLocaleString("en-MY");
}

// A buyer needs attention if the account is in a bad or unusual state.
function flagsFor(b) {
  const f = [];
  if (b.orphan) f.push({ label: "NO PROFILE", tone: "amber" });
  if (b.is_banned) f.push({ label: "BANNED", tone: "red" });
  if (b.locked_until) f.push({ label: "LOCKED OUT", tone: "amber" });
  if (!b.email_verified) f.push({ label: "UNVERIFIED", tone: "amber" });
  if (b.deleted_at) f.push({ label: "DELETED", tone: "red" });
  return f;
}

const TONES = {
  red:   { bg: "rgba(220,38,38,0.15)",  bd: "rgba(220,38,38,0.35)",  fg: "#f87171" },
  amber: { bg: "rgba(250,204,21,0.13)", bd: "rgba(250,204,21,0.3)",  fg: "#facc15" },
  green: { bg: "rgba(74,222,128,0.12)", bd: "rgba(74,222,128,0.28)", fg: "#4ade80" },
  blue:  { bg: "rgba(147,197,253,0.12)",bd: "rgba(147,197,253,0.28)",fg: "#93c5fd" },
  grey:  { bg: "rgba(255,255,255,0.05)",bd: "rgba(255,255,255,0.1)", fg: "#9ca3af" },
};

function Pill({ label, tone = "grey" }) {
  const t = TONES[tone] || TONES.grey;
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 99, background: t.bg, border: `1px solid ${t.bd}`, color: t.fg, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function Card({ label, value, accent }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", minWidth: 0 }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: accent || "#f0f0f0", fontFamily: "'Bebas Neue',sans-serif", letterSpacing: "0.05em", lineHeight: 1.2 }}>{value}</p>
    </div>
  );
}

function Detail({ label, value, mono }) {
  if (value == null || value === "") return null;
  return (
    <div style={{ marginTop: 12 }}>
      <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</p>
      <p style={{ margin: 0, fontSize: 12, color: "#cbd5e1", fontFamily: mono ? "monospace" : "inherit", wordBreak: "break-word" }}>{String(value)}</p>
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 10, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700, marginBottom: 2 }}>{title}</p>
      {children}
    </div>
  );
}

const FILTERS = [
  { id: "all",     label: "All" },
  { id: "active",  label: "Active 30d" },
  { id: "dormant", label: "Dormant" },
  { id: "engaged", label: "Engaged" },
  { id: "flagged", label: "Flagged" },
];

export default function BuyersTab() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);

  // Detail is fetched lazily per buyer and cached by id, so opening a card does
  // not re-pull the whole list.
  const [detail, setDetail] = useState({});
  const [detailLoading, setDetailLoading] = useState(null);

  // { buyer, kind: 'ban' | 'unban' | 'revoke' }
  const [confirm, setConfirm] = useState(null);
  const [acting, setActing] = useState(false);
  const [actionErr, setActionErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase.rpc("get_buyer_accounts", { p_limit: 500 });
    if (error) { setErr(error.message); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggle(b) {
    if (expanded === b.id) { setExpanded(null); return; }
    setExpanded(b.id);
    if (detail[b.id] || b.orphan) return;   // orphans have nothing to expand
    setDetailLoading(b.id);
    const { data, error } = await supabase.rpc("get_buyer_detail", { p_user_id: b.id });
    if (!error) setDetail(d => ({ ...d, [b.id]: data }));
    setDetailLoading(null);
  }

  async function runAction() {
    if (!confirm) return;
    setActing(true);
    setActionErr(null);
    const { buyer, kind } = confirm;
    const { error } =
      kind === "revoke"
        ? await supabase.rpc("admin_revoke_buyer_sessions", { p_user_id: buyer.id })
        : await supabase.rpc("admin_set_buyer_ban", {
            p_user_id: buyer.id,
            p_until: kind === "ban" ? new Date(Date.now() + 365 * 86400000).toISOString() : null,
          });
    setActing(false);
    if (error) { setActionErr(error.message); return; }
    setConfirm(null);
    load();
  }

  const visible = useMemo(() => {
    let r = rows;
    if (filter === "active")  r = r.filter(b => daysSince(b.last_sign_in_at) <= 30);
    if (filter === "dormant") r = r.filter(b => daysSince(b.last_sign_in_at) > 30);
    if (filter === "engaged") r = r.filter(b => Number(b.saved_count) + Number(b.alert_count) + Number(b.review_count) > 0);
    if (filter === "flagged") r = r.filter(b => flagsFor(b).length > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(b => [b.full_name, b.email, b.phone].some(v => v && String(v).toLowerCase().includes(q)));
    }
    return r;
  }, [rows, search, filter]);

  const stats = useMemo(() => {
    const d30 = rows.filter(b => daysSince(b.signed_up_at) <= 30).length;
    return {
      total: rows.length,
      new30: d30,
      google: rows.filter(b => b.provider === "google").length,
      engaged: rows.filter(b => Number(b.saved_count) + Number(b.alert_count) > 0).length,
      inPipeline: rows.filter(b => Number(b.lead_count) > 0).length,
      flagged: rows.filter(b => flagsFor(b).length > 0).length,
    };
  }, [rows]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>Buyers
            <InfoHint title="What is this?" text="Everyone who signed up on the XDrive marketplace to shop for a car — not dealers or salesmen. Shows how they signed up (Google or email), whether the account is secure, what they saved or set alerts on, and whether their phone or email matches a real lead sitting in a dealer's pipeline." />
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Marketplace shopper accounts — signup, security and activity</p>
        </div>
        <button onClick={load}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading buyers…</div>
      ) : err ? (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171", fontSize: 13 }}>Error: {err}</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 20 }}>
            <Card label="Total buyers" value={num(stats.total)} />
            <Card label="New (30d)" value={num(stats.new30)} accent={stats.new30 > 0 ? "#4ade80" : "#f0f0f0"} />
            <Card label="Signed up w/ Google" value={num(stats.google)} accent="#93c5fd" />
            <Card label="Saved or alerted" value={num(stats.engaged)} accent="#c084fc" />
            <Card label="Matched to a lead" value={num(stats.inPipeline)} accent={stats.inPipeline > 0 ? "#4ade80" : "#f0f0f0"} />
            <Card label="Needs attention" value={num(stats.flagged)} accent={stats.flagged > 0 ? "#facc15" : "#f0f0f0"} />
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone…"
              style={{ width: 280, maxWidth: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "white", fontSize: 12, padding: "6px 10px", borderRadius: 6, outline: "none", fontFamily: "inherit" }} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)}
                  style={{ fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                    background: filter === f.id ? "rgba(220,38,38,0.12)" : "rgba(255,255,255,0.05)",
                    border: `1px solid ${filter === f.id ? "rgba(220,38,38,0.3)" : "rgba(255,255,255,0.08)"}`,
                    color: filter === f.id ? "#f87171" : "#9ca3af" }}>
                  {f.label}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: "#4b5563", marginLeft: "auto" }}>{visible.length} shown</span>
          </div>

          {visible.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#374151" }}>
              <p style={{ fontSize: 14, color: "#4b5563" }}>No buyers match.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {visible.map(b => {
                const open = expanded === b.id;
                const flags = flagsFor(b);
                const d = detail[b.id];
                const engagement = [
                  Number(b.saved_count) ? `${b.saved_count} saved` : null,
                  Number(b.alert_count) ? `${b.alert_count} alert${b.alert_count > 1 ? "s" : ""}` : null,
                  Number(b.review_count) ? `${b.review_count} review${b.review_count > 1 ? "s" : ""}` : null,
                ].filter(Boolean).join(" · ");

                return (
                  <div key={b.id}
                    style={{ background: "#0d1117", border: `1px solid ${flags.length ? "rgba(250,204,21,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius: 10, overflow: "hidden" }}>
                    <button onClick={() => toggle(b)}
                      style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "12px 14px", fontFamily: "inherit", display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 32, height: 32, borderRadius: 99, flexShrink: 0, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 13, fontWeight: 700, overflow: "hidden" }}>
                        {b.avatar_url
                          ? <img src={b.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : (b.full_name || b.email || "?").trim().charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: "#e5e7eb", fontWeight: 600 }}>{b.full_name || "No name"}</span>
                          <Pill label={b.provider === "google" ? "GOOGLE" : "EMAIL"} tone={b.provider === "google" ? "blue" : "grey"} />
                          {Number(b.lead_count) > 0 && <Pill label={`${b.lead_count} LEAD${b.lead_count > 1 ? "S" : ""}`} tone="green" />}
                          {flags.map(f => <Pill key={f.label} label={f.label} tone={f.tone} />)}
                        </div>
                        <p style={{ margin: 0, fontSize: 11, color: "#6b7280", wordBreak: "break-word" }}>
                          {b.email}
                          <span style={{ color: "#475569" }}> · joined {fmtDate(b.signed_up_at)}</span>
                          <span style={{ color: "#475569" }}> · seen {timeAgo(b.last_sign_in_at)}</span>
                          {engagement && <span style={{ color: "#93c5fd" }}> · {engagement}</span>}
                        </p>
                      </div>
                      <span style={{ color: "#475569", fontSize: 13, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
                    </button>

                    {open && (
                      <div style={{ padding: "0 14px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        {b.orphan && (
                          <p style={{ margin: "12px 0 0", fontSize: 12, color: "#facc15" }}>
                            This login exists in auth but has no profile row, so it appears in no other admin list. It cannot be actioned here — resolve it in the database.
                          </p>
                        )}

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 18, marginTop: 12 }}>
                          <Block title="Account">
                            <Detail label="Email" value={b.email} mono />
                            <Detail label="Phone" value={b.phone} mono />
                            <Detail label="Signed up" value={b.signed_up_at ? new Date(b.signed_up_at).toLocaleString("en-MY") : null} />
                            <Detail label="Signup method" value={b.provider === "google" ? "Google" : "Email + password"} />
                            <Detail label="Email verified" value={b.email_verified ? "Yes" : "No"} />
                            <Detail label="PDPA consent" value={b.pdpa_consent ? "Given" : "Not given"} />
                          </Block>

                          <Block title="Security">
                            <Detail label="Last login" value={b.last_sign_in_at ? new Date(b.last_sign_in_at).toLocaleString("en-MY") : "Never signed in again"} />
                            <Detail label="Active sessions" value={String(b.active_sessions ?? 0)} />
                            <Detail label="Two-factor" value={b.mfa ? "Enabled" : "Not enabled"} />
                            {b.locked_until && <Detail label="Locked out until" value={new Date(b.locked_until).toLocaleString("en-MY")} />}
                            {b.banned_until && <Detail label="Banned until" value={new Date(b.banned_until).toLocaleString("en-MY")} />}
                            <Detail label="User id" value={b.id} mono />
                          </Block>

                          <Block title="Activity">
                            {detailLoading === b.id && <p style={{ fontSize: 12, color: "#4b5563", marginTop: 12 }}>Loading…</p>}
                            {d && (
                              <>
                                {d.saved_cars?.length > 0 && (
                                  <div style={{ marginTop: 12 }}>
                                    <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Saved cars</p>
                                    {d.saved_cars.map(c => (
                                      <p key={c.listing_id} style={{ margin: "0 0 3px", fontSize: 12, color: "#cbd5e1" }}>
                                        {c.year} {c.brand} {c.model}
                                        {money(c.price) && <span style={{ color: "#6b7280" }}> — {money(c.price)}</span>}
                                      </p>
                                    ))}
                                  </div>
                                )}
                                {d.price_alerts?.length > 0 && (
                                  <div style={{ marginTop: 12 }}>
                                    <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Price alerts</p>
                                    {d.price_alerts.map(a => (
                                      <p key={a.id} style={{ margin: "0 0 3px", fontSize: 12, color: "#cbd5e1" }}>
                                        {[a.brand, a.model, a.keyword].filter(Boolean).join(" ") || "Any car"}
                                        {a.max_price && <span style={{ color: "#6b7280" }}> — under {money(a.max_price)}</span>}
                                      </p>
                                    ))}
                                  </div>
                                )}
                                {d.reviews?.length > 0 && (
                                  <div style={{ marginTop: 12 }}>
                                    <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Reviews written</p>
                                    {d.reviews.map(r => (
                                      <p key={r.id} style={{ margin: "0 0 3px", fontSize: 12, color: "#cbd5e1" }}>
                                        {r.rating}★ {r.dealer_name || "unknown dealer"}
                                        <span style={{ color: "#6b7280" }}> — {r.status}</span>
                                      </p>
                                    ))}
                                  </div>
                                )}
                                {!d.saved_cars?.length && !d.price_alerts?.length && !d.reviews?.length && (
                                  <p style={{ fontSize: 12, color: "#4b5563", marginTop: 12 }}>Signed up but never saved, alerted or reviewed anything.</p>
                                )}
                              </>
                            )}
                          </Block>

                          <Block title="Dealer pipeline">
                            {detailLoading === b.id && <p style={{ fontSize: 12, color: "#4b5563", marginTop: 12 }}>Loading…</p>}
                            {d && (
                              <>
                                {d.leads?.length > 0 ? (
                                  <div style={{ marginTop: 12 }}>
                                    <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Leads ({d.leads.length})</p>
                                    {d.leads.slice(0, 6).map(l => (
                                      <p key={l.id} style={{ margin: "0 0 3px", fontSize: 12, color: "#cbd5e1" }}>
                                        {l.dealer_name || "unknown dealer"}
                                        <span style={{ color: "#6b7280" }}> — {l.stage}{l.lead_source ? ` · ${l.lead_source}` : ""}</span>
                                      </p>
                                    ))}
                                    {d.leads.length > 6 && <p style={{ margin: 0, fontSize: 11, color: "#4b5563" }}>+{d.leads.length - 6} more</p>}
                                  </div>
                                ) : (
                                  <p style={{ fontSize: 12, color: "#4b5563", marginTop: 12 }}>No lead matches this account&apos;s phone or email.</p>
                                )}
                                {d.enquiries?.length > 0 && (
                                  <Detail label="Enquiries sent" value={String(d.enquiries.length)} />
                                )}
                              </>
                            )}
                          </Block>
                        </div>

                        {!b.orphan && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                            <button className="adm-btn" onClick={() => { setActionErr(null); setConfirm({ buyer: b, kind: "revoke" }); }}
                              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                              Force sign-out
                            </button>
                            {b.is_banned ? (
                              <button className="adm-btn" onClick={() => { setActionErr(null); setConfirm({ buyer: b, kind: "unban" }); }}
                                style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }}>
                                Unban
                              </button>
                            ) : (
                              <button className="adm-btn" onClick={() => { setActionErr(null); setConfirm({ buyer: b, kind: "ban" }); }}
                                style={{ background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171" }}>
                                Ban account
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {confirm && (
        <div className="modal-overlay" onClick={() => !acting && setConfirm(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5", marginBottom: 10 }}>
              {confirm.kind === "ban" ? "Ban this buyer?" : confirm.kind === "unban" ? "Unban this buyer?" : "Sign this buyer out?"}
            </p>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 8, wordBreak: "break-word" }}>
              {confirm.buyer.full_name || "No name"} — {confirm.buyer.email}
            </p>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>
              {confirm.kind === "ban"
                ? "They will be blocked from signing in for one year. Existing logins stop working at their next token refresh — anyone already signed in can stay in for up to an hour."
                : confirm.kind === "unban"
                  ? "They will be able to sign in again immediately."
                  : "All their sessions are dropped, so they must sign in again. A token already issued stays valid until it expires, up to an hour."}
            </p>
            {actionErr && <p style={{ fontSize: 12, color: "#f87171", marginBottom: 14 }}>{actionErr}</p>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="adm-btn" onClick={() => setConfirm(null)} disabled={acting}
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}>
                Cancel
              </button>
              <button className="adm-btn" onClick={runAction} disabled={acting}
                style={{ background: confirm.kind === "unban" ? "rgba(74,222,128,0.15)" : "rgba(220,38,38,0.15)",
                         border: `1px solid ${confirm.kind === "unban" ? "rgba(74,222,128,0.4)" : "rgba(220,38,38,0.4)"}`,
                         color: confirm.kind === "unban" ? "#4ade80" : "#f87171",
                         opacity: acting ? 0.6 : 1 }}>
                {acting ? "Working…" : confirm.kind === "ban" ? "Ban" : confirm.kind === "unban" ? "Unban" : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
