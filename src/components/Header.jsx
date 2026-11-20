import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, MessageCircle, Crown, User, ShieldCheck, ChevronRight, MapPin, Clock, Phone, Facebook, Instagram, Music2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSiteProfile } from "../hooks/useSiteProfile";
import { supabase } from "../supabaseClient";
import { isSubdomain } from "../hooks/useTenant";
import { routeForProfile, isSellerRole, ROUTE_PROFILE_COLUMNS } from "../hooks/useRoleRedirect";
import { useHideOnScroll } from "../hooks/useHideOnScroll";
import { hasHowItWorks } from "../utils/storefrontCopy";
import { cleanOptions } from "../utils/storefrontLayout";

// Same solid near-black bar as MarketplaceHeader (#0f1115; on a dealer site with a colour
// theme, every colour here follows the theme's CSS variables, storefrontTheme.js) — that file is the
// one place this "modern" language was already designed and approved, so this
// reuses its tokens rather than inventing a second dark bar style. The old
// version here was a floating glass pill (blur, inset margins, glow shadows),
// which is the exact pattern MarketplaceHeader's own design notes say was
// tried and rejected on the marketplace hero for the same reason: a blurred
// floating panel reads as a dated SaaS-landing-page trend, not chrome.
const HDR_CSS = `

  .hdr-root {
    font-family: 'Outfit', sans-serif;
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 50;
    background: var(--sf-bg, #0f1115);
    border-bottom: 1px solid var(--sf-border, rgba(255,255,255,0.08));
    transition: transform 0.28s ease, box-shadow 0.25s, border-color 0.25s;
  }
  .hdr-root.scrolled { box-shadow: 0 10px 30px rgba(0,0,0,0.4); border-bottom-color: var(--sf-border, rgba(255,255,255,0.14)); }
  .hdr-root.hidden { transform: translateY(-100%); }
  /* A hidden bar must still return for the keyboard, or tabbing into the nav
     moves focus somewhere the user cannot see. */
  .hdr-root:focus-within { transform: none; }
  @media (prefers-reduced-motion: reduce) {
    .hdr-root { transition: box-shadow 0.25s, border-color 0.25s; }
  }

  .hdr-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 clamp(16px, 3.5vw, 32px);
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  /* ── Logo ── */
  .hdr-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; min-width: 0;
  }
  .hdr-mark {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: var(--sf-accent, #DC2626);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    font-family: 'Outfit', sans-serif;
    font-weight: 800; font-size: 14px; color: var(--sf-on-accent, white);
    letter-spacing: -0.01em;
  }
  /* Uploaded dealer logo: show the whole thing (contain), fixed height, width
     capped so a wide wordmark can't blow out the header — scales down on mobile. */
  .hdr-logo-img {
    height: 28px; width: auto;
    max-width: 150px; max-height: 28px;
    object-fit: contain; object-position: left center;
    display: block; flex-shrink: 0;
  }
  @media (max-width: 1024px) {
    .hdr-logo-img { max-width: 108px; }
  }
  .hdr-logo-text { display: flex; flex-direction: column; min-width: 0; }
  .hdr-logo-name {
    font-family: 'Outfit', sans-serif;
    font-size: 15px; font-weight: 700; color: var(--sf-text, #ffffff);
    letter-spacing: -0.01em; line-height: 1.15; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }
  .hdr-logo-sub {
    font-size: 10px; font-weight: 600; color: var(--sf-muted, rgba(255,255,255,0.4));
    letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }

  /* ── Desktop nav — pill-on-hover, matches MarketplaceHeader's .mh-nav-link ── */
  .hdr-nav { display: flex; align-items: center; gap: 2px; }
  .hdr-link {
    display: flex; align-items: center;
    font-size: 14px; font-weight: 600;
    color: var(--sf-muted, rgba(255,255,255,0.72));
    text-decoration: none; white-space: nowrap;
    padding: 9px 13px; border-radius: 10px;
    background: none; border: none; cursor: pointer;
    font-family: inherit;
    transition: background 0.14s, color 0.14s;
  }
  .hdr-link:hover { background: var(--sf-card, rgba(255,255,255,0.08)); color: var(--sf-text, #ffffff); }
  .hdr-link.active { color: var(--sf-text, #ffffff); background: var(--sf-card, rgba(255,255,255,0.06)); }

  /* ── For Dealers — the ONE accent pill in the bar; radius on the button
     scale (10px), not a fully-rounded shape, per the "no pill on text" rule. ── */
  .hdr-dealer {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 12px; font-weight: 700; color: var(--sf-accent-text, #fca5a5);
    background: rgba(var(--sf-accent-rgb, 220,38,38),0.12);
    border: 1px solid rgba(var(--sf-accent-rgb, 220,38,38),0.3);
    border-radius: 10px; padding: 8px 13px;
    text-decoration: none; white-space: nowrap;
    letter-spacing: 0.01em;
    transition: background 0.14s, border-color 0.14s;
  }
  .hdr-dealer:hover { background: rgba(var(--sf-accent-rgb, 220,38,38),0.2); border-color: rgba(var(--sf-accent-rgb, 220,38,38),0.5); }

  /* ── Desktop right actions ── */
  .hdr-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .hdr-vsep { width: 1px; height: 24px; background: var(--sf-border, rgba(255,255,255,0.12)); margin: 0 4px; }

  /* ── Lang toggle — segmented control, 8px radius per the chip/segment scale ── */
  .hdr-lang {
    display: flex; align-items: center;
    background: var(--sf-card, rgba(255,255,255,0.05));
    border: 1px solid var(--sf-border, rgba(255,255,255,0.1));
    border-radius: 8px; padding: 2px;
  }
  .hdr-lang-btn {
    padding: 5px 10px; border-radius: 6px;
    font-size: 11px; font-weight: 700;
    border: none; cursor: pointer; transition: all 0.15s;
    background: transparent; color: var(--sf-muted, rgba(255,255,255,0.4));
    letter-spacing: 0.04em; font-family: 'Outfit', sans-serif;
  }
  .hdr-lang-btn.on { background: var(--sf-border, rgba(255,255,255,0.12)); color: var(--sf-text, #ffffff); }

  /* ── WhatsApp CTA — the bar's one primary action, button-scale radius ── */
  .hdr-wa {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 700; color: #ffffff;
    background: #25D366;
    border: 1px solid #25D366;
    border-radius: 10px; padding: 9px 16px;
    text-decoration: none; white-space: nowrap;
    transition: background 0.15s, transform 0.12s;
  }
  .hdr-wa:hover { background: #1ea952; transform: translateY(-1px); }

  /* ── Sign in / account — plain text link, red underline-on-hover, matches
     MarketplaceHeader's .mh-signin ── */
  .hdr-signin {
    color: var(--sf-text, #ffffff); font-size: 14px; font-weight: 600;
    text-decoration: none; padding: 9px 6px; position: relative;
    font-family: inherit; white-space: nowrap;
  }
  .hdr-signin::after {
    content: ''; position: absolute; left: 6px; right: 6px; bottom: 3px;
    height: 2px; background: var(--sf-accent, #dc2626); border-radius: 2px;
    transform: scaleX(0); transform-origin: left; transition: transform 0.2s;
  }
  .hdr-signin:hover::after { transform: scaleX(1); }

  /* ── Logout ── */
  .hdr-logout {
    font-size: 12px; color: var(--sf-muted, rgba(255,255,255,0.4));
    background: none; border: none; cursor: pointer;
    padding: 9px 10px; border-radius: 8px;
    transition: color 0.15s, background 0.15s; font-family: 'Outfit', sans-serif;
  }
  .hdr-logout:hover { color: var(--sf-text, #ffffff); background: var(--sf-card, rgba(255,255,255,0.06)); }

  /* ── Mobile burger — icon-only, circle is fine ── */
  .hdr-burger {
    width: 38px; height: 38px;
    padding: 0; border-radius: 10px;
    background: var(--sf-card, rgba(255,255,255,0.06));
    border: 1px solid var(--sf-border, rgba(255,255,255,0.1));
    color: var(--sf-text, #ffffff);
    cursor: pointer; display: flex;
    align-items: center; justify-content: center;
    transition: background 0.14s;
  }
  .hdr-burger:hover { background: var(--sf-card, rgba(255,255,255,0.1)); }

  /* ── Responsive ── */
  .hdr-desktop { display: flex; align-items: center; gap: 8px; }
  .hdr-mobile-only { display: none; flex-shrink: 0; }

  @media (max-width: 1024px) {
    .hdr-desktop { display: none !important; }
    .hdr-mobile-only { display: flex !important; }
    .hdr-nav { display: none !important; }
  }

  /* ── Showroom header (dealer's look option header = "showroom", storefrontLayout.js):
     a thin info bar on top (address, hours, phone, socials; each only when filled) and
     Browse Cars as the one filled accent item. The bar sits inside the fixed header and
     folds away once the page scrolls or the menu opens; a spacer of the same height in
     the page flow (.hdr-tb-space) keeps every page's content where it was below it. ── */
  .hdr-topbar {
    height: var(--hdr-tb-h); overflow: hidden;
    border-bottom: 1px solid var(--sf-border, rgba(255,255,255,0.08));
    transition: height 0.2s ease, border-color 0.2s;
  }
  .hdr-root.scrolled .hdr-topbar, .hdr-root.menu-open .hdr-topbar { height: 0; border-bottom-color: transparent; }
  .hdr-topbar-in {
    max-width: 1280px; margin: 0 auto; height: 100%;
    padding: 0 clamp(16px, 3.5vw, 32px);
    display: flex; align-items: center; gap: 20px;
    font-size: 12.5px; color: var(--sf-muted, rgba(255,255,255,0.72));
  }
  .hdr-tb-item { display: inline-flex; align-items: center; gap: 6px; min-width: 0; white-space: nowrap; color: inherit; text-decoration: none; }
  .hdr-tb-item span { overflow: hidden; text-overflow: ellipsis; }
  a.hdr-tb-item:hover { color: var(--sf-text, #ffffff); }
  .hdr-tb-addr { flex: 0 1 auto; min-width: 0; }
  .hdr-tb-social { margin-left: auto; display: flex; gap: 6px; flex-shrink: 0; }
  .hdr-tb-social a {
    width: 24px; height: 24px; border-radius: 999px; display: grid; place-items: center;
    color: var(--sf-text, #ffffff); background: var(--sf-card, rgba(255,255,255,0.08));
  }
  .hdr-tb-space { height: var(--hdr-tb-h); }
  .hdr-link.hdr-link-cta, .hdr-link.hdr-link-cta:hover, .hdr-link.hdr-link-cta.active {
    background: var(--sf-accent, #DC2626); color: var(--sf-on-accent, #ffffff);
  }
  .hdr-link.hdr-link-cta:hover { background: var(--sf-accent-hover, #B91C1C); }
  /* Phone: phone number + hours only (the address and socials are in Get in touch). */
  @media (max-width: 640px) {
    .hdr-tb-addr, .hdr-tb-social { display: none !important; }
    .hdr-topbar-in { gap: 14px; font-size: 12px; justify-content: space-between; }
  }

  /* ── Mobile sheet — full-width, same solid colour as the bar (not a floating
     translucent card), drops down directly below it. Matches MarketplaceHeader's
     .mh-mobile: a solid sheet is the one that can never let the page show
     through or below it, and body scroll is locked while it's open. ── */
  .hdr-mobile-sheet {
    position: fixed;
    top: 64px; left: 0; right: 0; bottom: 0;
    z-index: 49;
    background: var(--sf-bg, #0f1115);
    display: flex; flex-direction: column;
    padding: 8px 16px 24px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .hdr-mlink {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 15px 6px; border-radius: 0;
    font-size: 15px; font-weight: 600; color: var(--sf-text, rgba(255,255,255,0.85));
    text-decoration: none;
    border-bottom: 1px solid var(--sf-border, rgba(255,255,255,0.07));
    background: none; border-left: none; border-right: none; border-top: none;
    cursor: pointer; width: 100%; text-align: left; font-family: inherit;
  }
  .hdr-mlink.active { color: var(--sf-text, #ffffff); }
  .hdr-mlink.special { color: var(--sf-accent-text, #fca5a5); }

  .hdr-mobile-bottom {
    margin-top: 14px; padding-top: 16px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .hdr-wa-mobile {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 14px; font-weight: 700; color: #ffffff;
    background: #25D366;
    border-radius: 10px; padding: 14px;
    text-decoration: none;
  }
  .hdr-signin-mobile {
    display: flex; align-items: center; justify-content: center; gap: 7px;
    font-size: 14px; font-weight: 600; color: var(--sf-text, #ffffff);
    background: transparent; border: 1.5px solid var(--sf-border, rgba(255,255,255,0.2));
    border-radius: 10px; padding: 13px;
    text-decoration: none;
  }
`;

