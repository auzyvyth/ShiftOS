import React, { useCallback, useEffect, useRef, useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";
import InfoHint from "../ui/InfoHint";

// XDrive Ops — identity approval queue. Every self-signup seller (dealer / solo
// salesman) lands here 'pending' and cannot reach their dashboard until approved.
// Reads the superadmin-guarded get_pending_approvals RPC (auth.users + owner-only
// kyc_documents are not client-readable). Premium accounts attach three ID
// photos, fetched here as short-lived signed URLs from the PRIVATE kyc-docs
// bucket. Approving or rejecting calls decide_user_approval, which PURGES the
// images — this queue is the only place they are ever viewed.

function fmtDate(str) {
  return str ? new Date(str).toLocaleString("en-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
}

// Written as instructions to the seller, not verdicts about them: this text is
// shown verbatim in their dashboard, and a rejection they can act on comes back
// as a good account instead of a support message or a lost seller.
const REJECT_REASONS = [
  "ID photo is too blurry to read — please retake in good light",
  "The name on your ID doesn't match your account name",
  "The ID photo is cut off — we need all four corners visible",
  "Selfie doesn't clearly show your face with the ID",
  "This ID has expired — please submit a current one",
  "Details you entered don't match your ID",
  "We couldn't verify your business details",
];

const PLAN_LABEL = {
  salesman_lite: "Salesman Lite (free)", salesman_full: "Salesman Premium",
  dealer_starter: "Dealer Starter", dealer_growth: "Dealer Growth",
  dealer_pro: "Dealer Pro", dealer_group: "Dealer Group", dealer_full: "Dealer",
};

function DocThumb({ label, url }) {
  const [open, setOpen] = useState(false);
  if (!url) return null;
  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: 0, cursor: "pointer", overflow: "hidden", width: 104 }}>
        <img src={url} alt={label} style={{ width: 104, height: 78, objectFit: "cover", display: "block" }} />
        <span style={{ display: "block", fontSize: 10, color: "#9ca3af", padding: "5px 6px", background: "rgba(255,255,255,0.02)" }}>{label}</span>
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <img src={url} alt={label} style={{ maxWidth: "94vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 10 }} />
        </div>
      )}
    </>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "3px 0", fontSize: 12.5 }}>
      <span style={{ color: "#6b7280" }}>{label}</span>
      <span style={{ color: "#e5e7eb", fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

// Props exist so the merged Review queue can host this list (P4). Standalone it
// still renders exactly as before: no props = own heading, own refresh, no filter.
//   kindFilter  "signup" | "kyc" | null -- which rows to show
//   embedded    hide the heading/refresh; the host renders one set for all types
//   refreshKey  bump to reload, so the host's single Refresh covers this list too
//   onCounts    reports { signups, ids } up so the host can label its filter pills
export default function UserApprovalsTab({ kindFilter = null, embedded = false, refreshKey = 0, onCounts } = {}) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [rows, setRows] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [urls, setUrls] = useState({});          // userId -> {front,back,selfie}
  const [acting, setActing] = useState(null);     // userId being decided
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Two queues, one list. A row is either a SIGNUP (account can't reach its
  // dashboard until approved) or a KYC submission from an already-approved
  // seller who wants the Verified badge. They share every field the card
  // renders, so they share the card — only the decision RPC differs.
  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    const [signup, kyc] = await Promise.all([
      supabase.rpc("get_pending_approvals"),
      supabase.rpc("get_pending_kyc"),
    ]);
    if (signup.error) { setErr(signup.error.message); setLoading(false); return; }
    if (kyc.error) { setErr(kyc.error.message); setLoading(false); return; }

    const signupRows = (signup.data || []).map((r) => ({ ...r, _kind: "signup" }));
    const seen = new Set(signupRows.map((r) => r.id));
    // A pending signup already shows that user's documents, so don't list them twice.
    const kycRows = (kyc.data || [])
      .filter((r) => !seen.has(r.id))
      .map((r) => ({
        ...r,
        _kind: "kyc",
        kyc_submitted_at: r.submitted_at,
        has_docs: !!(r.front_path || r.back_path || r.selfie_path),
      }));
    setRows([...signupRows, ...kycRows]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Report counts up for the host's filter pills. The callback is held in a REF
  // and the effect keys on `rows` only: hosts pass an inline arrow, so keying on
  // the callback would re-fire every render, and reporting up re-renders the
  // host -- that spins forever.
  const onCountsRef = useRef(onCounts);
  onCountsRef.current = onCounts;
  useEffect(() => {
    onCountsRef.current?.({
      signups: rows.filter((r) => r._kind === "signup").length,
      ids: rows.filter((r) => r._kind === "kyc").length,
    });
  }, [rows]);

  const visible = kindFilter ? rows.filter((r) => r._kind === kindFilter) : rows;

  // Sign the three image paths only when a card is opened (short 2-min TTL).
  const openCard = async (r) => {
    if (expanded === r.id) { setExpanded(null); return; }
    setExpanded(r.id);
    if (!r.has_docs || urls[r.id]) return;
    const paths = [r.front_path, r.back_path, r.selfie_path].filter(Boolean);
    if (!paths.length) return;
    const { data } = await supabase.storage.from("kyc-docs").createSignedUrls(paths, 120);
    const map = {};
    (data || []).forEach((d) => {
      if (d.path === r.front_path) map.front = d.signedUrl;
      else if (d.path === r.back_path) map.back = d.signedUrl;
      else if (d.path === r.selfie_path) map.selfie = d.signedUrl;
    });
    setUrls((u) => ({ ...u, [r.id]: map }));
  };

  const decide = async (userId, approve, reason) => {
    setActing(userId);
    // Purge the physical ID images first (the Storage API is the only path that
    // deletes the real bytes; the DB blocks raw deletes). Best-effort — if it
    // fails we still record the decision and warn, rather than trapping the
    // account in the queue.
    const row = rows.find((r) => r.id === userId);
    const paths = [row?.front_path, row?.back_path, row?.selfie_path].filter(Boolean);
    let purgeFailed = false;
    if (paths.length) {
      const { error: rmErr } = await supabase.storage.from("kyc-docs").remove(paths);
      if (rmErr) purgeFailed = true;
    }
    // A KYC row decides identity only (the badge). A signup row decides account
    // access, and grants the badge too when documents were attached.
    const { error } = await supabase.rpc(
      row?._kind === "kyc" ? "decide_kyc_verification" : "decide_user_approval",
      { p_user_id: userId, p_approve: approve, p_reason: reason || null },
    );
    setActing(null);
    if (error) { setErr(error.message); return; }
    if (purgeFailed) setErr("Decision saved, but the ID images may not have been fully deleted — check the kyc-docs bucket.");
    setRows((p) => p.filter((r) => r.id !== userId));
    setRejectFor(null); setRejectReason("");
  };

  return (
    <div>
      {!embedded && (
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>User Approvals
            <InfoHint title="What is this?" text="Two queues in one list. Plain rows are new dealers and solo salesmen who can't reach their dashboard until you approve them. Rows tagged ID CHECK are sellers who are already approved and have submitted their MyKad to earn the public Verified badge — approving one only grants the badge, it changes nothing about their access. Photos are shown as private, expiring links and are permanently deleted the instant you approve or reject." />
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280" }}>Account approvals and identity (ID) checks</p>
        </div>
        <button onClick={load}
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#9ca3af", fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
          ↻ Refresh
        </button>
      </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 80, color: "#4b5563" }}>Loading queue…</div>
      ) : err ? (
        <div style={{ textAlign: "center", padding: 60, color: "#f87171", fontSize: 13 }}>Error: {err}</div>
      ) : visible.length === 0 ? (
        embedded ? null : (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#374151" }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>✓</p>
            <p style={{ fontSize: 14, color: "#4b5563" }}>No accounts waiting for review</p>
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((r) => {
            const open = expanded === r.id;
            const tier = r.kyc_tier || (!r.plan ? "no plan" : ["salesman_lite"].includes(r.plan) ? "free" : "premium");
            const u = urls[r.id] || {};
            const busy = acting === r.id;
            return (
              <div key={r.id} style={{ background: "#0d1117", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
                <button onClick={() => openCard(r)}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "13px 15px", fontFamily: "inherit", display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ width: 38, height: 38, borderRadius: 99, flexShrink: 0, overflow: "hidden", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14, fontWeight: 700 }}>
                    {r.avatar_url ? <img src={r.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (r.full_name || r.email || "?").trim().charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 2 }}>
                      <span style={{ fontSize: 13.5, color: "#e5e7eb", fontWeight: 600 }}>{r.full_name || "No name"}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: tier === "premium" ? "rgba(192,132,252,0.14)" : "rgba(148,163,184,0.14)", color: tier === "premium" ? "#c084fc" : "#94a3b8", letterSpacing: "0.04em", textTransform: "uppercase" }}>{tier}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "rgba(96,165,250,0.14)", color: "#60a5fa", letterSpacing: "0.04em", textTransform: "uppercase" }}>{r.role}</span>
                      {r._kind === "kyc" && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "rgba(34,197,94,0.14)", color: "#4ade80", letterSpacing: "0.04em", textTransform: "uppercase" }}>ID check</span>
                      )}
                    </div>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#6b7280", wordBreak: "break-word" }}>
                      {r.email}<span style={{ color: "#475569" }}> · {fmtDate(r.kyc_submitted_at || r.created_at)}</span>
                    </p>
                  </div>
                  <span style={{ color: "#475569", fontSize: 13, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
                </button>

                {open && (
                  <div style={{ padding: "4px 15px 15px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16, marginTop: 12 }}>
                      <div>
                        <Row label="Full name" value={r.full_name} />
                        <Row label="Email" value={r.email} />
                        <Row label="Phone" value={r.phone} />
                        <Row label="IC" value={r.ic_last4 ? `••••••-••-${r.ic_last4}` : null} />
                        <Row label="Plan" value={PLAN_LABEL[r.plan] || r.plan} />
                        <Row label="Business" value={r.dealership} />
                        <Row label="Submitted" value={fmtDate(r.kyc_submitted_at)} />
                      </div>
                      <div>
                        <p style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.08em", margin: "0 0 8px" }}>ID documents</p>
                        {/* Free sellers may now attach ID too (that is how a Lite
                            seller earns the badge), so photos are keyed off
                            has_docs rather than tier. */}
                        {r.has_docs ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            <DocThumb label="IC front" url={u.front} />
                            <DocThumb label="IC back" url={u.back} />
                            <DocThumb label="Selfie" url={u.selfie} />
                          </div>
                        ) : tier === "premium" ? (
                          <p style={{ fontSize: 12, color: "#facc15" }}>Premium account, no documents submitted yet.</p>
                        ) : (
                          <p style={{ fontSize: 12, color: "#4b5563" }}>Free account — IC number only, no ID photos submitted.</p>
                        )}
                      </div>
                    </div>

                    {rejectFor === r.id ? (
                      <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 8 }}>
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#f87171", fontWeight: 600 }}>Reason for rejection — shown to the user</p>
                        {/* Preset reasons: the seller reads this verbatim in
                            their dashboard, so a one-tap wording that actually
                            tells them what to fix beats a hurried "blurry".
                            Still editable — pick one, then adjust. */}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                          {REJECT_REASONS.map((preset) => {
                            const active = rejectReason === preset;
                            return (
                              <button
                                key={preset}
                                type="button"
                                onClick={() => setRejectReason(active ? "" : preset)}
                                style={{
                                  fontSize: 11, padding: "5px 10px", borderRadius: 999,
                                  background: active ? "rgba(239,68,68,0.16)" : "rgba(255,255,255,0.04)",
                                  border: `1px solid ${active ? "rgba(239,68,68,0.45)" : "rgba(255,255,255,0.1)"}`,
                                  color: active ? "#fca5a5" : "#9ca3af",
                                  cursor: "pointer", fontFamily: "inherit", textAlign: "left",
                                }}
                              >
                                {preset}
                              </button>
                            );
                          })}
                        </div>
                        <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2}
                          placeholder="Pick a reason above, or write your own…"
                          style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 7, color: "#e5e7eb", fontSize: 13, padding: "8px 10px", resize: "vertical", fontFamily: "system-ui, sans-serif", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => { setRejectFor(null); setRejectReason(""); }}
                            style={{ flex: 1, padding: "7px 0", borderRadius: 7, fontSize: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#6b7280", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                          <button disabled={!rejectReason.trim() || busy} onClick={() => decide(r.id, false, rejectReason.trim())}
                            style={{ flex: 2, padding: "7px 0", borderRadius: 7, fontSize: 12, fontWeight: 700, background: rejectReason.trim() ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", border: rejectReason.trim() ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.08)", color: rejectReason.trim() ? "#f87171" : "#374151", cursor: rejectReason.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>
                            {busy ? "Rejecting…" : "Confirm reject"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 8, marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                        <button disabled={busy} onClick={() => setRejectFor(r.id)}
                          style={{ padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", cursor: "pointer", fontFamily: "inherit" }}>Reject</button>
                        <button disabled={busy} onClick={() => decide(r.id, true)}
                          style={{ marginLeft: "auto", padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", color: "#4ade80", cursor: busy ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: busy ? 0.6 : 1 }}>
                          {busy ? "…" : "✓ Approve"}
                        </button>
                      </div>
                    )}
                    <p style={{ margin: "12px 0 0", fontSize: 10.5, color: "#475569" }}>Deciding permanently deletes any uploaded ID photos.</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
