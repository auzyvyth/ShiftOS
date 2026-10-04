import React, { useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { inviteUrl } from "../../utils/invite";

// "Refer a seller" (REFER-1). The terms on this card are the whole programme
// and must match the DB (grant_referral_reward, migration 20261004a): 30 days
// of Premium per invited seller who has paid for Premium twice, one level,
// at most 12 a year, never cash. Do not word it as income or commission.
//
// Dark seller-panel surface (Lite + Premium settings), so light text.
export default function ReferralCard({ slug, style }) {
  const [stats, setStats] = useState(null);
  const link = inviteUrl(slug);

  useEffect(() => {
    let alive = true;
    supabase.rpc("get_my_referrals").then(({ data, error }) => {
      if (!alive) return;
      // On error the counts are simply not shown; the link still works.
      if (!error) setStats(data || { joined: 0, earned: 0, capped: 0 });
    });
    return () => { alive = false; };
  }, []);

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
    <div style={{ padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, ...style }}>
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#f1f5f9" }}>Refer a seller, get Premium free</p>
      <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
        Send another car seller your link. Once they have paid for Premium twice, you get 30 days of Premium free.
        Up to 12 free months a year.
      </p>

      {link ? (
        <>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", fontSize: 12.5, color: "#e5e7eb", wordBreak: "break-all", userSelect: "all" }}>
            {link}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button type="button" onClick={share} style={{ ...btn, background: "#dc2626", border: "none", color: "#fff" }}>
              <Share2 size={13} /> Share link
            </button>
            <button type="button" onClick={copy} style={{ ...btn, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "#d1d5db" }}>
              <Copy size={13} /> Copy
            </button>
          </div>
        </>
      ) : (
        <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "#fbbf24" }}>
          Set your public page link in Public Profile first. Your invite link uses it.
        </p>
      )}

      {stats && (
        <div style={{ display: "flex", gap: 24, marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Stat n={stats.joined} label="Signed up" />
          <Stat n={stats.earned} label={stats.earned === 1 ? "Month earned" : "Months earned"} />
        </div>
      )}

      <p style={{ margin: "12px 0 0", fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
        Free to join. Only sellers who sign up with your link count, not the people they invite.
        Rewards are Premium time, never cash.
      </p>
    </div>
  );
}

function Stat({ n, label }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "#f1f5f9", fontVariantNumeric: "tabular-nums" }}>{n ?? 0}</p>
      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#6b7280" }}>{label}</p>
    </div>
  );
}
