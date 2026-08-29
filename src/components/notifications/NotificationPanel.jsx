import React, { useEffect, useRef, useCallback } from "react";
import { ChevronRight } from "lucide-react";

// The seller notification panel, shared by Salesman Lite and Salesman Premium.
// Both pages carried a near-identical copy of this markup; they are one thing
// showing one table (salesman_notifications), so they are one component.
//
// Two things this fixes over the copies it replaces:
//
// 1. READ ON SIGHT, not read on click. A notification you have looked at is
//    read. Marking only on click meant the red dot survived opening the panel
//    and reading every line in it, so the badge stopped meaning anything. Rows
//    are marked once they have actually been ON SCREEN for a moment
//    (IntersectionObserver + a dwell delay), so a long list only marks what the
//    seller scrolled to — not the forty rows still below the fold.
// 2. A notification is a LINK. Every row is about something that lives on a
//    page — a chat thread, a booking, a listing — and rendering it as dead text
//    made the seller hunt for it. `salesman_notifications` has carried `type`
//    and `ref_id` all along; the pages just never selected them.
//
// Navigation itself stays with the page: Lite and Premium have different tabs
// and routes, so each passes its own `onOpen(notif)`.

// What each notification type points at, and the label for its affordance.
// ref_id per type (verified against prod rows):
//   chat_message        -> chat_threads.id
//   new_booking         -> appointments.id
//   booking_unconfirmed -> appointments.id
//   new_enquiry         -> whatsapp_enquiries.id
//   listing_approved    -> car_listings.id
//   listing_rejected    -> car_listings.id
// broadcast / platform_broadcast carry no ref_id and go nowhere — they are the
// message, so they render as plain rows with no affordance.
export const NOTIF_TARGETS = {
  chat_message: "Open chat",
  new_booking: "View booking",
  booking_unconfirmed: "View booking",
  new_enquiry: "View enquiry",
  listing_approved: "View listing",
  listing_rejected: "View listing",
};

export const notifTargetLabel = (n) =>
  n?.ref_id && NOTIF_TARGETS[n?.type] ? NOTIF_TARGETS[n.type] : null;

// How long a row must stay on screen before it counts as read. Long enough that
// a fast flick past forty rows doesn't wipe the whole list, short enough that
// actually looking at one is enough.
const DWELL_MS = 700;
const VISIBLE_RATIO = 0.6;

function NotifRow({ n, onSeen, onOpen, timeAgo }) {
  const ref = useRef(null);
  const target = notifTargetLabel(n);

  // Mark read once this row has been continuously visible for DWELL_MS. The
  // timer is cleared the moment it leaves the viewport, so scrolling straight
  // past a row does not mark it.
  useEffect(() => {
    if (n.is_read) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer = null;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= VISIBLE_RATIO) {
          timer = setTimeout(() => onSeen(n.id), DWELL_MS);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [VISIBLE_RATIO] },
    );
    obs.observe(el);
    return () => { if (timer) clearTimeout(timer); obs.disconnect(); };
  }, [n.id, n.is_read, onSeen]);

  const clickable = !!target;

  return (
    <div
      ref={ref}
      onClick={clickable ? () => onOpen(n) : undefined}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(n); } } : undefined}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: n.is_read ? "transparent" : "rgba(96,165,250,0.06)",
        cursor: clickable ? "pointer" : "default",
      }}
    >
      {/* Unread marker. A dot on the row itself, so "which ones are new" survives
          the panel being open — the header count alone cannot say which. */}
      <span
        aria-hidden
        style={{
          width: 6, height: 6, borderRadius: 99, marginTop: 5, flexShrink: 0,
          background: n.is_read ? "transparent" : "#3b82f6",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 2px", fontSize: 12, fontWeight: 600, color: n.is_read ? "#9ca3af" : "#f1f5f9" }}>
          {n.title}
        </p>
        {n.body && (
          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#4b5563", overflowWrap: "anywhere" }}>
            {n.body}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "#374151" }}>{timeAgo(n.created_at)}</span>
          {target && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 600, color: "#60a5fa" }}>
              {target} <ChevronRight size={11} />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NotificationPanel({
  notifications = [],
  unreadCount = 0,
  isMobile = false,
  timeAgo,
  onSeen,          // (ids[]) -> void, batched rows that have now been looked at
  onMarkAllRead,
  onOpen,          // (notif) -> void, page-owned navigation
  onClose,
}) {
  // Batch the "seen" ids into one write per burst rather than one per row —
  // scrolling a full panel would otherwise fire a request per notification.
  const pending = useRef(new Set());
  const flushTimer = useRef(null);

  const handleSeen = useCallback((id) => {
    pending.current.add(id);
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      const ids = [...pending.current];
      pending.current.clear();
      if (ids.length) onSeen?.(ids);
    }, 300);
  }, [onSeen]);

  useEffect(() => () => clearTimeout(flushTimer.current), []);

  const shell = isMobile
    ? {
        position: "fixed", bottom: 0, left: 0, right: 0, maxHeight: "70dvh",
        borderRadius: "16px 16px 0 0", boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
      }
    : {
        position: "fixed", top: 58, right: 24, width: 320, maxHeight: 420,
        borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
      };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 998 }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...shell,
          background: "#111827",
          border: "1px solid rgba(255,255,255,0.1)",
          zIndex: 999,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
            Notifications{" "}
            {unreadCount > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10, background: "#ef4444", color: "#fff", borderRadius: 99, padding: "1px 6px" }}>
                {unreadCount}
              </span>
            )}
          </p>
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} style={{ background: "none", border: "none", fontSize: 10, color: "#60a5fa", cursor: "pointer", padding: 0 }}>
              Mark all read
            </button>
          )}
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {notifications.length === 0 && (
            <p style={{ margin: 0, padding: "24px 16px", fontSize: 12, color: "#4b5563", textAlign: "center" }}>
              No notifications yet.
            </p>
          )}
          {notifications.map((n) => (
            <NotifRow key={n.id} n={n} onSeen={handleSeen} onOpen={onOpen} timeAgo={timeAgo} />
          ))}
        </div>
      </div>
    </div>
  );
}
