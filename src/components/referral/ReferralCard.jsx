import React, { useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { inviteUrl, claimInviteCode } from "../../utils/invite";
import { premiumDark as PD } from "../../theme/tokens";

// "Refer a seller" (REFER-1). The terms on this card are the whole programme
// and must match the DB (grant_referral_reward, migration 20261004a): 30 days
// of Premium per invited seller who has paid for Premium twice, one level,
// at most 12 a year, never cash. Do not word it as income or commission.
//
// Dark seller-panel surface (Lite + Premium settings), so light text.
// theme="premium" (premiumDark): no outlines, no amber, and no heading of its
// own (the Settings section above it is "Refer a Seller").
const LEGACY = {
  card: { padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 },
  text: "#f1f5f9", sec: "#9ca3af", muted: "#6b7280", strong: "#e5e7eb", label: "#d1d5db",
  field: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" },
  ghost: { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#d1d5db" },
  line: "rgba(255,255,255,0.06)", warn: "#fbbf24", ok: "#4ade80",
};
const PREMIUM = {
  card: { padding: 18, background: PD.card, borderRadius: PD.radius.card },
  text: PD.text, sec: PD.textSec, muted: PD.textMuted, strong: PD.text, label: PD.text,
  field: { background: PD.raised, border: `1px solid ${PD.line}` },
  ghost: { background: PD.raised, border: "none", color: PD.text },
  line: PD.line, warn: PD.accentText, ok: PD.up,
};

export default function ReferralCard({ slug, style, theme }) {
  const prem = theme === "premium";
  const K = prem ? PREMIUM : LEGACY;
  const [stats, setStats] = useState(null);
  const [reload, setReload] = useState(0);
  const [code, setCode] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [claimMsg, setClaimMsg] = useState(null);
  const link = inviteUrl(slug);

  useEffect(() => {
    let alive = true;
    supabase.rpc("get_my_referrals").then(({ data, error }) => {
      if (!alive) return;
      // On error the counts are simply not shown; the link still works.
      if (!error) setStats(data || { joined: 0, pending: 0, earned: 0, capped: 0 });
    });
    return () => { alive = false; };
  }, [reload]);

  // The invite link only remembers itself on the phone that tapped it, so a
  // seller who signed up on another device enters the inviter here. The DB
  // decides everything (claim_referral: 14 days, before any payment, once,
  // never yourself, 10 tries a day).
  const claim = async (e) => {
    e.preventDefault();
    if (!code.trim() || claiming) return;
    setClaiming(true);
    const r = await claimInviteCode(code);
    setClaiming(false);
    setClaimMsg(r);
    if (r.result === "ok") { setCode(""); setReload((n) => n + 1); }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy. Press and hold the link to copy it.");
    }
  };

  const share = async () => {
    const text = "I list my cars on XDrive. Sign up with my link:";
    if (navigator.share) {
      try { await navigator.share({ title: "XDrive", text, url: link }); } catch { /* cancelled */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, "_blank", "noopener,noreferrer");
    }
  };

  const btn = {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8,
    fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  };

  return (
    <div style={{ ...K.card, ...style }}>
      {!prem && <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: K.text }}>Refer a seller, get Premium free</p>}
      <p style={{ margin: 0, fontSize: 12.5, color: K.sec, lineHeight: 1.6 }}>
        Send another car seller your link. Once they have paid for Premium twice, you get 30 days of Premium free.
        Up to 12 free months a year.
      </p>

      {link ? (
        <>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, ...K.field, fontSize: 12.5, color: K.strong, wordBreak: "break-all", userSelect: "all" }}>
            {link}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={share} style={{ ...btn, background: "#dc2626", border: "none", color: "#fff" }}>
              <Share2 size={13} /> Share link
            </button>
            <button type="button" onClick={copy} style={{ ...btn, ...K.ghost }}>
              <Copy size={13} /> Copy
            </button>
          </div>
        </>
      ) : (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: K.warn }}>
          Set your public page link in Public Profile first. Your invite link uses it.
        </p>
      )}

      {stats && (
        <div style={{ display: "flex", gap: 24, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${K.line}`, flexWrap: "wrap" }}>
          <Stat K={K} n={stats.joined} label="Signed up" />
          <Stat K={K} n={stats.pending} label="Paid once" />
          <Stat K={K} n={stats.earned} label={stats.earned === 1 ? "Month earned" : "Months earned"} />
        </div>
      )}
      {stats?.pending > 0 && (
        <p style={{ margin: "8px 0 0", fontSize: 11.5, color: K.sec, lineHeight: 1.6 }}>
          {stats.pending === 1 ? "1 seller is" : `${stats.pending} sellers are`} one payment away from earning you a free month.
        </p>
      )}

      {stats?.invited_by ? (
        <p style={{ margin: "14px 0 0", paddingTop: 12, borderTop: `1px solid ${K.line}`, fontSize: 12, color: K.sec }}>
          You joined through <span style={{ color: K.strong, fontWeight: 600 }}>{stats.invited_by}</span>'s invite.
        </p>
      ) : stats?.can_claim ? (
        <form onSubmit={claim} style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${K.line}` }}>
          <label htmlFor="xd-invited-by" style={{ display: "block", fontSize: 12, color: K.label, fontWeight: 600 }}>
            Did another seller invite you?
          </label>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: K.muted, lineHeight: 1.6 }}>
            Paste their invite link or type their link name. You can only do this once, in your first 14 days.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input id="xd-invited-by" value={code} onChange={(e) => { setCode(e.target.value); setClaimMsg(null); }}
              maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="e.g. ahmad-cars"
              style={{ flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 8, ...K.field, color: K.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
            <button type="submit" disabled={claiming || !code.trim()}
              style={{ ...btn, ...K.ghost, opacity: claiming || !code.trim() ? 0.5 : 1 }}>
              {claiming ? "Saving..." : "Save"}
            </button>
          </div>
          {claimMsg && (
            <p role="status" style={{ margin: "6px 0 0", fontSize: 11.5, color: claimMsg.result === "ok" ? K.ok : K.warn }}>
              {claimMsg.message}
            </p>
          )}
        </form>
      ) : null}

      <p style={{ margin: "12px 0 0", fontSize: 11, color: K.muted, lineHeight: 1.6 }}>
        Free to join. Only sellers who sign up with your link count, not the people they invite.
        Rewards are Premium time, never cash.
      </p>
    </div>
  );
}

function Stat({ K, n, label }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: K.text, fontVariantNumeric: "tabular-nums" }}>{n ?? 0}</p>
      <p style={{ margin: "2px 0 0", fontSize: 11, color: K.muted }}>{label}</p>
    </div>
  );
}
