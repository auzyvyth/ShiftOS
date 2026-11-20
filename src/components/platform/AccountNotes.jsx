import React, { useState } from "react";
import { platformClient as supabase } from "../../lib/platformClient";

// NOTES-1: the owner's private notes on one account (migration 20261120b).
// Own table, superadmin only: a seller can read their own profiles row, so a
// note must never live there. Saved with an explicit button, and the row is
// read back so a refused write (0 rows, no error) is never shown as "Saved".

export const NOTE_TAGS = ["Founding payer", "Promised something", "Needs help", "Call back", "VIP"];
const MAX_TAGS = 8;
const MAX_NOTE = 2000;

const cleanTag = (t) => String(t || "").trim().replace(/\s+/g, " ").slice(0, 30);
const sameTags = (a, b) => a.length === b.length && a.every((t, i) => t === b[i]);

export default function AccountNotes({ userId, row, onSaved }) {
  const [note, setNote] = useState(row?.note || "");
  const [tags, setTags] = useState(row?.tags || []);
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const dirty = note !== (row?.note || "") || !sameTags(tags, row?.tags || []);

  const toggle = (t) => {
    setMsg(null);
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : cur.length < MAX_TAGS ? [...cur, t] : cur));
  };
  const addCustom = () => {
    const t = cleanTag(custom);
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase())) toggle(t);
    setCustom("");
  };

  async function save() {
    setBusy(true); setMsg(null);
    try {
      if (!note.trim() && tags.length === 0) {
        const { error } = await supabase.from("platform_account_notes").delete().eq("user_id", userId);
        if (error) throw error;
        onSaved(userId, null);
      } else {
        const { data, error } = await supabase.from("platform_account_notes")
          .upsert({ user_id: userId, note: note.trim(), tags, updated_at: new Date().toISOString() })
          .select("user_id, note, tags, updated_at").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("the database refused the save");
        onSaved(userId, data);
      }
      setMsg({ ok: true, text: "Saved" });
    } catch (e) {
      setMsg({ ok: false, text: `Not saved: ${e.message || "something went wrong"}` });
    }
    setBusy(false);
  }

  const chip = (on) => ({
    fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit",
    background: on ? "#e5e7eb" : "rgba(255,255,255,0.04)", color: on ? "#0b0f16" : "#9ca3af",
    border: `1px solid ${on ? "#e5e7eb" : "rgba(255,255,255,0.1)"}`,
  });
  const extra = tags.filter((t) => !NOTE_TAGS.includes(t));

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {[...NOTE_TAGS, ...extra].map((t) => (
          <button key={t} type="button" onClick={() => toggle(t)} aria-pressed={tags.includes(t)} style={chip(tags.includes(t))}>{t}</button>
        ))}
        <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={30} placeholder="+ own tag"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} onBlur={addCustom}
          aria-label="Add your own tag"
          style={{ width: 90, fontSize: 11.5, padding: "4px 10px", borderRadius: 99, background: "transparent", color: "#e5e7eb", border: "1px dashed rgba(255,255,255,0.15)", fontFamily: "inherit" }} />
      </div>
      <textarea value={note} onChange={(e) => { setNote(e.target.value); setMsg(null); }} maxLength={MAX_NOTE} rows={4}
        placeholder="What you promised, what they asked for, anything you would forget. Only you see this."
        aria-label="Private notes about this account"
        style={{ width: "100%", boxSizing: "border-box", resize: "vertical", background: "rgba(255,255,255,0.03)", color: "#e5e7eb", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "9px 11px", fontSize: 13, lineHeight: 1.5, fontFamily: "inherit" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
        <button type="button" disabled={!dirty || busy} onClick={save}
          style={{ background: dirty ? "#e5e7eb" : "rgba(255,255,255,0.04)", color: dirty ? "#0b0f16" : "#6b7280", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: !dirty || busy ? "default" : "pointer", fontFamily: "inherit" }}>
          {busy ? "Saving..." : "Save notes"}
        </button>
        {msg && <span role="status" style={{ fontSize: 11.5, color: msg.ok ? "#4ade80" : "#f87171" }}>{msg.text}</span>}
        {!msg && row?.updated_at && <span style={{ fontSize: 11, color: "#4b5563" }}>Last edited {new Date(row.updated_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}</span>}
      </div>
    </div>
  );
}
