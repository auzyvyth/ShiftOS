import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

const ENTER_DELAY_MS = 1600;

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
 *
 * It used to mount inline, in flow, the instant the notification loaded —
 * which lands mid-first-paint and shoves everything below it (tab pills,
 * empty-state cards, the tour's target buttons) down a beat after the page
 * already rendered, reading as a layout jump. It's now `position: absolute`
 * over the parent (the parent renders `position: relative`) so it never
 * takes up flow space, and it slides down from above after a short delay
 * instead of popping in static and immediate.
 */
export default function AccountApprovedBanner({ notification, onDismiss }) {
  const [entered, setEntered] = useState(false);
  const notificationId = notification?.id;
  const isRead = notification?.is_read;

  useEffect(() => {
    if (!notificationId || isRead) {
      setEntered(false);
      return;
    }
    const t = setTimeout(() => setEntered(true), ENTER_DELAY_MS);
    return () => clearTimeout(t);
  }, [notificationId, isRead]);

  if (!notification || notification.is_read) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 30,
        transform: entered ? "translateY(0)" : "translateY(-130%)",
        opacity: entered ? 1 : 0,
        transition: "transform 0.5s cubic-bezier(0.16,1,0.3,1), opacity 0.35s ease",
        pointerEvents: entered ? "auto" : "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 11,
          alignItems: "flex-start",
          padding: "12px 14px",
          marginBottom: 16,
          borderRadius: 10,
          background: "#0d1420",
          border: "1px solid rgba(34,197,94,0.25)",
          boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
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
    </div>
  );
}
