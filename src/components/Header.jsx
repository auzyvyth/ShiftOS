import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, MessageCircle, Sparkles, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSiteProfile } from "../hooks/useSiteProfile";
import { supabase } from "../supabaseClient";

const HDR_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

  .hdr-root {
    font-family: 'Outfit', sans-serif;
  }

  /* ── Glass states ── */
  .hdr-glass {
    background: rgba(9,9,11,0.55);
    backdrop-filter: blur(32px) saturate(180%);
    -webkit-backdrop-filter: blur(32px) saturate(180%);
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .hdr-glass-scrolled {
    background: rgba(9,9,11,0.88);
    backdrop-filter: blur(36px) saturate(200%);
    -webkit-backdrop-filter: blur(36px) saturate(200%);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    box-shadow: 0 8px 48px rgba(0,0,0,0.4);
  }
  .hdr-dashboard {
    background: #09090B;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }

  /* ── Inner ── */
  .hdr-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
    height: 62px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  /* ── Logo ── */
  .hdr-logo {
    display: flex; align-items: center; gap: 11px;
    text-decoration: none; flex-shrink: 0;
  }
  .hdr-mark {
    width: 33px; height: 33px;
    border-radius: 50%;
    background: #DC2626;
    box-shadow: 0 0 0 1px rgba(220,38,38,0.35), 0 4px 16px rgba(220,38,38,0.2);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    font-family: 'Outfit', sans-serif;
    font-weight: 800; font-size: 14px; color: white;
    letter-spacing: -0.01em;
    transition: box-shadow 0.3s;
  }
  .hdr-logo:hover .hdr-mark {
    box-shadow: 0 0 0 1px rgba(220,38,38,0.5), 0 6px 24px rgba(220,38,38,0.3);
  }
  .hdr-logo-text { display: flex; flex-direction: column; }
  .hdr-logo-name {
    font-family: 'Outfit', sans-serif;
    font-size: 16px; font-weight: 700; color: #F0F0F0;
    letter-spacing: -0.02em; line-height: 1.1; white-space: nowrap;
  }
  .hdr-logo-sub {
    font-size: 8px; font-weight: 500; color: #2A2A30;
    letter-spacing: 0.2em; text-transform: uppercase; white-space: nowrap;
    margin-top: 1px;
  }

  /* ── Desktop nav ── */
  .hdr-nav {
    display: flex; align-items: center; gap: 32px;
    flex: 1; justify-content: center;
  }
  .hdr-link {
    position: relative;
    font-size: 13px; font-weight: 500;
    color: rgba(140,140,150,0.9);
    text-decoration: none; white-space: nowrap;
    transition: color 0.25s; padding: 6px 0;
    letter-spacing: 0.01em;
  }
  .hdr-link::after {
    content: ''; position: absolute;
    bottom: 0; left: 50%; right: 50%; height: 1px;
    background: linear-gradient(90deg, transparent, #C4A265, transparent);
    transition: left 0.3s ease, right 0.3s ease;
    border-radius: 1px;
  }
  .hdr-link:hover { color: #F0F0F0; }
  .hdr-link:hover::after { left: 0; right: 0; }
  .hdr-link.active { color: #F0F0F0; }
  .hdr-link.active::after { left: 0; right: 0; }

  /* ── For Dealers pill ── */
  .hdr-dealer {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600; color: #F87171;
    background: rgba(220,38,38,0.07);
    border: 1px solid rgba(220,38,38,0.18);
    border-radius: 50px; padding: 5px 14px;
    text-decoration: none; white-space: nowrap;
    transition: all 0.25s ease; letter-spacing: 0.02em;
    box-shadow: 0 0 16px rgba(220,38,38,0.05);
  }
  .hdr-dealer:hover {
    background: rgba(220,38,38,0.12);
    border-color: rgba(220,38,38,0.35);
    box-shadow: 0 0 20px rgba(220,38,38,0.1);
    transform: translateY(-1px);
  }

  /* ── Desktop right actions ── */
  .hdr-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

  /* ── Lang toggle ── */
  .hdr-lang {
    display: flex; align-items: center;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 50px; padding: 3px;
  }
  .hdr-lang-btn {
    padding: 3px 10px; border-radius: 50px;
    font-size: 10px; font-weight: 600;
    border: none; cursor: pointer; transition: all 0.2s;
    background: transparent; color: #2A2A30;
    letter-spacing: 0.06em; font-family: 'Outfit', sans-serif;
  }
  .hdr-lang-btn.on {
    background: rgba(220,38,38,0.08);
    border: 1px solid rgba(220,38,38,0.2);
    color: #F87171;
  }

  /* ── WhatsApp button ── */
  .hdr-wa {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 600; color: rgba(74,222,128,0.9);
    background: rgba(37,211,102,0.05);
    border: 1px solid rgba(37,211,102,0.18);
    border-radius: 50px; padding: 7px 16px;
    text-decoration: none; white-space: nowrap;
    transition: all 0.25s ease; font-family: 'Outfit', sans-serif;
    letter-spacing: 0.02em;
    box-shadow: 0 0 16px rgba(37,211,102,0.04);
  }
  .hdr-wa:hover {
    background: rgba(37,211,102,0.1);
    border-color: rgba(37,211,102,0.38);
    color: #4ADE80;
    box-shadow: 0 0 20px rgba(37,211,102,0.1);
    transform: translateY(-1px);
  }

  /* ── Logout ── */
  .hdr-logout {
    font-size: 11.5px; color: #2A2A30;
    background: none; border: none; cursor: pointer;
    padding: 5px 10px; border-radius: 50px;
    transition: color 0.2s; font-family: 'Outfit', sans-serif;
    letter-spacing: 0.01em;
  }
  .hdr-logout:hover { color: #6B6B72; }

  /* ── Mobile burger ── */
  .hdr-burger {
    padding: 8px; border-radius: 50%;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    cursor: pointer; display: flex;
    align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .hdr-burger:hover { background: rgba(255,255,255,0.07); }

  /* ── Responsive ── */
  .hdr-desktop { display: flex; align-items: center; gap: 10px; }
  .hdr-mobile-only { display: none; }

  @media (max-width: 1024px) {
    .hdr-desktop { display: none !important; }
    .hdr-mobile-only { display: flex !important; }
    .hdr-nav { display: none !important; }
  }

  /* ── Mobile panel ── */
  .hdr-mobile-panel {
    position: fixed; top: 62px; left: 0; right: 0; z-index: 40;
    background: rgba(9,9,11,0.97);
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    max-height: calc(100vh - 62px);
    overflow-y: auto;
  }
  .hdr-mobile-inner {
    max-width: 1280px; margin: 0 auto;
    padding: 12px 18px 28px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .hdr-mlink {
    display: flex; align-items: center; gap: 12px;
    padding: 13px 16px; border-radius: 14px;
    font-size: 14px; font-weight: 500; color: #4A4A52;
    text-decoration: none; transition: all 0.18s;
    border: 1px solid transparent; letter-spacing: 0.01em;
  }
  .hdr-mlink:hover { background: rgba(255,255,255,0.03); color: #C0C0C6; }
  .hdr-mlink.active { background: rgba(255,255,255,0.03); color: #F0F0F0; }
  .hdr-mlink.special {
    color: #F87171;
    background: rgba(220,38,38,0.05);
    border-color: rgba(220,38,38,0.1);
  }
  .hdr-mlink.special:hover { background: rgba(220,38,38,0.09); }

  .hdr-mobile-bottom {
    margin-top: 14px; padding-top: 16px;
    border-top: 1px solid rgba(255,255,255,0.04);
    display: flex; flex-direction: column; gap: 10px;
  }
  .hdr-wa-mobile {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 13px; font-weight: 600; color: rgba(74,222,128,0.9);
    background: rgba(37,211,102,0.05);
    border: 1px solid rgba(37,211,102,0.18);
    border-radius: 50px; padding: 14px 20px;
    text-decoration: none; transition: all 0.2s; font-family: 'Outfit', sans-serif;
    letter-spacing: 0.02em;
  }
  .hdr-wa-mobile:hover { background: rgba(37,211,102,0.1); color: #4ADE80; }
`;

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { siteName, siteInitial, waUrl } = useSiteProfile();

  const isDashboard =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/salesman");

  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const fetchRole = async (uid) => {
      const { data } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .maybeSingle();
      setUserRole(data?.role || null);
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
        setUserRole(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const isLoggedIn = !!authUser;
  const dashboardPath = userRole === "salesman" ? "/salesman" : "/dashboard";
  const toggleLang = () => i18n.changeLanguage(i18n.language.startsWith("en") ? "ms" : "en");
  const isEn = i18n.language.startsWith("en");
  const waHref = waUrl ? waUrl(`Hi ${siteName}, I need help finding a car`) : "#";

  const navLinks = [
    { name: t("nav.home"),       path: "/",              key: "home" },
    { name: t("nav.browseCars"), path: "/cars",          key: "cars" },
    { name: t("nav.calculator"), path: "/calculator",    key: "calculator" },
    { name: t("nav.howItWorks"), path: "/#how-it-works", key: "howitworks" },
    { name: "For Dealers",       path: "/shiftos",       key: "dealers", isSpecial: true },
  ];
  if (isLoggedIn)
    navLinks.push({ name: t("nav.dashboard"), path: dashboardPath, key: "dashboard" });
  else
    navLinks.push({ name: t("nav.login"), path: "/login", key: "login" });

  const handleNav = (path) => {
    setMobileOpen(false);
    if (path.includes("#") && location.pathname === "/") {
      const el = document.getElementById(path.split("#")[1]);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const headerClass = isDashboard
    ? "hdr-dashboard"
    : isScrolled
      ? "hdr-glass-scrolled"
      : "hdr-glass";

  return (
    <>
      <style>{HDR_CSS}</style>

      <header
        className={`hdr-root ${headerClass}`}
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50 }}
      >
        <div className="hdr-inner">

          {/* Logo */}
          <Link to="/" className="hdr-logo">
            <div className="hdr-mark">{siteInitial}</div>
            <div className="hdr-logo-text">
              <span className="hdr-logo-name">
                {siteName}<span style={{ color: "#DC2626" }}>.</span>
              </span>
              <span className="hdr-logo-sub">Trusted Auto</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hdr-nav">
            {navLinks.map((link) =>
              link.isSpecial ? (
                <Link key={link.key} to={link.path} className="hdr-dealer">
                  <Crown style={{ width: "10px", height: "10px", flexShrink: 0 }} />
                  {link.name}
                  <Sparkles style={{ width: "9px", height: "9px", flexShrink: 0 }} />
                </Link>
              ) : (
                <Link
                  key={link.key}
                  to={link.path}
                  onClick={() => handleNav(link.path)}
                  className={`hdr-link${location.pathname === link.path ? " active" : ""}`}
                >
                  {link.name}
                </Link>
              )
            )}
          </nav>

          {/* Desktop actions */}
          <div className="hdr-actions hdr-desktop">
            <div className="hdr-lang">
              <button onClick={toggleLang} className={`hdr-lang-btn${isEn ? " on" : ""}`}>EN</button>
              <button onClick={toggleLang} className={`hdr-lang-btn${!isEn ? " on" : ""}`}>BM</button>
            </div>
            {isLoggedIn && (
              <button
                className="hdr-logout"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = 'https://xdrive.my/login';
                }}
              >
                Logout
              </button>
            )}
            <a href={waHref} target="_blank" rel="noopener noreferrer" className="hdr-wa">
              <MessageCircle style={{ width: "12px", height: "12px", flexShrink: 0 }} />
              {t("common.whatsappUs")}
            </a>
          </div>

          {/* Mobile controls */}
          <div className="hdr-mobile-only" style={{ alignItems: "center", gap: "8px" }}>
            <div className="hdr-lang">
              <button onClick={toggleLang} className={`hdr-lang-btn${isEn ? " on" : ""}`}>EN</button>
              <button onClick={toggleLang} className={`hdr-lang-btn${!isEn ? " on" : ""}`}>BM</button>
            </div>
            <button className="hdr-burger" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">
              {mobileOpen
                ? <X style={{ width: "16px", height: "16px", color: "#C0C0C6" }} />
                : <Menu style={{ width: "16px", height: "16px", color: "#4A4A52" }} />
              }
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="hdr-mobile-panel"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="hdr-mobile-inner">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.key}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={link.path}
                    onClick={() => handleNav(link.path)}
                    className={`hdr-mlink${link.isSpecial ? " special" : location.pathname === link.path ? " active" : ""}`}
                  >
                    {link.isSpecial && <Crown style={{ width: "12px", height: "12px", flexShrink: 0 }} />}
                    <span style={{ flex: 1 }}>{link.name}</span>
                    {link.isSpecial && <Sparkles style={{ width: "10px", height: "10px", flexShrink: 0 }} />}
                  </Link>
                </motion.div>
              ))}

              <div className="hdr-mobile-bottom">
                {isLoggedIn && (
                  <button
                    className="hdr-logout"
                    style={{ textAlign: "left", padding: "8px 16px" }}
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = "/";
                    }}
                  >
                    Logout
                  </button>
                )}
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="hdr-wa-mobile">
                  <MessageCircle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                  {t("common.whatsappUs")}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
