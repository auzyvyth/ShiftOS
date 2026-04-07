import React from "react";
import { useSiteProfile } from "../hooks/useSiteProfile";

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { siteName, siteInitial, profile } = useSiteProfile();

  const dealershipName = profile?.dealership || siteName;
  const location       = profile?.location || "";
  const aboutRaw       = profile?.about_text || "";
  const aboutSnippet   = aboutRaw.length > 100 ? aboutRaw.slice(0, 100).trimEnd() + "…" : aboutRaw;
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
  const colCount   = [true, hasContact, hasSocials].filter(Boolean).length;

  const linkCls = "text-gray-400 hover:text-red-500 text-sm transition-colors";
  const headCls = "text-white text-sm font-semibold uppercase tracking-wider mb-4";

  return (
    <footer className="bg-gray-950 border-t border-gray-800" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div className={`max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-${colCount} gap-8`}>

        {/* Left col — brand */}
        <div>
          {logoUrl ? (
            <img src={logoUrl} alt={dealershipName} className="h-10 mb-3 object-contain" />
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <div className="relative w-8 h-8 flex items-center justify-center flex-shrink-0">
                <div className="absolute inset-0 bg-red-600 rounded-lg rotate-6" />
                <span className="relative text-white font-black text-sm" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                  {siteInitial}
                </span>
              </div>
              <span className="text-white font-bold text-lg tracking-tight">{dealershipName}</span>
            </div>
          )}
          {location && <p className="text-gray-500 text-sm mb-1">{location}</p>}
          {aboutSnippet && <p className="text-gray-500 text-sm leading-relaxed">{aboutSnippet}</p>}
        </div>

        {/* Middle col — Contact */}
        {hasContact && (
          <div>
            <p className={headCls}>Contact Us</p>
            <ul className="space-y-2">
              {email && (
                <li>
                  <a href={`mailto:${email}`} className={linkCls}>
                    <span className="mr-2">✉</span>{email}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  <a href={`tel:${phone}`} className={linkCls}>
                    <span className="mr-2">📞</span>{phone}
                  </a>
                </li>
              )}
              {whatsapp && (
                <li>
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className={linkCls}>
                    <span className="mr-2">💬</span>WhatsApp
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Right col — Socials */}
        {hasSocials && (
          <div>
            <p className={headCls}>Follow Us</p>
            <ul className="space-y-2">
              {facebook && (
                <li>
                  <a href={fbHref} target="_blank" rel="noopener noreferrer" className={linkCls}>
                    <span className="mr-2">
                      <svg className="inline w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12a10 10 0 1 0-11.56 9.87v-6.99H8.08V12h2.36v-2.05c0-2.33 1.39-3.62 3.51-3.62.7 0 1.43.06 2.13.18v2.34h-1.2c-1.18 0-1.55.73-1.55 1.49V12h2.63l-.42 2.88h-2.21v6.99A10 10 0 0 0 22 12Z"/></svg>
                    </span>
                    Facebook
                  </a>
                </li>
              )}
              {instagram && (
                <li>
                  <a href={igHref} target="_blank" rel="noopener noreferrer" className={linkCls}>
                    <span className="mr-2">
                      <svg className="inline w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
                    </span>
                    Instagram
                  </a>
                </li>
              )}
              {tiktok && (
                <li>
                  <a href={ttHref} target="_blank" rel="noopener noreferrer" className={linkCls}>
                    <span className="mr-2">
                      <svg className="inline w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07Z"/></svg>
                    </span>
                    TikTok
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800 px-6 py-4 text-center text-xs text-gray-600">
        <span>Powered by <span className="text-red-600 font-semibold">ShiftOS</span></span>
        <span className="mx-2">·</span>
        <span>© {currentYear} {dealershipName}</span>
      </div>
    </footer>
  );
};

export default Footer;
