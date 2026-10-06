import { Clock, AlertCircle } from "lucide-react";

/**
 * Account review status for a self-signup seller.
 *
 * Shown as a BANNER, never a gate. A seller waiting on review uses the whole
 * dashboard. Their cars go through the per-car review like anyone's (CarForm
 * needsApproval) -- account approval does NOT hold them back, so this must not
 * say "goes live the moment you're approved" (it did, and it was false). What
 * approval gates is answering Find me posts (find_me_reply).
 *
 * Rendered by SalesmanLite AND SalesmanPremium. Premium had no copy at all, so
 * a Premium signup waiting on review was never told.
 *
 * A rejection ALWAYS shows the reason. `rejection_reason` is written by the
 * platform console's reject flow and rendered verbatim here, so the reasons
 * offered there are phrased as something the seller can act on.
 *
 * Renders nothing for an approved account — the normal state stays quiet.
 */
export default function AccountReviewBanner({ profile }) {
  const status = profile?.approval_status;
  if (status !== "pending" && status !== "rejected") return null;

  const rejected = status === "rejected";
  const Icon = rejected ? AlertCircle : Clock;
  const accent = rejected ? "#f87171" : "#facc15";
  const tint = rejected ? "rgba(220,38,38,0.07)" : "rgba(234,179,8,0.07)";
  const edge = rejected ? "rgba(220,38,38,0.22)" : "rgba(234,179,8,0.22)";

  return (
    <div
      style={{
        display: "flex",
        gap: 11,
        alignItems: "flex-start",
        padding: "12px 14px",
        marginBottom: 16,
        borderRadius: 10,
        background: tint,
        border: `1px solid ${edge}`,
      }}
    >
      <Icon size={16} style={{ color: accent, flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#f1f5f9" }}>
          {rejected ? "We couldn't approve your account yet" : "Your account is under review"}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
          {rejected
            ? "Fix the point below and your account goes straight back into the queue — your listings and details are all still here."
            : "Everything works while you wait: add your cars and take leads. Each car is still checked before it goes live, as usual. Once we've confirmed your details you can also answer buyers' Find me posts."}
        </p>
        {rejected && profile?.rejection_reason && (
          <p
            style={{
              margin: "9px 0 0",
              padding: "8px 11px",
              borderRadius: 7,
              background: "rgba(0,0,0,0.25)",
              border: "1px solid rgba(255,255,255,0.06)",
              fontSize: 12.5,
              color: "#fca5a5",
              lineHeight: 1.6,
            }}
          >
            {profile.rejection_reason}
          </p>
        )}
      </div>
    </div>
  );
}
