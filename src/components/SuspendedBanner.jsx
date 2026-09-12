import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function SuspendedBanner() {
  const [suspended, setSuspended] = useState(false);
  // Why. The wall used to say only "contact support", so a seller had no idea
  // what to fix and support got the question instead (A5). The admin console
  // now records a reason written as something they can act on.
  const [reason, setReason] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("is_active, suspension_reason, suspended_at")
        .eq("id", user.id)
        .maybeSingle();
      // is_active is also false for an account that was never approved yet
      // (fresh signup, or rejected) — neither has been suspended. Only
      // set_account_suspended() ever stamps suspended_at, so that's the one
      // reliable signal a real suspension happened; a pending/rejected seller
      // gets AccountReviewBanner's message instead, not this wall.
      if (data?.is_active === false && data?.suspended_at) {
        setSuspended(true);
        setReason(data.suspension_reason || null);
      }
    });
  }, []);

  if (!suspended) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          background: "#0f1117",
          border: "1px solid rgba(220,38,38,0.4)",
          borderRadius: 16,
          padding: "40px 48px",
          maxWidth: 420,
          width: "90%",
          textAlign: "center",
          boxShadow: "0 0 60px rgba(220,38,38,0.12)",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <p
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            letterSpacing: 3,
            color: "#dc2626",
            marginBottom: 12,
          }}
        >
          Account Suspended
        </p>
        <p
          style={{
            fontFamily: "system-ui, sans-serif",
            fontSize: 14,
            color: "#9ca3af",
            lineHeight: 1.6,
            marginBottom: 28,
          }}
        >
          {reason
            ? "Your account has been suspended for the reason below. Sort it out and contact us to have it lifted."
            : "Your account has been suspended. Please contact XDrive support to resolve this."}
        </p>
        {reason && (
          <p
            style={{
              fontFamily: "system-ui, sans-serif",
              fontSize: 13.5,
              color: "#fca5a5",
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.28)",
              borderRadius: 10,
              padding: "12px 14px",
              lineHeight: 1.55,
              marginBottom: 24,
              textAlign: "left",
            }}
          >
            {reason}
          </p>
        )}
        <a
          href="https://wa.me/601111521742"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            background: "rgba(220,38,38,0.1)",
            border: "1px solid rgba(220,38,38,0.3)",
            color: "#f87171",
            borderRadius: 8,
            padding: "10px 24px",
            fontSize: 13,
            fontFamily: "system-ui, sans-serif",
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          Contact Support via WhatsApp
        </a>
        <br />
        <button
          onClick={() =>
            supabase.auth.signOut().then(() => (window.location.href = "/"))
          }
          style={{
            background: "none",
            border: "none",
            color: "#4b5563",
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
