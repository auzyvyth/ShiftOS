import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { nanoid } from "nanoid";
import { supabase } from "../supabaseClient";

const fmt = (n) => n?.toLocaleString("en-MY") ?? "—";
const BASE = "https://xdrive.my";

export default function WaitlistPage() {
  const [params] = useSearchParams();
  const refCode = params.get("ref") || null;

  const { t, i18n } = useTranslation();
  // Default to Malay
  const [lang, setLang] = useState("ms");

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang, i18n]);

  const toggleLang = () => setLang(l => l === "ms" ? "en" : "ms");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const confirmRef = useRef(null);

  const copyLink = () => {
    if (!result) return;
    navigator.clipboard.writeText(`${BASE}/waitlist?ref=${result.referral_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (result && confirmRef.current) {
      confirmRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const trimPhone = phone.replace(/\s+/g, "").replace(/^0/, "60");
    if (!name.trim() || !trimPhone) { setError(t("waitlist.errorFill")); return; }
    if (!consent) { setError(t("waitlist.errorConsent")); return; }

    setLoading(true);
    try {
      // Check duplicate by phone
      const { data: existing, error: selectErr } = await supabase
        .from("waitlist_signups")
        .select("position, referral_code")
        .eq("phone", trimPhone)
        .maybeSingle();

      if (selectErr) throw selectErr;

      if (existing) {
        setResult({ position: existing.position, referral_code: existing.referral_code, isExisting: true });
        setLoading(false);
        return;
      }

      const code = nanoid(8);
      const { data: inserted, error: insertErr } = await supabase
        .from("waitlist_signups")
        .insert({ name: name.trim(), phone: trimPhone, referral_code: code, referred_by: refCode || null, founding_member: false })
        .select("position, referral_code")
        .single();

      if (insertErr) throw insertErr;

      // Grant founding member to referrer on first successful referral
      if (refCode) {
        const { data: referrer } = await supabase
          .from("waitlist_signups")
          .select("id, founding_member")
          .eq("referral_code", refCode)
          .maybeSingle();

        if (referrer && !referrer.founding_member) {
          const { count } = await supabase
            .from("waitlist_signups")
            .select("id", { count: "exact", head: true })
            .eq("referred_by", refCode);
          if (count >= 1) {
            await supabase.from("waitlist_signups").update({ founding_member: true }).eq("id", referrer.id);
          }
        }
      }

      setResult({ position: inserted.position, referral_code: inserted.referral_code, isExisting: false });
    } catch (err) {
      console.error("Waitlist error:", err);
      // Surface the real error so it's debuggable
      const msg = err?.message || err?.details || JSON.stringify(err);
      setError(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const s = {
    page: { minHeight: "100dvh", background: "#070711", color: "#f1f5f9", fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" },
    container: { maxWidth: 680, margin: "0 auto", padding: "0 20px" },
    card: { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 8, backdropFilter: "blur(12px)" },
  };

  const PAINS = [
    { emoji: "💸", platformKey: "pain1Platform", painKey: "pain1", gainKey: "gain1" },
    { emoji: "📵", platformKey: "pain2Platform", painKey: "pain2", gainKey: "gain2" },
    { emoji: "🔗", platformKey: "pain3Platform", painKey: "pain3", gainKey: "gain3" },
    { emoji: "📊", platformKey: "pain4Platform", painKey: "pain4", gainKey: "gain4" },
    { emoji: "🤝", platformKey: "pain5Platform", painKey: "pain5", gainKey: "gain5" },
  ];

  const FEATURES = [
    { icon: "🚗", titleKey: "feat1Title", subKey: "feat1Sub" },
    { icon: "🔗", titleKey: "feat2Title", subKey: "feat2Sub" },
    { icon: "📋", titleKey: "feat3Title", subKey: "feat3Sub" },
  ];

  const SOCIAL_PROOF = [
    { statKey: "proof1Stat", labelKey: "proof1Label" },
    { statKey: "proof2Stat", labelKey: "proof2Label" },
    { statKey: "proof3Stat", labelKey: "proof3Label" },
  ];

  const consentBlock = (
    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 18, cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={consent}
        onChange={e => setConsent(e.target.checked)}
        style={{ marginTop: 2, flexShrink: 0, accentColor: "#dc2626", width: 15, height: 15, cursor: "pointer" }}
      />
      <span style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{t("waitlist.consentLabel")}</span>
    </label>
  );

  const formFields = (marginBottomPhone = 20) => (
    <>
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{t("waitlist.labelName")}</label>
        <input
          type="text"
          placeholder={t("waitlist.placeholderName")}
          value={name}
          onChange={e => setName(e.target.value)}
          required
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, fontFamily: "inherit", outline: "none" }}
        />
      </div>
      <div style={{ marginBottom: marginBottomPhone }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>{t("waitlist.labelPhone")}</label>
        <input
          type="tel"
          placeholder={t("waitlist.placeholderPhone")}
          value={phone}
          onChange={e => setPhone(e.target.value)}
          required
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, fontFamily: "inherit", outline: "none" }}
        />
      </div>
      {consentBlock}
    </>
  );

  return (
    <div style={s.page}>
      <Helmet>
        <title>Join the Waitlist — ShiftOS for Malaysian Car Sellers</title>
        <meta name="description" content="Free listings, your own profile, lead tracking. Built for Malaysian car salespeople. Join now." />
      </Helmet>

      {/* NAV */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 26, height: 26, background: "#dc2626", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", fontWeight: 700, color: "#fff" }}>S</div>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "2px", color: "#fff" }}>SHIFTOS</span>
        <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", fontWeight: 700, letterSpacing: "0.05em" }}>EARLY ACCESS</span>
        <button
          onClick={toggleLang}
          style={{ marginLeft: "auto", fontSize: 12, padding: "5px 12px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
        >
          {t("waitlist.langToggle")}
        </button>
      </nav>

      {/* HERO */}
      <section style={{ ...s.container, paddingTop: 64, paddingBottom: 48, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 20, padding: "5px 14px", borderRadius: 99, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 12, color: "#f87171", fontWeight: 600 }}>{t("waitlist.badge")}</span>
        </div>

        <h1 style={{ margin: "0 0 14px", fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(42px,9vw,76px)", lineHeight: 1, letterSpacing: "1px", color: "#fff" }}>
          {t("waitlist.headline")}
        </h1>
        <p style={{ margin: "0 0 10px", fontSize: "clamp(16px,3.5vw,20px)", fontWeight: 600, color: "#f1f5f9" }}>
          {t("waitlist.subheadline").split(". ").map((part, i, arr) => (
            <span key={i}>{i === arr.length - 1 ? <span style={{ color: "#dc2626" }}>{part}.</span> : `${part}. `}</span>
          ))}
        </p>
        <p style={{ margin: "0 0 40px", fontSize: 14, color: "#64748b", maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
          {t("waitlist.heroBody")}
        </p>

        {/* Social proof strip */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginBottom: 48 }}>
          {SOCIAL_PROOF.map(({ statKey, labelKey }) => (
            <div key={labelKey} style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#dc2626", letterSpacing: "1px" }}>{t(`waitlist.${statKey}`)}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t(`waitlist.${labelKey}`)}</p>
            </div>
          ))}
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420, margin: "0 auto 48px" }}>
          {FEATURES.map(({ icon, titleKey, subKey }) => (
            <div key={titleKey} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", textAlign: "left" }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{t(`waitlist.${titleKey}`)}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{t(`waitlist.${subKey}`)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* HERO FORM */}
        {!result && (
          <div style={{ ...s.card, padding: "28px 24px", maxWidth: 420, margin: "0 auto", textAlign: "left" }}>
            <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>{t("waitlist.formTitle")}</p>
            <p style={{ margin: "0 0 20px", fontSize: 12, color: "#475569" }}>{t("waitlist.formSub")}</p>
            {refCode && (
              <div style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#4ade80" }}>🎉 {t("waitlist.refBadge")}</p>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              {formFields(20)}
              {error && <p style={{ margin: "0 0 14px", fontSize: 12, color: "#f87171" }}>{error}</p>}
              <button
                type="submit"
                disabled={!consent || loading}
                style={{ width: "100%", padding: "13px", borderRadius: 6, background: (!consent || loading) ? "rgba(220,38,38,0.35)" : "#dc2626", border: "none", color: !consent ? "rgba(255,255,255,0.4)" : "#fff", fontSize: 15, fontWeight: 700, cursor: (!consent || loading) ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: "0.02em", transition: "all 0.15s" }}
              >
                {loading ? t("waitlist.ctaLoading") : t("waitlist.cta")}
              </button>
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "#334155", textAlign: "center" }}>{t("waitlist.noSpam")}</p>
            </form>
          </div>
        )}
      </section>

      {/* CONFIRMATION */}
      {result && (
        <section ref={confirmRef} style={{ ...s.container, paddingBottom: 64 }}>
          <div style={{ ...s.card, padding: "32px 24px", maxWidth: 480, margin: "0 auto", textAlign: "center", border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.04)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26 }}>
              {result.isExisting ? "👋" : "🎉"}
            </div>
            <p style={{ margin: "0 0 4px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: "0.15em", color: "#4ade80" }}>
              {result.isExisting ? t("waitlist.confirmAlreadyTag") : t("waitlist.confirmTag")}
            </p>
            <p style={{ margin: "0 0 6px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: "#fff", lineHeight: 1 }}>
              #{fmt(result.position)}
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#94a3b8" }}>
              {result.isExisting ? t("waitlist.confirmAlreadyBody") : t("waitlist.confirmBody")}
            </p>

            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                xdrive.my/waitlist?ref={result.referral_code}
              </p>
              <button
                onClick={copyLink}
                style={{ flexShrink: 0, fontSize: 11, padding: "5px 12px", borderRadius: 5, background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)", border: copied ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.12)", color: copied ? "#4ade80" : "#f1f5f9", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s" }}
              >
                {copied ? t("waitlist.copiedBtn") : t("waitlist.copyBtn")}
              </button>
            </div>

            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${t("waitlist.waShareMsg")} ${BASE}/waitlist?ref=${result.referral_code}`)}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: 6, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", color: "#4ade80", fontSize: 14, fontWeight: 700, textDecoration: "none", marginBottom: 16 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              {t("waitlist.waShareBtn")}
            </a>

            <div style={{ padding: "12px 16px", borderRadius: 6, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.15)" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>
                🏅 {t("waitlist.foundingNudge")}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* PAIN vs GAIN */}
      <section style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "64px 20px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center" }}>{t("waitlist.painSectionEyebrow")}</p>
          <h2 style={{ margin: "0 0 10px", fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(32px,6vw,52px)", lineHeight: 1.05, textAlign: "center", color: "#fff" }}>
            {t("waitlist.painSectionHeadline")}
          </h2>
          <p style={{ margin: "0 0 48px", fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 1.7 }}>
            {t("waitlist.painSectionBody")}
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {PAINS.map(({ emoji, platformKey, painKey, gainKey }) => (
              <div key={platformKey} style={{ ...s.card, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{t(`waitlist.${platformKey}`)}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  <div style={{ padding: "16px 18px", borderRight: "1px solid rgba(255,255,255,0.06)", background: "rgba(239,68,68,0.03)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("waitlist.oldWay")}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{t(`waitlist.${painKey}`)}</p>
                  </div>
                  <div style={{ padding: "16px 18px", background: "rgba(34,197,94,0.03)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.1em" }}>{t("waitlist.newWay")}</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#f1f5f9", lineHeight: 1.6 }}>{t(`waitlist.${gainKey}`)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      {!result && (
        <section style={{ ...s.container, paddingTop: 64, paddingBottom: 80, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 12px", fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(32px,6vw,52px)", color: "#fff" }}>
            {t("waitlist.ctaBottomHeadline1")}<br />
            <span style={{ color: "#dc2626" }}>{t("waitlist.ctaBottomHeadline2")}</span>
          </h2>
          <p style={{ margin: "0 0 32px", fontSize: 14, color: "#475569", lineHeight: 1.7, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
            {t("waitlist.ctaBottomBody")}
          </p>
          <div style={{ ...s.card, padding: "28px 24px", maxWidth: 420, margin: "0 auto", textAlign: "left" }}>
            <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", textAlign: "center" }}>{t("waitlist.ctaBottomFormTitle")}</p>
            {refCode && (
              <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#4ade80" }}>🎉 {t("waitlist.refBadge")}</p>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              {formFields(18)}
              {error && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#f87171" }}>{error}</p>}
              <button
                type="submit"
                disabled={!consent || loading}
                style={{ width: "100%", padding: "13px", borderRadius: 6, background: (!consent || loading) ? "rgba(220,38,38,0.35)" : "#dc2626", border: "none", color: !consent ? "rgba(255,255,255,0.4)" : "#fff", fontSize: 15, fontWeight: 700, cursor: (!consent || loading) ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              >
                {loading ? t("waitlist.ctaLoading") : t("waitlist.cta")}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px 20px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12, color: "#334155" }}>
          {t("waitlist.footerText", { year: new Date().getFullYear() })}
        </p>
      </footer>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        input::placeholder { color: #334155; }
        input:focus { border-color: rgba(220,38,38,0.5) !important; }
      `}</style>
    </div>
  );
}
