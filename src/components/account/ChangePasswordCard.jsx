import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "../../supabaseClient";
import { premiumDark as PD } from "../../theme/tokens";

// Change password, for Salesman Lite and Premium settings (dark panel). Neither
// had one: a seller whose page was set up for them (console > Create seller)
// could only get a password of their own through the emailed setup link or
// "Forgot password". Same strength rule as ResetPasswordPage / SalesmanSetup.
//
// On success every OTHER session is signed out, so whoever knew the old
// password (a phone left logged in, or the person who set the page up) is out.
// theme="premium" (Salesman Premium, premiumDark): no outline and no "Password"
// heading, since the Settings section it sits in is already called that.
const STRONG_PW = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function ChangePasswordCard({ style, theme }) {
  const prem = theme === "premium";
  const { t } = useTranslation();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const tr = (k, fallback) => t(`changePassword.${k}`, { defaultValue: fallback });

  const save = async () => {
    if (!STRONG_PW.test(pw)) { setError(tr("weak", "At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.")); return; }
    if (pw !== confirm) { setError(tr("mismatch", "The two passwords don't match.")); return; }
    setError("");
    setSaving(true);
    const { error: err } = await supabase.auth.updateUser({ password: pw });
    if (err) {
      setSaving(false);
      setError(/same/i.test(err.message) ? tr("same", "That is already your password.") : err.message);
      return;
    }
    // Best effort: the password is already changed if this fails.
    await supabase.auth.signOut({ scope: "others" }).catch(() => {});
    setSaving(false);
    setPw("");
    setConfirm("");
    toast.success(tr("done", "Password changed. Other devices have been signed out."));
  };

  const input = {
    width: "100%", background: prem ? PD.raised : "rgba(255,255,255,0.04)", border: prem ? `1px solid ${PD.line}` : "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: prem ? PD.text : "#e5e7eb", fontSize: 16, padding: "10px 12px", outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  return (
    <div style={prem
      ? { padding: 18, background: PD.card, borderRadius: PD.radius.card, ...style }
      : { padding: 16, background: "#0d1117", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, ...style }}>
      {!prem && (
        <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {tr("title", "Password")}
        </p>
      )}
      <p style={{ margin: "0 0 12px", fontSize: 12, color: prem ? PD.textSec : "#6b7280", lineHeight: 1.5 }}>
        {tr("hint", "Set a new password. Every other device signed in to this account will be signed out.")}
      </p>
      <form onSubmit={(e) => { e.preventDefault(); save(); }} style={{ display: "grid", gap: 8 }}>
        {/* Hidden username field so password managers file the new password under the right account. */}
        <input type="text" name="username" autoComplete="username" hidden readOnly />
        <input type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder={tr("new", "New password")} style={input} />
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder={tr("confirm", "Type it again")} style={input} />
        {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: prem ? PD.accentText : "#f87171", lineHeight: 1.5 }}>{error}</p>}
        <button type="submit" disabled={saving || !pw || !confirm}
          style={{ justifySelf: "start", padding: "10px 16px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: saving ? "wait" : "pointer", opacity: saving || !pw || !confirm ? 0.6 : 1 }}>
          {saving ? tr("saving", "Saving...") : tr("save", "Change password")}
        </button>
      </form>
    </div>
  );
}
