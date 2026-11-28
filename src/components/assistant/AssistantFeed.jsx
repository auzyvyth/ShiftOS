import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check } from "lucide-react";
import { premiumDark as PD } from "../../theme/tokens";
import { useModalHistory } from "../../hooks/useModalHistory";
import { cdnImg } from "../../utils/img";
import { copyFor, carName } from "./assistantCopy";
import { mytDay } from "./assistantRules";

// The Assistant feed (ASSIST-1, owner 2026-11-28). Premium only, opened from the button beside the
// bell; the bell is untouched. Calm on purpose: ONE red key on screen (the first booking waiting for
// a yes), every other button a soft grey or plain text, grouped by importance (Needs you, Worth a
// look, Done) and not by time. Rules live in assistantRules.js; this file only draws and reports
// taps through onAction(card, key). Portalled with a scroll lock, and registered in history so the
// phone's Back closes it (overlay rules 1, 2 and 5).

const TZ = "Asia/Kuala_Lumpur";
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit", timeZone: TZ });
// Times stay "3:30 pm" in both languages; the day words follow the panel language.
const fmtWhen = (ts, now, c) => {
  const d = new Date(ts);
  const day = mytDay(d) === mytDay(now) ? c.today : d.toLocaleDateString(c.locale, { weekday: "long", timeZone: TZ });
  return `${day}, ${fmtTime(d)}`;
};
const fmtStamp = (ts, now, c) => {
  const d = new Date(ts);
  if (mytDay(d) === mytDay(now)) return fmtTime(d);
  return mytDay(d) === mytDay(new Date(now.getTime() - 86400000)) ? c.yesterday : d.toLocaleDateString(c.locale, { weekday: "short", timeZone: TZ });
};

const font = "var(--xd-font-body, 'Outfit', system-ui, sans-serif)";
const S = {
  card: { background: PD.card, borderRadius: 20, padding: "18px 18px 16px" },
  kind: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: PD.textMuted },
  line: { margin: "9px 0 0", fontSize: 16.5, lineHeight: 1.38, fontWeight: 500, color: PD.text, letterSpacing: "-0.005em" },
  sub: { margin: "4px 0 0", fontSize: 14, lineHeight: 1.45, color: PD.textSec },
  acts: { display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap" },
};
const btn = (tone) => ({
  height: 40, padding: tone === "ghost" ? "0 10px" : "0 16px", borderRadius: 12, border: 0, cursor: "pointer",
  font: `500 14px/1 ${font}`, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", justifyContent: "center",
  background: tone === "soft" ? PD.hover : "transparent", color: tone === "ghost" ? PD.textSec : PD.text,
});

function Section({ title, right, children }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", margin: "0 2px 10px" }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: PD.textSec }}>{title}</h3>
        {right != null && <span style={{ fontSize: 12.5, color: PD.textMuted }}>{right}</span>}
      </div>
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </section>
  );
}

