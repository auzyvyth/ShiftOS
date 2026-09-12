import { CheckCircle2, X } from "lucide-react";

/**
 * One-time "you're approved" banner, shown in place of AccountReviewBanner's
 * "under review" state once decide_user_approval() flips approval_status.
 *
 * Unlike AccountReviewBanner (derived straight from profile.approval_status,
 * so it naturally goes quiet the instant the status changes), this has to
 * stay visible until the seller actually dismisses it — approval_status
 * alone can't tell "just approved, never seen" apart from "approved a month
 * ago", so it reads the account_approved salesman_notifications/
 * dealer_notifications row instead and disappears only once that row is
 * marked read. Same channel decide_user_approval fans a push through.
 */
export default function AccountApprovedBanner({ notification, onDismiss }) {
  if (!notification || notification.is_read) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: 11,
        alignItems: "flex-start",
        padding: "12px 14px",
        marginBottom: 16,
        borderRadius: 10,
        background: "rgba(34,197,94,0.08)",
        border: "1px solid rgba(34,197,94,0.25)",
      }}
    >
      <CheckCircle2 size={16} style={{ color: "#4ade80", flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: "#f1f5f9" }}>
          {notification.title || "Your account has been approved"}
        </p>
        <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#9ca3af", lineHeight: 1.6 }}>
          {notification.body || "Your account has been approved. Your listings will be reviewed individually before they go live."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(notification.id)}
        aria-label="Dismiss"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "#6b7280",
          padding: 2,
          flexShrink: 0,
          display: "flex",
        }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
