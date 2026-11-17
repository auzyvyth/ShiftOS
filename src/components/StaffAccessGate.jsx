import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { isStaffSwitchedOff } from "../hooks/useProfile";
import { premiumLight as PL } from "../theme/tokens";

// DASH-TEST 3 (2026-11-17): a staff member the owner switched off sees ONE clear screen,
// on every staff page, instead of a panel full of empty lists. The database already shuts
// them out (get_my_dealer_id() is NULL for them, migration 20261117a); this only says why.
// Mounted once in App.jsx. It reads the signed-in person's own row, only on staff pages.
const STAFF_PATHS = ["/dashboard", "/salesman", "/manager", "/accountant", "/fi", "/admin"];

export default function StaffAccessGate() {
  const { pathname } = useLocation();
  const onStaffPage = STAFF_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}-premium`));
  const [off, setOff] = useState(false); // false | 'owner' | 'platform'

  useEffect(() => {
    if (!onStaffPage) { setOff(false); return undefined; }
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (alive) setOff(false); return; }
      const { data } = await supabase.from("profiles")
        .select("id, role, dealer_id, is_active, account_status, suspended_at")
        .eq("id", session.user.id).maybeSingle();
      // A failed read is never "switched off": the panels handle their own load errors.
      if (alive) setOff(data && isStaffSwitchedOff(data) ? (data.suspended_at ? "platform" : "owner") : false);
    })();
    return () => { alive = false; };
  }, [onStaffPage]);

  useEffect(() => {
    if (!off) return undefined;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [off]);

  if (!off) return null;
  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/login");
  };
  return createPortal(
    <div role="alertdialog" aria-modal="true" aria-label="Access switched off"
      style={{ position: "fixed", inset: 0, zIndex: 13000, background: PL.canvas, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, background: PL.card, borderRadius: 20, boxShadow: PL.shadow, padding: "26px 22px", textAlign: "center" }}>
        <img src="/drevo-logo-dark.png" alt="Drevo" width="688" height="120" style={{ height: 16, width: "auto", margin: "0 auto 18px", display: "block" }} />
        <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: PL.text }}>Your access is switched off</p>
        <p style={{ margin: "8px 0 20px", fontSize: 14, lineHeight: 1.5, color: PL.textMuted }}>
          {off === "platform"
            ? "Drevo has suspended this account, so you cannot open your dealership's leads, cars or customers. Contact Drevo support if you think this is a mistake."
            : "The owner of your dealership has switched off your account, so you cannot open its leads, cars or customers. If this is a mistake, ask the owner to switch you back on in Team."}
        </p>
        <button type="button" onClick={signOut}
          style={{ width: "100%", minHeight: 44, border: "none", borderRadius: 12, background: PL.raised, color: PL.text, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          Sign out
        </button>
      </div>
    </div>,
    document.body,
  );
}