// The info bar's parts, each only when the dealer filled it in (Settings). The dealer's own
// site may show their phone number (CDP-3's one exception, like Get in touch).
function topBarParts(p) {
  if (!p) return null;
  const addr = [p.location, p.city, p.state].filter(Boolean).join(", ");
  const tel = p.phone ? String(p.phone).replace(/[^\d+]/g, "") : "";
  const socials = [
    p.social_facebook && { icon: Facebook, href: p.social_facebook, label: "Facebook" },
    p.social_instagram && { icon: Instagram, href: p.social_instagram, label: "Instagram" },
    p.social_tiktok && { icon: Music2, href: p.social_tiktok, label: "TikTok" },
  ].filter(Boolean);
  if (!addr && !p.business_hours && !tel && !socials.length) return null;
  return { addr, hours: p.business_hours || "", phone: p.phone || "", tel, socials,
    // Nothing a phone shows (phone, hours): no bar on a phone at all.
    phoneEmpty: !tel && !p.business_hours };
}

// look = the home page's look options (draft-aware); other dealer pages read the saved ones.
export default function Header({ look } = {}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [viewerProfile, setViewerProfile] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { siteName, siteInitial, siteLogoUrl, isVerified, waUrl, profile: tenantProfile } = useSiteProfile();

  // Same auto-hide pattern as MarketplaceHeader: pinned visible whenever the
  // mobile sheet (which lives inside this bar) is open, so it can't take its
  // own close button off-screen.
  const headerVisible = useHideOnScroll({ offset: 80, locked: mobileOpen });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll behind the open mobile sheet, or the page scrolls away
  // underneath it. Keyed on the open boolean, not inline (overlay rule).
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mobileOpen]);

  useEffect(() => {
    const fetchRole = async (uid) => {
      const { data } = await supabase
        .from("profiles")
        // dealer_id + plan: a standalone salesman's home is /salesman-lite or
        // /salesman-premium, and the role on its own cannot tell you which.
        .select(ROUTE_PROFILE_COLUMNS)
        .eq("id", uid)
        .maybeSingle();
      setViewerProfile(data || null);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setAuthUser(data.session.user);
        fetchRole(data.session.user.id);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) {
        setAuthUser(session.user);
        fetchRole(session.user.id);
      } else {
        setAuthUser(null);
        setViewerProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const isLoggedIn = !!authUser;
  // Destination comes from the one shared resolver; only the wording differs —
  // a buyer's home is /account and reads "My Account".
  const accountPath = routeForProfile(viewerProfile);
  const accountLabel = isSellerRole(viewerProfile?.role) ? t("nav.dashboard") : "My Account";
  const toggleLang = () => i18n.changeLanguage(i18n.language.startsWith("en") ? "ms" : "en");
  const isEn = i18n.language.startsWith("en");
  const waHref = waUrl ? waUrl(`Hi ${siteName}, I need help finding a car`) : "#";

  const onSub = isSubdomain();
  const showroom = onSub && (look || cleanOptions(tenantProfile?.storefront_layout)).header === "showroom";
  const bar = showroom ? topBarParts(tenantProfile) : null;
  // Bar height as a variable on the header and its spacer (0 on a phone with nothing to show).
  const barCss = bar
    ? `:root{--hdr-tb-h:34px}${bar.phoneEmpty ? "@media (max-width:640px){:root{--hdr-tb-h:0px}}" : ""}`
    : "";
  // On a subdomain, /showroom redirects to "/" (it is the marketplace-wide
  // search). The tenant-scoped car list is /cars, so browse must target that.
  const navLinks = onSub
    ? [
        { name: t("nav.home"),       path: "/",              key: "home" },
        { name: t("nav.browseCars"), path: "/cars",          key: "cars" },
        { name: t("nav.calculator"), path: "/calculator",    key: "calculator" },
        // Only when the dealer wrote that section, or the link scrolls to nothing.
        ...(hasHowItWorks(tenantProfile) ? [{ name: t("nav.howItWorks"), path: "/#how-it-works", key: "howitworks" }] : []),
      ]
    : [
        { name: t("nav.home"),       path: "/",              key: "home" },
        { name: t("nav.browseCars"), path: "/showroom",      key: "cars" },
        { name: t("nav.calculator"), path: "/calculator",    key: "calculator" },
        { name: t("nav.howItWorks"), path: "/#how-it-works", key: "howitworks" },
        { name: "For Dealers",       path: "/shiftos",       key: "dealers", isSpecial: true },
      ];
  // Sign in / My account is NOT a page of the site, so it sits with the actions
  // on the right (language, account, WhatsApp), not in the page links. Mobile
  // shows it as the last row of the sheet.
  const accountLink = isLoggedIn
    ? { name: accountLabel, path: accountPath, key: "account" }
    : { name: t("nav.login"), path: "/login", key: "login" };

  const scrollToHash = (hash) => {
    const el = document.getElementById(hash);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleNav = (path) => {
    setMobileOpen(false);
    if (!path.includes("#")) return;
    const hash = path.split("#")[1];
    if (location.pathname === "/") {
      scrollToHash(hash);
    } else {
      navigate("/");
      // scroll after page renders
      setTimeout(() => scrollToHash(hash), 120);
    }
  };

  return (
    <>
      <style>{HDR_CSS}</style>
      {barCss && <style>{barCss}</style>}
      {bar && <div className="hdr-tb-space" aria-hidden />}

      <header className={`hdr-root${scrolled ? " scrolled" : ""}${headerVisible ? "" : " hidden"}${mobileOpen ? " menu-open" : ""}`}>
        {bar && (
          <div className="hdr-topbar">
            <div className="hdr-topbar-in">
              {bar.addr && (
                <span className="hdr-tb-item hdr-tb-addr"><MapPin size={13} style={{ flexShrink: 0 }} /><span>{bar.addr}</span></span>
              )}
              {bar.hours && (
                <span className="hdr-tb-item"><Clock size={13} style={{ flexShrink: 0 }} /><span>{bar.hours}</span></span>
              )}
              {bar.tel && (
                <a className="hdr-tb-item" href={`tel:${bar.tel}`}><Phone size={13} style={{ flexShrink: 0 }} /><span>{bar.phone}</span></a>
              )}
              {bar.socials.length > 0 && (
                <span className="hdr-tb-social">
                  {bar.socials.map(({ icon: Icon, href, label }) => (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}><Icon size={12} /></a>
                  ))}
                </span>
              )}
            </div>
          </div>
        )}
        <div className="hdr-inner">

          {/* Logo */}
          <Link to="/" className="hdr-logo">
            {siteLogoUrl ? (
              <img src={siteLogoUrl} alt={siteName} className="hdr-logo-img" />
            ) : (
              <div className="hdr-mark">{siteInitial}</div>
            )}
            <div className="hdr-logo-text">
              <span className="hdr-logo-name" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                {siteName}
                {isVerified && (
                  <ShieldCheck size={14} strokeWidth={2.5} style={{ color: "#60a5fa", flexShrink: 0 }} aria-label="Verified Dealer" />
                )}
              </span>
              {isVerified && <span className="hdr-logo-sub">Verified Dealer</span>}
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hdr-nav">
            {navLinks.map((link) =>
              link.isSpecial ? (
                <Link key={link.key} to={link.path} className="hdr-dealer">
                  <Crown size={12} style={{ flexShrink: 0 }} />
                  {link.name}
                </Link>
              ) : link.path.includes("#") ? (
                <button
                  key={link.key}
                  onClick={() => handleNav(link.path)}
                  className="hdr-link"
                >
                  {link.name}
                </button>
              ) : (
                <Link
                  key={link.key}
                  to={link.path}
                  onClick={() => handleNav(link.path)}
                  className={`hdr-link${showroom && link.key === "cars" ? " hdr-link-cta" : ""}${location.pathname === link.path ? " active" : ""}`}
                >
                  {link.name}
                </Link>
              )
            )}
          </nav>

          {/* Desktop actions */}
          <div className="hdr-actions hdr-desktop">
            <div className="hdr-lang">
              <button onClick={toggleLang} className={`hdr-lang-btn${isEn ? " on" : ""}`} aria-label="Switch to English" aria-pressed={isEn}>EN</button>
              <button onClick={toggleLang} className={`hdr-lang-btn${!isEn ? " on" : ""}`} aria-label="Switch to Malay" aria-pressed={!isEn}>BM</button>
            </div>
            <span className="hdr-vsep" />
            <Link to={accountLink.path} className="hdr-signin">{accountLink.name}</Link>
            {isLoggedIn && (
              <button
                className="hdr-logout"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }}
              >
                Logout
              </button>
            )}
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="hdr-wa">
              <MessageCircle size={14} style={{ flexShrink: 0 }} />
              {t("common.whatsappUs")}
            </a>
          </div>

          {/* Mobile controls */}
          <div className="hdr-mobile-only" style={{ alignItems: "center", gap: "8px" }}>
            <div className="hdr-lang">
              <button onClick={toggleLang} className={`hdr-lang-btn${isEn ? " on" : ""}`} aria-label="Switch to English" aria-pressed={isEn}>EN</button>
              <button onClick={toggleLang} className={`hdr-lang-btn${!isEn ? " on" : ""}`} aria-label="Switch to Malay" aria-pressed={!isEn}>BM</button>
            </div>
            <button className="hdr-burger" aria-label="Menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}>
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile sheet */}
        {mobileOpen && (
          <div className="hdr-mobile-sheet">
            {navLinks.map((link) =>
              link.path.includes("#") ? (
                <button key={link.key} onClick={() => handleNav(link.path)} className="hdr-mlink">
                  <span>{link.name}</span>
                  <ChevronRight size={16} style={{ opacity: 0.4 }} />
                </button>
              ) : (
                <Link
                  key={link.key}
                  to={link.path}
                  onClick={() => handleNav(link.path)}
                  className={`hdr-mlink${link.isSpecial || (showroom && link.key === "cars") ? " special" : location.pathname === link.path ? " active" : ""}`}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {link.isSpecial && <Crown size={15} style={{ flexShrink: 0 }} />}
                    {link.name}
                  </span>
                  <ChevronRight size={16} style={{ opacity: 0.4 }} />
                </Link>
              )
            )}

            <Link to={accountLink.path} onClick={() => setMobileOpen(false)} className="hdr-mlink">
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}><User size={16} /> {isLoggedIn ? accountLink.name : "Sign In"}</span>
              <ChevronRight size={16} style={{ opacity: 0.4 }} />
            </Link>

            <div className="hdr-mobile-bottom">
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="hdr-wa-mobile">
                <MessageCircle size={16} style={{ flexShrink: 0 }} />
                {t("common.whatsappUs")}
              </a>
              {isLoggedIn && (
                <button
                  className="hdr-signin-mobile"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    window.location.href = "/";
                  }}
                >
                  Logout
                </button>
              )}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
