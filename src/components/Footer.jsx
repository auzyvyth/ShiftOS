import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useSiteProfile } from "../hooks/useSiteProfile";
import { supabase } from "../supabaseClient";

// Superadmin profile is the fallback for xdrive.my main domain
const SUPERADMIN_ID = "1e7bf24e-5b71-4c64-8d03-b60db5e59316";

const FOOTER_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');

  .ftr-root {
    font-family: 'Outfit', sans-serif;
    background: #09090B;
    border-top: 1px solid rgba(255,255,255,0.06);
  }
  .ftr-grid {
    max-width: 1280px; margin: 0 auto;
    padding: 64px 20px 48px;
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr 1fr;
    gap: 48px;
  }
  .ftr-col-head {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.18em;
    color: #C4A265; margin-bottom: 18px;
    display: flex; align-items: center; gap: 8px;
  }
  .ftr-col-head::after {
    content: ''; flex: 1; height: 1px;
    background: rgba(196,162,101,0.15);
  }
  .ftr-link {
    display: block; color: #52525A;
    font-size: 13px; font-weight: 400;
    text-decoration: none; line-height: 1;
    padding: 6px 0;
    transition: color 0.18s;
    letter-spacing: 0.01em;
  }
  .ftr-link:hover { color: #F0F0F0; }
  .ftr-contact-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 6px 0;
  }
  .ftr-contact-icon {
    width: 14px; height: 14px; flex-shrink: 0;
    margin-top: 1px; color: #3A3A42;
  }
  .ftr-contact-text {
    color: #52525A; font-size: 13px;
    text-decoration: none; transition: color 0.18s;
    line-height: 1.5; word-break: break-word;
  }
  .ftr-contact-text:hover { color: #F0F0F0; }
  .ftr-social-row {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 0;
  }
  .ftr-social-icon {
    width: 30px; height: 30px; border-radius: 4px;
    border: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: all 0.18s;
    background: rgba(255,255,255,0.02);
  }
  .ftr-social-icon:hover {
    border-color: rgba(196,162,101,0.3);
    background: rgba(196,162,101,0.05);
  }
  .ftr-social-label {
    color: #52525A; font-size: 13px;
    text-decoration: none; transition: color 0.18s;
  }
  .ftr-social-label:hover { color: #F0F0F0; }
  .ftr-bottom {
    border-top: 1px solid rgba(255,255,255,0.05);
    padding: 16px 20px;
    max-width: 1280px; margin: 0 auto;
    display: flex; align-items: center;
    justify-content: space-between; gap: 12px;
    flex-wrap: wrap;
  }
  .ftr-bottom-text {
    font-size: 11px; color: #2A2A30;
    letter-spacing: 0.04em;
  }
  .ftr-bottom-brand {
    font-size: 11px; color: #2A2A30; letter-spacing: 0.04em;
    display: flex; align-items: center; gap: 6px;
  }

  @media (max-width: 900px) {
    .ftr-grid { grid-template-columns: 1fr 1fr; gap: 36px; }
  }
  @media (max-width: 540px) {
    .ftr-grid { grid-template-columns: 1fr; gap: 32px; padding: 44px 20px 36px; }
    .ftr-bottom { flex-direction: column; align-items: flex-start; gap: 6px; }
  }
`;

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { siteName, siteInitial, profile: tenantProfile } = useSiteProfile();
  const [fallbackProfile, setFallbackProfile] = useState(null);

  // When on the main marketplace domain, tenant is null — fetch the superadmin
  // profile so the footer reflects whatever the owner has set in Settings.
  useEffect(() => {
    if (tenantProfile !== null) return; // undefined = still loading, object = has data
    supabase
      .from("public_dealer_profiles")
      .select(
        "id, dealership, site_name, site_logo_url, about_text, location, email, phone, whatsapp_number, social_facebook, social_instagram, social_tiktok, city, state"
      )
      .eq("id", SUPERADMIN_ID)
      .maybeSingle()
      .then(({ data }) => setFallbackProfile(data || null));
  }, [tenantProfile]);

  // Use tenant profile when on subdomain, superadmin fallback on main domain
  const profile = tenantProfile || fallbackProfile;

  const dealershipName = profile?.dealership || profile?.site_name || siteName;
  const locationStr    = [profile?.city, profile?.state, profile?.location].filter(Boolean).join(", ");
  const aboutRaw       = profile?.about_text || "";
  const aboutSnippet   = aboutRaw.length > 120 ? aboutRaw.slice(0, 120).trimEnd() + "…" : aboutRaw;
  const logoUrl        = profile?.site_logo_url || "";

  const email    = profile?.email || "";
  const phone    = profile?.phone || "";
  const whatsapp = profile?.whatsapp_number || "";
  const facebook = profile?.social_facebook || "";
  const instagram= profile?.social_instagram || "";
  const tiktok   = profile?.social_tiktok || "";

  const waHref = whatsapp
    ? `https://wa.me/${whatsapp.replace(/\D/g, "").replace(/^(?!60)/, "60")}`
    : "";
  const fbHref = facebook
    ? facebook.startsWith("http") ? facebook : `https://facebook.com/${facebook.replace(/^@/, "")}`
    : "";
  const igHref = instagram
    ? instagram.startsWith("http") ? instagram : `https://instagram.com/${instagram.replace(/^@/, "")}`
    : "";
  const ttHref = tiktok
    ? tiktok.startsWith("http") ? tiktok : `https://tiktok.com/@${tiktok.replace(/^@/, "")}`
    : "";

  const hasContact = email || phone || whatsapp;
  const hasSocials = facebook || instagram || tiktok;

  const quickLinks = [
    { label: "Browse Cars",    to: "/cars" },
    { label: "Calculator",     to: "/calculator" },
    { label: "How It Works",   to: "/#how-it-works" },
    { label: "For Dealers",    to: "/for-dealers" },
    { label: "Sign In",        to: "/login" },
  ];

  return (
    <footer className="ftr-root">
      <style>{FOOTER_CSS}</style>

      <div className="ftr-grid">

        {/* Col 1 — Brand */}
        <div>
          {logoUrl ? (
            <img src={logoUrl} alt={dealershipName} style={{ height: "36px", marginBottom: "16px", objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
              <div style={{
                width: "30px", height: "30px", borderRadius: "5px",
                background: "#DC2626", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <span style={{ color: "white", fontWeight: "800", fontSize: "14px", fontFamily: "'Outfit', sans-serif" }}>
                  {siteInitial}
                </span>
              </div>
              <span style={{ color: "#F0F0F0", fontWeight: "700", fontSize: "16px", letterSpacing: "-0.02em" }}>
                {dealershipName}
              </span>
            </div>
          )}
          {locationStr && (
            <p style={{ color: "#3A3A42", fontSize: "12px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {locationStr}
            </p>
          )}
          {aboutSnippet && (
            <p style={{ color: "#3A3A42", fontSize: "12.5px", lineHeight: "1.75", margin: 0 }}>
              {aboutSnippet}
            </p>
          )}
        </div>

        {/* Col 2 — Quick Links */}
        <div>
          <p className="ftr-col-head">Quick Links</p>
          <nav>
            {quickLinks.map((l) => (
              <Link key={l.to} to={l.to} className="ftr-link">{l.label}</Link>
            ))}
          </nav>
        </div>

        {/* Col 3 — Contact */}
        <div>
          <p className="ftr-col-head">Contact</p>
          {!hasContact && (
            <p style={{ color: "#2A2A30", fontSize: "12px" }}>—</p>
          )}
          {email && (
            <div className="ftr-contact-item">
              <svg className="ftr-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <a href={`mailto:${email}`} className="ftr-contact-text">{email}</a>
            </div>
          )}
          {phone && (
            <div className="ftr-contact-item">
              <svg className="ftr-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.24h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.06 6.06l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <a href={`tel:${phone}`} className="ftr-contact-text">{phone}</a>
            </div>
          )}
          {whatsapp && (
            <div className="ftr-contact-item">
              <svg className="ftr-contact-icon" viewBox="0 0 24 24" fill="currentColor" style={{ color: "#3A3A42" }}>
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
              </svg>
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="ftr-contact-text">WhatsApp Us</a>
            </div>
          )}
        </div>

        {/* Col 4 — Socials */}
        <div>
          <p className="ftr-col-head">Follow Us</p>
          {!hasSocials && (
            <p style={{ color: "#2A2A30", fontSize: "12px" }}>—</p>
          )}
          {facebook && (
            <a href={fbHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div className="ftr-social-row">
                <div className="ftr-social-icon">
                  <svg width="14" height="14" fill="#52525A" viewBox="0 0 24 24">
                    <path d="M22 12a10 10 0 1 0-11.56 9.87v-6.99H8.08V12h2.36v-2.05c0-2.33 1.39-3.62 3.51-3.62.7 0 1.43.06 2.13.18v2.34h-1.2c-1.18 0-1.55.73-1.55 1.49V12h2.63l-.42 2.88h-2.21v6.99A10 10 0 0 0 22 12Z"/>
                  </svg>
                </div>
                <span className="ftr-social-label">Facebook</span>
              </div>
            </a>
          )}
          {instagram && (
            <a href={igHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div className="ftr-social-row">
                <div className="ftr-social-icon">
                  <svg width="14" height="14" fill="none" stroke="#52525A" strokeWidth="1.8" viewBox="0 0 24 24">
                    <rect x="2" y="2" width="20" height="20" rx="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="1" fill="#52525A" stroke="none"/>
                  </svg>
                </div>
                <span className="ftr-social-label">Instagram</span>
              </div>
            </a>
          )}
          {tiktok && (
            <a href={ttHref} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <div className="ftr-social-row">
                <div className="ftr-social-icon">
                  <svg width="14" height="14" fill="#52525A" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07Z"/>
                  </svg>
                </div>
                <span className="ftr-social-label">TikTok</span>
              </div>
            </a>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="ftr-bottom">
          <span className="ftr-bottom-text">
            © {currentYear} {dealershipName}. All rights reserved.
          </span>
          <span className="ftr-bottom-brand">
            Powered by
            <span style={{ color: "#DC2626", fontWeight: "600" }}>ShiftOS</span>
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