export default function AssistantFeed({ cards, lang, isMobile, now = new Date(), onAction, onUndo, onClose }) {
  const c = copyFor(lang);
  const [moreFor, setMoreFor] = useState(null);
  useModalHistory(true, onClose);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  const { needs, moreNeeds, worth, done } = cards;
  const empty = !needs.length && !worth.length;
  // The one red key: the first card that needs a yes.
  const redId = needs.find((x) => x.kind === "booking")?.id || null;

  const renderNeeds = (x) => {
    if (x.kind === "booking") {
      const when = fmtWhen(x.when, now, c);
      return (
        <div key={x.id} style={S.card}>
          <div style={S.kind}><Dot />{c.kind.booking}</div>
          <p style={S.line}>{c.booking.line(x)}</p>
          <p style={S.sub}>{c.booking.sub(when)}</p>
          <div style={S.acts}>
            {x.id === redId
              ? <button className="lk-red" style={{ height: 40, padding: "0 18px", borderRadius: 12, font: `600 14px/1 ${font}` }} onClick={() => onAction(x, "confirm")}>{c.booking.confirm}</button>
              : <button style={btn("soft")} onClick={() => onAction(x, "confirm")}>{c.booking.confirm}</button>}
            <button style={btn("ghost")} onClick={() => onAction(x, "reschedule")}>{c.booking.reschedule}</button>
            {x.phone && <button style={btn("ghost")} onClick={() => onAction(x, "whatsapp")}>{c.booking.whatsapp}</button>}
          </div>
        </div>
      );
    }
    const k = x.kind; // enquiry | chat | question
    return (
      <div key={x.id} style={S.card}>
        <div style={S.kind}><Dot />{c.kind[k]}<span style={{ marginLeft: "auto" }}>{fmtStamp(x.when, now, c)}</span></div>
        <p style={S.line}>{x.notif.title || c.kind[k]}</p>
        <p style={S.sub}>{x.notif.body || c[k].sub}</p>
        <div style={S.acts}><button style={btn("soft")} onClick={() => onAction(x, "open")}>{c[k].open}</button></div>
      </div>
    );
  };

  const renderWorth = (x) => {
    if (x.kind === "silent") {
      const open = moreFor === x.id;
      return (
        <div key={x.id} style={S.card}>
          <div style={S.kind}>{c.kind.silent}</div>
          <p style={S.line}>{c.silent.line(x.car, x.step)}</p>
          <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center" }}>
            <Thumb src={Array.isArray(x.car.images) ? x.car.images.find(Boolean) : null} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: PD.text }}>{carName(x.car)}</div>
              <div style={{ fontSize: 13, color: PD.textMuted, marginTop: 2 }}>{c.silent.meta(x.car)}</div>
            </div>
          </div>
          {c.silent.plus(x.count) && <p style={{ ...S.sub, fontSize: 13, color: PD.textMuted }}>{c.silent.plus(x.count)}</p>}
          <div style={S.acts}>
            <button style={btn("soft")} onClick={() => onAction(x, "share")}>{c.silent.share}</button>
            <button style={btn("ghost")} onClick={() => onAction(x, "poster")}>{c.silent.poster}</button>
            <button aria-label={c.silent.more} aria-expanded={open} onClick={() => setMoreFor(open ? null : x.id)}
              style={{ ...btn("ghost"), marginLeft: "auto", color: PD.textMuted, letterSpacing: 2, fontSize: 18 }}>&middot;&middot;&middot;</button>
          </div>
          {open && (
            <div style={{ ...S.acts, marginTop: 8 }}>
              <button style={btn("soft")} onClick={() => { setMoreFor(null); onAction(x, "keep"); }}>{c.silent.keep}</button>
              <button style={btn("soft")} onClick={() => { setMoreFor(null); onAction(x, "snooze"); }}>{c.silent.snooze}</button>
            </div>
          )}
        </div>
      );
    }
    return (
      <div key={x.id} style={S.card}>
        <div style={S.kind}>{c.kind.brief}</div>
        <p style={S.line}>{c.brief.line}</p>
        <div style={{ marginTop: 10 }}>
          {x.rows.map((r, i) => (
            <div key={r.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "11px 0", borderTop: i ? `1px solid ${PD.line}` : 0, fontSize: 14.5, color: PD.textSec }}>
              {c.brief.rows[r.key]}
              <b style={{ fontSize: 16, fontWeight: 600, color: PD.text, fontVariantNumeric: "tabular-nums" }}>{r.n}</b>
            </div>
          ))}
        </div>
        <div style={S.acts}><button style={btn("soft")} onClick={() => onAction(x, "open")}>{c.brief.open}</button></div>
      </div>
    );
  };

  const doneText = (d) => (d.kind === "keep" ? c.done.keep(d.label) : d.kind === "snooze" ? c.done.snooze(d.label) : c.done.confirmed(d.label));
  const doneWord = (d) => doneText(d).split(". ")[0];
  const doneRest = (d) => doneText(d).split(". ").slice(1).join(". ");

  const body = (
    <div role="dialog" aria-modal="true" aria-label={c.title}
      style={isMobile
        ? { position: "fixed", inset: 0, zIndex: 1000, background: PD.canvas, overflowY: "auto", WebkitOverflowScrolling: "touch", fontFamily: font }
        : { position: "fixed", top: 0, right: 0, bottom: 0, width: 480, zIndex: 1000, background: PD.canvas, overflowY: "auto", fontFamily: font, boxShadow: "-24px 0 60px -30px rgba(0,0,0,0.8)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px 6px", position: "sticky", top: 0, background: PD.canvas, zIndex: 1 }}>
        <button aria-label={c.close} onClick={onClose} style={{ width: 40, height: 40, borderRadius: 12, border: 0, background: PD.card, color: PD.textSec, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <div style={{ fontSize: 19, fontWeight: 600, color: PD.text, letterSpacing: "-0.01em" }}>{c.title}</div>
          <div style={{ fontSize: 13, color: PD.textMuted, marginTop: 1 }}>{c.sub}</div>
        </div>
      </div>

      <div style={{ padding: "0 18px 40px" }}>
        {empty && (
          <div style={{ textAlign: "center", padding: "90px 24px 60px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: PD.card, margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", color: PD.up }}>
              <Check size={26} strokeWidth={2} />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: PD.text }}>{c.empty.title}</h3>
            <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.5, color: PD.textMuted }}>{c.empty.body}</p>
          </div>
        )}
        {needs.length > 0 && (
          <Section title={c.sec.needs} right={needs.length + moreNeeds}>
            {needs.map(renderNeeds)}
            {moreNeeds > 0 && <p style={{ margin: "0 2px", fontSize: 13, color: PD.textMuted }}>{c.more(moreNeeds)}</p>}
          </Section>
        )}
        {worth.length > 0 && <Section title={c.sec.worth} right={worth.length}>{worth.map(renderWorth)}</Section>}
        {done.length > 0 && (
          <Section title={c.sec.done} right={c.sec.doneSub}>
            <div style={{ ...S.card, padding: "6px 18px" }}>
              {done.map((d, i) => (
                <div key={d.id} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "13px 0", borderTop: i ? `1px solid ${PD.line}` : 0, fontSize: 14.5, color: PD.textSec }}>
                  <span style={{ color: PD.up, fontWeight: 600 }}>{doneWord(d)}</span>
                  <span style={{ minWidth: 0 }}>{doneRest(d)}</span>
                  {(d.kind === "keep" || d.kind === "snooze") && (
                    <button onClick={() => onUndo(d)} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: PD.textMuted, textDecoration: "underline", textUnderlineOffset: 2, font: `13px ${font}` }}>{c.done.undo}</button>
                  )}
                  <span style={{ marginLeft: "auto", color: PD.textMuted, fontSize: 12.5, flexShrink: 0 }}>{fmtStamp(d.at, now, c)}</span>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );

  return createPortal(
    isMobile ? body : (
      <>
        <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)" }} />
        {body}
      </>
    ),
    document.body,
  );
}

function Dot() {
  return <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: PD.accent, flexShrink: 0 }} />;
}

function Thumb({ src }) {
  return (
    <div style={{ width: 60, height: 46, borderRadius: 12, background: PD.raised, flexShrink: 0, overflow: "hidden" }}>
      {src && <img src={cdnImg(src, 120, 70)} alt="" width="60" height="46" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
    </div>
  );
}
