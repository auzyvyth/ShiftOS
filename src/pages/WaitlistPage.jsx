import React, { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet";
import { useSearchParams } from "react-router-dom";
import { nanoid } from "nanoid";
import { supabase } from "../supabaseClient";

/* ─── tiny helpers ─────────────────────────────────────────────────── */
const fmt = (n) => n?.toLocaleString("en-MY") ?? "—";
const BASE = "https://xdrive.my";

/* ─── static pain-point copy ───────────────────────────────────────── */
const PAINS = [
  {
    emoji: "💸",
    platform: "Mudah / Carlist / Facebook",
    pain: "Pay RM 30–200 per listing just to stay visible. Listings expire. You re-post. You pay again. Every. Month.",
    gain: "ShiftOS Lite is 100% free — list as many cars as you want, forever.",
  },
  {
    emoji: "📵",
    platform: "WhatsApp chaos",
    pain: "Leads come in from 5 different places. No tracking. You forget to follow up. The buyer buys from someone else.",
    gain: "Every enquiry auto-converts to a tracked lead. Set reminders. Never ghost a buyer again.",
  },
  {
    emoji: "🔗",
    platform: "No personal brand",
    pain: "You spend years building a name but you have no storefront. No profile. No link to share. Buyers can't find you.",
    gain: "Your own xdrive.my/s/yourname profile — share it on TikTok, IG, WhatsApp. Buyers see ALL your cars in one place.",
  },
  {
    emoji: "📊",
    platform: "Flying blind",
    pain: "You have no idea which cars get the most views, which leads are hot, or why deals fall through.",
    gain: "Analytics on every listing. CVR, views, WA taps, pipeline stage — know exactly what to push.",
  },
  {
    emoji: "🤝",
    platform: "Lone ranger",
    pain: "Dealer wants you to use their system. You want your own. There's no middle ground.",
    gain: "Start free as a solo agent. One invite code and you merge under a dealer — keeping your track record.",
  },
];

const FEATURES = [
  { icon: "🚗", title: "Free listings on xdrive.my", sub: "Unlimited. No expiry. No credit needed." },
  { icon: "🔗", title: "Your own profile page", sub: "xdrive.my/s/yourname — shareable anywhere." },
  { icon: "📋", title: "Lead & enquiry tracking", sub: "Pipeline board, follow-up reminders, close rate stats." },
];

const SOCIAL_PROOF = [
  { stat: "100%", label: "Free forever for solo agents" },
  { stat: "< 2min", label: "To publish your first listing" },
  { stat: "0", label: "Listing fees. Ever." },
];

export default function WaitlistPage() {
  const [params] = useSearchParams();
  const refCode = params.get("ref") || null;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { position, referral_code, isExisting }

  const confirmRef = useRef(null);

  /* copy ref link */
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    if (!result) return;
    navigator.clipboard.writeText(`${BASE}/waitlist?ref=${result.referral_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* scroll to confirm on result */
  useEffect(() => {
    if (result && confirmRef.current) {
      confirmRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const trimPhone = phone.replace(/\s+/g, "").replace(/^0/, "60");
    if (!name.trim() || !trimPhone) { setError("Please fill in all fields."); return; }

    setLoading(true);
    try {
      // Check duplicate
      const { data: existing } = await supabase
        .from("waitlist_signups")
        .select("position, referral_code")
        .eq("phone", trimPhone)
        .maybeSingle();

      if (existing) {
        setResult({ position: existing.position, referral_code: existing.referral_code, isExisting: true });
        setLoading(false);
        return;
      }

      const code = nanoid(8);
      const payload = {
        name: name.trim(),
        phone: trimPhone,
        referral_code: code,
        referred_by: refCode || null,
        founding_member: false,
      };

      const { data: inserted, error: insertErr } = await supabase
        .from("waitlist_signups")
        .insert(payload)
        .select("position, referral_code")
        .single();

      if (insertErr) throw insertErr;

      // If referred_by exists, check if this is their first referral → grant founding_member
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
            await supabase
              .from("waitlist_signups")
              .update({ founding_member: true })
              .eq("id", referrer.id);
          }
        }
      }

      setResult({ position: inserted.position, referral_code: inserted.referral_code, isExisting: false });
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ── styles ── */
  const s = {
    page: {
      minHeight: "100dvh",
      background: "#070711",
      color: "#f1f5f9",
      fontFamily: "'DM Sans', sans-serif",
      overflowX: "hidden",
    },
    container: { maxWidth: 680, margin: "0 auto", padding: "0 20px" },
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 8,
      backdropFilter: "blur(12px)",
    },
  };

  return (
    <div style={s.page}>
      <Helmet>
        <title>Join the Waitlist — ShiftOS for Malaysian Car Sellers</title>
        <meta name="description" content="Free listings, your own profile, lead tracking. Built for Malaysian car salespeople. Join now." />
      </Helmet>

      {/* ── NAV ── */}
      <nav style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 26, height: 26, background: "#dc2626", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontFamily: "'Bebas Neue', sans-serif", fontWeight: 700, color: "#fff" }}>S</div>
        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, letterSpacing: "2px", color: "#fff" }}>SHIFTOS</span>
        <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px", borderRadius: 99, background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", color: "#f87171", fontWeight: 700, letterSpacing: "0.05em" }}>EARLY ACCESS</span>
      </nav>

      {/* ── HERO ── */}
      <section style={{ ...s.container, paddingTop: 64, paddingBottom: 48, textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 20, padding: "5px 14px", borderRadius: 99, background: "rgba(220,38,38,0.1)", border: "1px solid rgba(220,38,38,0.25)" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 12, color: "#f87171", fontWeight: 600 }}>Waitlist now open — limited early spots</span>
        </div>

        <h1 style={{ margin: "0 0 14px", fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(42px,9vw,76px)", lineHeight: 1, letterSpacing: "1px", color: "#fff" }}>
          Built for Malaysian<br />Car Salespeople
        </h1>
        <p style={{ margin: "0 0 10px", fontSize: "clamp(16px,3.5vw,20px)", fontWeight: 600, color: "#f1f5f9" }}>
          Free. Powerful. <span style={{ color: "#dc2626" }}>Yours.</span>
        </p>
        <p style={{ margin: "0 0 40px", fontSize: 14, color: "#64748b", maxWidth: 480, marginLeft: "auto", marginRight: "auto", lineHeight: 1.7 }}>
          Stop paying listing fees. Stop losing leads in your DMs. Stop flying blind. ShiftOS gives solo salespeople the same tools big dealerships have — for free.
        </p>

        {/* Social proof strip */}
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginBottom: 48 }}>
          {SOCIAL_PROOF.map(({ stat, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <p style={{ margin: 0, fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: "#dc2626", letterSpacing: "1px" }}>{stat}</p>
              <p style={{ margin: 0, fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Feature pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 420, margin: "0 auto 48px" }}>
          {FEATURES.map(({ icon, title, sub }) => (
            <div key={title} style={{ ...s.card, display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", textAlign: "left" }}>
              <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>{title}</p>
                <p style={{ margin: 0, fontSize: 12, color: "#64748b" }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── FORM ── */}
        {!result && (
          <div style={{ ...s.card, padding: "28px 24px", maxWidth: 420, margin: "0 auto", textAlign: "left" }}>
            <p style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700, color: "#f1f5f9" }}>Claim your free spot</p>
            <p style={{ margin: "0 0 20px", fontSize: 12, color: "#475569" }}>No credit card. No commitment. Just early access.</p>
            {refCode && (
              <div style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#4ade80" }}>🎉 Referred by a friend — you're on the fast lane.</p>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Full Name</label>
                <input
                  type="text"
                  placeholder="Ahmad Razif"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, fontFamily: "inherit", outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>WhatsApp Number</label>
                <input
                  type="tel"
                  placeholder="0123456789"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, fontFamily: "inherit", outline: "none" }}
                />
              </div>
              {error && <p style={{ margin: "0 0 14px", fontSize: 12, color: "#f87171" }}>{error}</p>}
              <button
                type="submit"
                disabled={loading}
                style={{ width: "100%", padding: "13px", borderRadius: 6, background: loading ? "rgba(220,38,38,0.5)" : "#dc2626", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", letterSpacing: "0.02em", transition: "background 0.15s" }}
              >
                {loading ? "Securing your spot…" : "Join the Waitlist →"}
              </button>
              <p style={{ margin: "10px 0 0", fontSize: 11, color: "#334155", textAlign: "center" }}>No spam. You'll be notified when we launch.</p>
            </form>
          </div>
        )}
      </section>

      {/* ── CONFIRMATION ── */}
      {result && (
        <section ref={confirmRef} style={{ ...s.container, paddingBottom: 64 }}>
          <div style={{ ...s.card, padding: "32px 24px", maxWidth: 480, margin: "0 auto", textAlign: "center", border: "1px solid rgba(34,197,94,0.25)", background: "rgba(34,197,94,0.04)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 26 }}>
              {result.isExisting ? "👋" : "🎉"}
            </div>
            <p style={{ margin: "0 0 4px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: "0.15em", color: "#4ade80" }}>
              {result.isExisting ? "ALREADY ON THE LIST" : "YOU'RE IN"}
            </p>
            <p style={{ margin: "0 0 6px", fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, color: "#fff", lineHeight: 1 }}>
              #{fmt(result.position)}
            </p>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#94a3b8" }}>
              {result.isExisting
                ? "You're already on the waitlist. Here's your referral link — share it to move up."
                : "on the waitlist. Share your referral link and move up the queue."}
            </p>

            {/* Referral link box */}
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 6, padding: "12px 16px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                xdrive.my/waitlist?ref={result.referral_code}
              </p>
              <button
                onClick={copyLink}
                style={{ flexShrink: 0, fontSize: 11, padding: "5px 12px", borderRadius: 5, background: copied ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)", border: copied ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.12)", color: copied ? "#4ade80" : "#f1f5f9", cursor: "pointer", fontWeight: 700, fontFamily: "inherit", transition: "all 0.15s" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* WA share */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Eh, ada platform baru untuk jual kereta — free listing, profile sendiri, track leads semua ada. Join waitlist: ${BASE}/waitlist?ref=${result.referral_code}`)}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", boxSizing: "border-box", padding: "12px", borderRadius: 6, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", color: "#4ade80", fontSize: 14, fontWeight: 700, textDecoration: "none", marginBottom: 16 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Share on WhatsApp
            </a>

            <div style={{ padding: "12px 16px", borderRadius: 6, background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.15)" }}>
              <p style={{ margin: 0, fontSize: 12, color: "#f87171" }}>
                🏅 Refer <strong>1 friend</strong> and unlock <strong>Founding Member</strong> status — first access, lifetime perks.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ── PAIN vs GAIN ── */}
      <section style={{ background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "64px 20px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.12em", textAlign: "center" }}>The daily grind nobody talks about</p>
          <h2 style={{ margin: "0 0 10px", fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(32px,6vw,52px)", lineHeight: 1.05, textAlign: "center", color: "#fff" }}>
            What's costing you sales right now
          </h2>
          <p style={{ margin: "0 0 48px", fontSize: 14, color: "#475569", textAlign: "center", lineHeight: 1.7 }}>
            Every day you use the old way, you're leaving money on the table. Here's the math.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {PAINS.map(({ emoji, platform, pain, gain }) => (
              <div key={platform} style={{ ...s.card, overflow: "hidden" }}>
                {/* Platform header */}
                <div style={{ padding: "12px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{platform}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                  {/* Pain */}
                  <div style={{ padding: "16px 18px", borderRight: "1px solid rgba(255,255,255,0.06)", background: "rgba(239,68,68,0.03)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em" }}>❌ The old way</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#94a3b8", lineHeight: 1.6 }}>{pain}</p>
                  </div>
                  {/* Gain */}
                  <div style={{ padding: "16px 18px", background: "rgba(34,197,94,0.03)" }}>
                    <p style={{ margin: "0 0 8px", fontSize: 10, fontWeight: 700, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.1em" }}>✅ With ShiftOS</p>
                    <p style={{ margin: 0, fontSize: 13, color: "#f1f5f9", lineHeight: 1.6 }}>{gain}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      {!result && (
        <section style={{ ...s.container, paddingTop: 64, paddingBottom: 80, textAlign: "center" }}>
          <h2 style={{ margin: "0 0 12px", fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(32px,6vw,52px)", color: "#fff" }}>
            Stop paying to be ignored.<br />
            <span style={{ color: "#dc2626" }}>Start selling smarter.</span>
          </h2>
          <p style={{ margin: "0 0 32px", fontSize: 14, color: "#475569", lineHeight: 1.7, maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}>
            Join Malaysian car salespeople who are done with listing fees, ghost leads, and zero visibility. ShiftOS is built for you — and it's free.
          </p>
          <div style={{ ...s.card, padding: "28px 24px", maxWidth: 420, margin: "0 auto", textAlign: "left" }}>
            <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#f1f5f9", textAlign: "center" }}>Join the Waitlist</p>
            {refCode && (
              <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)" }}>
                <p style={{ margin: 0, fontSize: 12, color: "#4ade80" }}>🎉 Referred by a friend — you're on the fast lane.</p>
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Full Name</label>
                <input
                  type="text" placeholder="Ahmad Razif" value={name} onChange={e => setName(e.target.value)} required
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, fontFamily: "inherit", outline: "none" }}
                />
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>WhatsApp Number</label>
                <input
                  type="tel" placeholder="0123456789" value={phone} onChange={e => setPhone(e.target.value)} required
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "11px 14px", color: "#f1f5f9", fontSize: 14, fontFamily: "inherit", outline: "none" }}
                />
              </div>
              {error && <p style={{ margin: "0 0 12px", fontSize: 12, color: "#f87171" }}>{error}</p>}
              <button
                type="submit" disabled={loading}
                style={{ width: "100%", padding: "13px", borderRadius: 6, background: loading ? "rgba(220,38,38,0.5)" : "#dc2626", border: "none", color: "#fff", fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}
              >
                {loading ? "Securing your spot…" : "Join the Waitlist →"}
              </button>
            </form>
          </div>
        </section>
      )}

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "24px 20px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12, color: "#334155" }}>
          © {new Date().getFullYear()} ShiftOS · xdrive.my · Built for Malaysian car salespeople
        </p>
      </footer>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        input::placeholder { color: #334155; }
        input:focus { border-color: rgba(220,38,38,0.5) !important; }
      `}</style>
    </div>
  );
}
