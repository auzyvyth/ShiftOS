import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

export default function SuspendedBanner() {
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.is_active === false) setSuspended(true);
    });
  }, []);

  if (!suspended) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#0f1117",
        border: "1px solid rgba(220,38,38,0.4)",
        borderRadius: 16, padding: "40px 48px",
        maxWidth: 420, width: "90%", textAlign: "center",
        boxShadow: "0 0 60px rgba(220,38,38,0.12)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <p style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 28, letterSpacing: 3,
          color: "#dc2626", marginBottom: 12,
        }}>
          Account Suspended
        </p>
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14, color: "#9ca3af", lineHeight: 1.6,
          marginBottom: 28,
        }}>
          Your account has been suspended. Please contact XDrive support to resolve this.
        </p>
        <a
          href="https://wa.me/60174155191"
          target="_blank" rel="noreferrer"
          style={{
            display: "inline-block",
            background: "rgba(220,38,38,0.1)",
            border: "1px solid rgba(220,38,38,0.3)",
            color: "#f87171", borderRadius: 8,
            padding: "10px 24px", fontSize: 13,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 600, textDecoration: "none",
            marginBottom: 12,
          }}
        >
          Contact Support via WhatsApp
        </a>
        <br />
        <button
          onClick={() => supabase.auth.signOut().then(() => window.location.href = "/")}
          style={{
            background: "none", border: "none",
            color: "#4b5563", fontSize: 12,
            fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer", marginTop: 8,
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
