import React, { useEffect, useState } from "react";
import { Copy, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { inviteUrl, claimInviteCode } from "../../utils/invite";
import { premiumDark as PD } from "../../theme/tokens";
import {
  REWARD_DAYS, REWARD_SLOTS, MAX_BONUS_SLOTS, MAX_REWARDS_PER_YEAR, PAID_BONUS_DAYS,
  rewardLines, PERSON_STATE,
} from "../../utils/referralTerms";

// "Refer a seller" (REFER-1 + REFER-2, two-sided). Rendered by Lite AND
// Premium settings; `tier` ("lite" | "premium") only changes how the reward is
// worded for the reader. Every number comes from utils/referralTerms.js, which
// must match the DB (referral_grant_bonus, grant_referral_reward). Never word
// it as income or commission: the reward is product time and car slots.
//
// Dark seller-panel surface, so light text. theme="premium" (premiumDark): no
// outlines, no amber, and no heading of its own (the Settings section is it).
const LEGACY = {
  card: { padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 },
  text: "#f1f5f9", sec: "#9ca3af", muted: "#6b7280", strong: "#e5e7eb", label: "#d1d5db",
  field: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" },
  ghost: { background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#d1d5db" },
  raised: "rgba(255,255,255,0.04)",
  line: "rgba(255,255,255,0.06)", warn: "#fbbf24", ok: "#4ade80",
};
const PREMIUM = {
  card: { padding: 18, background: PD.card, borderRadius: PD.radius.card },
  text: PD.text, sec: PD.textSec, muted: PD.textMuted, strong: PD.text, label: PD.text,
  field: { background: PD.raised, border: `1px solid ${PD.line}` },
  ghost: { background: PD.raised, border: "none", color: PD.text },
  raised: PD.raised,
  line: PD.line, warn: PD.accentText, ok: PD.up,
};

export default function ReferralCard({ slug, style, theme, tier = "lite" }) {
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
      if (!error) setStats(data || {});
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
    const text = `I list my cars on Drevo. Sign up with my link and list your first car: we both get ${REWARD_DAYS} days of Premium and ${REWARD_SLOTS} extra car slots.`;
    if (navigator.share) {
      try { await navigator.share({ title: "Drevo", text, url: link }); } catch { /* cancelled */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${link}`)}`, "_blank", "noopener,noreferrer");
    }
  };

  const btn = {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 8,
    fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  };
  const small = { margin: 0, fontSize: 12, color: K.sec, lineHeight: 1.6 };
  const divider = { marginTop: 14, paddingTop: 12, borderTop: `1px solid ${K.line}` };

  const people = Array.isArray(stats?.people) ? stats.people : [];
  const bonusSlots = stats?.bonus_slots ?? 0;
  const liteCap = stats?.lite_cap ?? null;
  const rewards = people.filter((p) => p.state === "granted").length;

  return (
    <div style={{ ...K.card, ...style }}>
      {!prem && <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: K.text }}>Invite a seller. You both get a reward.</p>}

      {/* What you get, said once, in the reader's own plan. */}
      <p style={{ margin: 0, fontSize: 12.5, color: K.sec, lineHeight: 1.6 }}>
        Send another car seller your link. When they sign up and their first car goes live, you <b style={{ color: K.strong }}>and</b> they each get:
      </p>
      <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
        {rewardLines(tier).map((line) => (
          <li key={line} style={{ display: "flex", gap: 8, fontSize: 12.5, color: K.strong, lineHeight: 1.5 }}>
            <Check size={14} style={{ flexShrink: 0, marginTop: 2, color: K.ok }} aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p style={{ ...small, marginTop: 8, fontSize: 11.5 }}>
        Plus: once a seller you invited has paid for Premium twice, you get {PAID_BONUS_DAYS} more days.
      </p>

      {link ? (
        <>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, ...K.field, fontSize: 12.5, color: K.strong, wordBreak: "break-all", userSelect: "all" }}>
            {link}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span className="lk-wrap-red">
              <button type="button" onClick={share} className="lk-red" style={{ ...btn, border: "none", color: "#fff" }}>
                <Share2 size={13} /> Share link
              </button>
            </span>
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

      {/* How it works: the three things that have to happen, in order. */}
      <ol style={{ ...divider, margin: "14px 0 0", paddingLeft: 18, display: "grid", gap: 4, fontSize: 12, color: K.sec, lineHeight: 1.6 }}>
        <li>They open your link and sign up as a seller (Lite or Premium, both count).</li>
        <li>They add their first car. We check every new car before it goes live.</li>
        <li>When it goes live, both rewards are added straight away and you both get a notification.</li>
      </ol>

      {stats && (
        <div style={{ ...divider, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Stat K={K} n={stats.joined} label="Signed up" />
          <Stat K={K} n={rewards} label={rewards === 1 ? "Reward earned" : "Rewards earned"} />
          <Stat K={K} n={`${bonusSlots}/${MAX_BONUS_SLOTS}`} label="Extra car slots" />
        </div>
      )}
      {stats && bonusSlots > 0 && liteCap != null && (
        <p style={{ ...small, marginTop: 8, fontSize: 11.5 }}>
          Your extra slots are yours for good: on Lite you can have {liteCap + bonusSlots} cars live instead of {liteCap}.
        </p>
      )}

      {people.length > 0 && (
        <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
          {people.map((p, i) => (
            <div key={`${p.name}-${i}`} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 10px", borderRadius: 8, background: K.raised, fontSize: 12 }}>
              <span style={{ color: K.strong, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <span style={{ color: p.state === "granted" ? K.ok : K.sec, textAlign: "right", flexShrink: 1 }}>{PERSON_STATE[p.state] || PERSON_STATE.waiting}</span>
            </div>
          ))}
        </div>
      )}

      {stats?.invited_by ? (
        <div style={divider}>
          <p style={{ margin: 0, fontSize: 12, color: K.sec }}>
            You joined through <span style={{ color: K.strong, fontWeight: 600 }}>{stats.invited_by_name || stats.invited_by}</span>'s invite.
          </p>
          <p style={{ ...small, marginTop: 4, color: stats.my_reward === "granted" ? K.ok : K.sec }}>
            {stats.my_reward === "granted"
              ? "You got your invite reward."
              : stats.my_reward === "ineligible"
                ? "This invite didn't earn a reward: both accounts use the same phone number."
                : `Your reward lands when your first car goes live: ${REWARD_DAYS} days of Premium and ${REWARD_SLOTS} extra car slots.`}
          </p>
        </div>
      ) : stats?.can_claim ? (
        <form onSubmit={claim} style={divider}>
          <label htmlFor="xd-invited-by" style={{ display: "block", fontSize: 12, color: K.label, fontWeight: 600 }}>
            Did another seller invite you?
          </label>
          <p style={{ margin: "4px 0 0", fontSize: 11, color: K.muted, lineHeight: 1.6 }}>
            Paste their invite link or type their link name, and you both get the reward when your first car goes live. You can only do this once, in your first 14 days.
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input id="xd-invited-by" value={code} onChange={(e) => { setCode(e.target.value); setClaimMsg(null); }}
              maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="e.g. ahmad-cars"
              style={{ flex: 1, minWidth: 0, padding: "9px 12px", borderRadius: 8, ...K.field, color: K.text, fontSize: 16, fontFamily: "inherit", outline: "none" }} />
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
        Up to {MAX_REWARDS_PER_YEAR} rewards a year for you; the seller you invite always gets theirs.
        Rewards are Premium time and car slots, never cash.
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
