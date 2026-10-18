import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { platformClient as supabase } from "../../lib/platformClient";
import { MY_STATES, cityOptionsFor } from "../../utils/locations";
import { PLAN_CONFIG } from "../../utils/planConfig";
import { useModalHistory } from '../../hooks/useModalHistory';

// "I'll set your page up for you" (outreach playbook, 2026-10-12). The owner
// collects a seller's name, email and cars over chat, makes the account here,
// signs in as them to add the cars, then sends the setup email. The seller
// sets their own password and IC on /salesman-setup (which signs every other
// session out). The ID check only earns the Verified badge; cars go live
// without it (20261017b removed the 20261011b gate).
//
// Always the seller's OWN email: the account, its leads and its buyers' chats
// belong to whoever owns the address. Lite or Premium (owner, 2026-10-18).
// Premium here is the one free month, granted by create-salesman the same way
// start_premium_trial() does: it starts when the account is made, and no
// payment is asked for. Before this the owner signed in as the seller and
// started the free month from Lite settings by hand.

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 20);
}

// Same storage form as SalesmanOnboarding (+60...).
function normalizePhone(raw) {
  const d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("60")) return "+" + d;
  if (d.startsWith("0")) return "+6" + d;
  return "+60" + d;
}

const ERRORS = {
  email_taken: "That email already has an account. Find it in Accounts instead.",
  invalid_input: "Name and email are required.",
  forbidden: "Only a platform admin can do this.",
  profile_creation_failed: "The account could not be saved. Check that the page link is free and try again.",
};

export default function CreateSellerModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", slug: "", state: "", city: "", dealership: "", plan: "salesman_lite" });
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugFree, setSlugFree] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useModalHistory(true, onClose, { isDirty: () => Object.entries(form).some(([k, v]) => k !== "plan" && String(v || "").trim()) });
  const [created, setCreated] = useState(null);
  const [mailState, setMailState] = useState(null); // null | sending | sent | failed

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => {
    if (!slugEdited) set("slug", slugify(form.dealership || form.full_name));
  }, [form.full_name, form.dealership, slugEdited]);

  // is_slug_available is SECURITY DEFINER; a plain select can't see other sellers' rows.
  useEffect(() => {
    if (form.slug.length < 3) { setSlugFree(null); return undefined; }
    let alive = true;
    const t = setTimeout(async () => {
      const { data, error: e } = await supabase.rpc("is_slug_available", { p_slug: form.slug });
      if (alive) setSlugFree(e ? null : data !== false);
    }, 350);
    return () => { alive = false; clearTimeout(t); };
  }, [form.slug]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());
  const canSubmit = form.full_name.trim().length >= 2 && emailOk && form.slug.length >= 3 && slugFree !== false && !busy;

  const submit = async () => {
    setBusy(true); setError("");
    const { data, error: e } = await supabase.functions.invoke("create-salesman", {
      body: {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: normalizePhone(form.phone),
        slug: form.slug,
        state: form.state || null,
        city: form.city || null,
        dealership: form.dealership.trim() || null,
        plan: form.plan,
        dealer_id: null,
        send_email: false,
      },
    });
    setBusy(false);
    // functions.invoke puts a non-2xx body on error.context; read the code out of it.
    let code = data?.error;
    if (e && !code) {
      try { code = (await e.context?.json())?.error; } catch { /* keep generic */ }
      code = code || e.message;
    }
    if (code || !data?.user_id) { setError(ERRORS[code] || `Could not create the account: ${code || "no reply"}`); return; }
    setCreated({ ...data, email: form.email.trim().toLowerCase(), slug: form.slug, plan: form.plan });
    onCreated?.(data.profile);
  };

  const sendSetupEmail = async () => {
    setMailState("sending");
    const { data, error: e } = await supabase.functions.invoke("create-salesman", {
      body: { action: "resend_setup", email: created.email, link: "set_password" },
    });
    setMailState(!e && data?.email_sent ? "sent" : "failed");
  };

  const input = {
    width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8, color: "#e5e7eb", fontSize: 16, padding: "10px 12px", outline: "none", fontFamily: "inherit",
  };
  const label = { display: "block", fontSize: 11, color: "#6b7280", margin: "0 0 5px" };
  const primary = (on) => ({
    padding: "11px 16px", borderRadius: 8, border: "none", background: "#dc2626", color: "#fff", fontSize: 13,
    fontWeight: 600, fontFamily: "inherit", cursor: on ? "pointer" : "not-allowed", opacity: on ? 1 : 0.5,
  });
  const ghost = { padding: "11px 16px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "#9ca3af", fontSize: 13, fontWeight: 600, fontFamily: "inherit", cursor: "pointer" };
  const step = { margin: 0, fontSize: 13, color: "#d1d5db", lineHeight: 1.6 };

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 950, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ width: "min(460px, 100%)", maxHeight: "calc(100dvh - 32px)", overflowY: "auto", background: "#0b0f16", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{created ? "Account created" : "Set up a seller's page"}</p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              {created
                ? `${created.plan === "salesman_full" ? "Premium, free month started." : "Lite."} Nothing has been emailed yet.`
                : "Under the seller's own email. Nothing is emailed until you press Send setup email."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "#6b7280", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 0 }}>×</button>
        </div>

        {!created ? (
          <form onSubmit={(e) => { e.preventDefault(); if (canSubmit) submit(); }} style={{ display: "grid", gap: 12 }}>
            <div><label style={label}>Plan</label>
              <div role="radiogroup" aria-label="Plan" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { key: "salesman_lite", name: "Lite", note: "Free" },
                  { key: "salesman_full", name: "Premium", note: `Free month, then RM${PLAN_CONFIG.salesman_full.price}` },
                ].map((p) => {
                  const on = form.plan === p.key;
                  return (
                    <button key={p.key} type="button" role="radio" aria-checked={on} onClick={() => set("plan", p.key)}
                      style={{ textAlign: "left", padding: "9px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", minWidth: 0,
                        background: on ? "rgba(220,38,38,0.1)" : "rgba(255,255,255,0.04)",
                        border: `1px solid ${on ? "rgba(220,38,38,0.55)" : "rgba(255,255,255,0.1)"}` }}>
                      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: on ? "#f1f5f9" : "#d1d5db" }}>{p.name}</span>
                      <span style={{ display: "block", fontSize: 11, color: "#6b7280", marginTop: 2 }}>{p.note}</span>
                    </button>
                  );
                })}
              </div></div>
            <div><label style={label}>Full name</label>
              <input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} style={input} autoComplete="off" /></div>
            <div><label style={label}>Their email (not yours)</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} style={input} autoComplete="off" inputMode="email" /></div>
            <div><label style={label}>WhatsApp number</label>
              <input value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="012 345 6789" style={input} inputMode="tel" autoComplete="off" /></div>
            <div><label style={label}>Business name (optional)</label>
              <input value={form.dealership} onChange={(e) => set("dealership", e.target.value)} placeholder="e.g. Ali Auto" style={input} autoComplete="off" /></div>
            <div><label style={label}>Page link</label>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "#6b7280", flexShrink: 0 }}>xdrive.my/s/</span>
                <input value={form.slug} onChange={(e) => { setSlugEdited(true); set("slug", slugify(e.target.value)); }} style={{ ...input, minWidth: 0 }} autoComplete="off" />
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 11, color: slugFree === false ? "#f87171" : "#6b7280" }}>
                {form.slug.length < 3 ? "At least 3 letters or numbers." : slugFree === false ? "Taken. Pick another." : slugFree ? "Free. It is locked once they finish setup." : "Checking..."}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ minWidth: 0 }}><label style={label}>State</label>
                <select value={form.state} onChange={(e) => { set("state", e.target.value); set("city", ""); }} style={input}>
                  <option value="">Choose</option>
                  {MY_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div style={{ minWidth: 0 }}><label style={label}>City</label>
                <select value={form.city} onChange={(e) => set("city", e.target.value)} style={input} disabled={!form.state}>
                  <option value="">Choose</option>
                  {cityOptionsFor(form.state, form.city).map((c) => <option key={c} value={c}>{c}</option>)}
                </select></div>
            </div>
            {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>{error}</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" disabled={!canSubmit} style={primary(canSubmit)}>{busy ? "Creating..." : "Create account"}</button>
              <button type="button" onClick={onClose} style={ghost}>Cancel</button>
            </div>
          </form>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: "#6b7280" }}>Temporary password (shown once)</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <code style={{ flex: 1, minWidth: 0, fontSize: 16, color: "#f1f5f9", letterSpacing: "0.08em", overflowWrap: "anywhere" }}>{created.temp_password}</code>
                <button type="button" onClick={() => navigator.clipboard?.writeText(created.temp_password)} style={ghost}>Copy</button>
              </div>
            </div>
            <p style={step}>1. Open a private window and sign in at xdrive.my/login as <b style={{ color: "#f1f5f9" }}>{created.email}</b> with that password.</p>
            <p style={step}>2. Add their cars. They go live straight away; the Verified badge comes after the seller's ID is checked. Skip any tour or checklist you see: they all come back for the seller once they set their password.</p>
            <p style={step}>3. Sign out and close the private window.</p>
            <p style={step}>4. Send the setup email. They set their own password and IC, and every other session is signed out.</p>
            {mailState === "sent" && <p style={{ margin: 0, fontSize: 12, color: "#4ade80" }}>Setup email sent to {created.email}.</p>}
            {mailState === "failed" && <p role="alert" style={{ margin: 0, fontSize: 12, color: "#f87171" }}>The email did not send. Try again, or use Send setup email on their account later.</p>}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={sendSetupEmail} disabled={mailState === "sending" || mailState === "sent"}
                style={primary(mailState !== "sending" && mailState !== "sent")}>
                {mailState === "sending" ? "Sending..." : mailState === "sent" ? "Sent" : "Send setup email"}
              </button>
              <button type="button" onClick={onClose} style={ghost}>{mailState === "sent" ? "Done" : "Later"}</button>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>Later is fine: the account record has the same button until they finish setup.</p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
