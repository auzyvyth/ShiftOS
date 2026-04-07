import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, MessageCircle, Sparkles, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSiteProfile } from "../hooks/useSiteProfile";
import { supabase } from "../supabaseClient";

const HDR_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');

  .hdr-root { font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif; }

  /* Glass */
  .hdr-glass {
    background: rgba(15,23,42,0.72);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .hdr-glass-scrolled {
    background: rgba(10,16,30,0.96);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-bottom: 1px solid rgba(255,255,255,0.09);
    box-shadow: 0 4px 32px rgba(0,0,0,0.35);
  }
  .hdr-dashboard {
    background: #030712;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }

  /* Inner nav */
  .hdr-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 20px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  /* Logo */
  .hdr-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; flex-shrink: 0;
  }
  .hdr-mark {
    width: 34px; height: 34px; border-radius: 9px;
    background: linear-gradient(135deg,#dc2626,#7c3aed);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 14px rgba(220,38,38,0.28);
    font-family: 'Syne', sans-serif;
    font-weight: 800; font-size: 15px; color: white;
  }
  .hdr-logo-text { display: flex; flex-direction: column; gap: 0; }
  .hdr-logo-name {
    font-family: 'Syne', sans-serif;
    font-size: 18px; font-weight: 800; color: white;
    letter-spacing: -0.02em; line-height: 1; white-space: nowrap;
  }
  .hdr-logo-sub {
    font-size: 8px; font-weight: 500; color: #475569;
    letter-spacing: 0.15em; text-transform: uppercase; white-space: nowrap;
  }

  /* Desktop nav links */
  .hdr-nav {
    display: flex; align-items: center; gap: 24px;
    flex: 1; justify-content: center;
  }
  .hdr-link {
    position: relative;
    font-size: 13px; font-weight: 500;
    color: rgba(203,213,225,0.8);
    text-decoration: none; white-space: nowrap;
    transition: color 0.2s; padding: 4px 0;
  }
  .hdr-link::after {
    content: ''; position: absolute;
    bottom: -1px; left: 0; width: 0; height: 1.5px;
    background: #dc2626; border-radius: 2px;
    transition: width 0.22s ease;
  }
  .hdr-link:hover { color: white; }
  .hdr-link:hover::after { width: 100%; }
  .hdr-link.active { color: white; }
  .hdr-link.active::after { width: 100%; }

  /* Dealer pill */
  .hdr-dealer {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11.5px; font-weight: 600; color: #f87171;
    background: rgba(220,38,38,0.1);
    border: 1px solid rgba(220,38,38,0.25);
    border-radius: 40px; padding: 5px 13px;
    text-decoration: none; white-space: nowrap;
    transition: all 0.2s ease;
  }
  .hdr-dealer:hover {
    background: rgba(220,38,38,0.18);
    border-color: rgba(220,38,38,0.45);
    transform: translateY(-1px);
  }

  /* Desktop right actions */
  .hdr-actions {
    display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }

  /* Lang */
  .hdr-lang {
    display: flex; align-items: center; gap: 1px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 40px; padding: 3px;
  }
  .hdr-lang-btn {
    padding: 3px 9px; border-radius: 40px;
    font-size: 10.5px; font-weight: 600;
    border: none; cursor: pointer; transition: all 0.18s;
    background: transparent; color: #64748b;
    letter-spacing: 0.04em; font-family: inherit;
  }
  .hdr-lang-btn.on {
    background: rgba(220,38,38,0.12);
    border: 1px solid rgba(220,38,38,0.28);
    color: #f87171;
  }

  /* WA button */
  .hdr-wa {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12.5px; font-weight: 600; color: white;
    background: rgba(37,211,102,0.1);
    border: 1px solid rgba(37,211,102,0.28);
    border-radius: 40px; padding: 7px 16px;
    text-decoration: none; white-space: nowrap;
    transition: all 0.2s ease; font-family: inherit;
  }
  .hdr-wa:hover {
    background: rgba(37,211,102,0.2);
    border-color: rgba(37,211,102,0.5);
    transform: translateY(-1px);
  }

  /* Logout */
  .hdr-logout {
    font-size: 12px; color: #64748b;
    background: none; border: none; cursor: pointer;
    padding: 5px 8px; border-radius: 8px;
    transition: color 0.2s; font-family: inherit;
  }
  .hdr-logout:hover { color: #cbd5e1; }

  /* Mobile burger button */
  .hdr-burger {
    padding: 7px; border-radius: 9px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    cursor: pointer; display: flex;
    align-items: center; justify-content: center;
    transition: background 0.2s;
  }
  .hdr-burger:hover { background: rgba(255,255,255,0.1); }

  /* ── Responsive show/hide ── */
  .hdr-desktop { display: flex; align-items: center; gap: 10px; }
  .hdr-mobile-only { display: none; }

  @media (max-width: 1024px) {
    .hdr-desktop { display: none !important; }
    .hdr-mobile-only { display: flex !important; }
    .hdr-nav { display: none !important; }
  }

  /* Mobile menu panel */
  .hdr-mobile-panel {
    position: fixed; top: 60px; left: 0; right: 0; z-index: 40;
    background: rgba(10,16,30,0.98);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.07);
    max-height: calc(100vh - 60px);
    overflow-y: auto;
  }
  .hdr-mobile-inner {
    max-width: 1280px; margin: 0 auto;
    padding: 10px 16px 20px;
    display: flex; flex-direction: column; gap: 3px;
  }
  .hdr-mlink {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; border-radius: 11px;
    font-size: 14px; font-weight: 500; color: #94a3b8;
    text-decoration: none; transition: all 0.16s;
    border: 1px solid transparent;
  }
  .hdr-mlink:hover { background: rgba(255,255,255,0.05); color: white; }
  .hdr-mlink.active { background: rgba(255,255,255,0.04); color: white; }
  .hdr-mlink.special {
    color: #f87171;
    background: rgba(220,38,38,0.07);
    border-color: rgba(220,38,38,0.14);
  }
  .hdr-mlink.special:hover { background: rgba(220,38,38,0.12); }

  .hdr-mobile-bottom {
    margin-top: 12px; padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.06);
    display: flex; flex-direction: column; gap: 10px;
  }
  .hdr-mobile-lang {
    display: flex; align-items: center; gap: 6px;
    padding: 4px 14px;
  }
  .hdr-mobile-lang-label {
    font-size: 10px; color: #475569; text-transform: uppercase;
    letter-spacing: 0.12em; margin-right: 4px;
  }
  .hdr-wa-mobile {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 14px; font-weight: 600; color: white;
    background: rgba(37,211,102,0.1);
    border: 1px solid rgba(37,211,102,0.28);
    border-radius: 13px; padding: 13px 20px;
    text-decoration: none; transition: all 0.2s; font-family: inherit;
  }
  .hdr-wa-mobile:hover { background: rgba(37,211,102,0.2); }
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
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
  const toggleLang = () =>
    i18n.changeLanguage(i18n.language.startsWith("en") ? "ms" : "en");
  const isEn = i18n.language.startsWith("en");
  const waHref = waUrl
    ? waUrl(`Hi ${siteName}, I need help finding a car`)
    : "#";

  const navLinks = [
    { name: t("nav.home"), path: "/", key: "home" },
    { name: t("nav.browseCars"), path: "/cars", key: "cars" },
    { name: t("nav.calculator"), path: "/calculator", key: "calculator" },
    { name: t("nav.howItWorks"), path: "/#how-it-works", key: "howitworks" },
    {
      name: "For Dealers",
      path: "/shiftos",
      key: "dealers",
      isSpecial: true,
    },
  ];
  if (isLoggedIn)
    navLinks.push({
      name: t("nav.dashboard"),
      path: dashboardPath,
      key: "dashboard",
    });
  else navLinks.push({ name: t("nav.login"), path: "/login", key: "login" });

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
                {siteName}
                <span style={{ color: "#dc2626" }}>.</span>
              </span>
              <span className="hdr-logo-sub">Trusted Auto</span>
            </div>
          </Link>

          {/* Desktop nav — hidden on ≤1024px via CSS */}
          <nav className="hdr-nav">
            {navLinks.map((link) =>
              link.isSpecial ? (
                <Link key={link.key} to={link.path} className="hdr-dealer">
                  <Crown
                    style={{ width: "11px", height: "11px", flexShrink: 0 }}
                  />
                  {link.name}
                  <Sparkles
                    style={{ width: "10px", height: "10px", flexShrink: 0 }}
                  />
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
              ),
            )}
          </nav>

          {/* Desktop right actions — hidden on ≤1024px */}
          <div className="hdr-actions hdr-desktop">
            <div className="hdr-lang">
              <button
                onClick={toggleLang}
                className={`hdr-lang-btn${isEn ? " on" : ""}`}
              >
                EN
              </button>
              <button
                onClick={toggleLang}
                className={`hdr-lang-btn${!isEn ? " on" : ""}`}
              >
                BM
              </button>
            </div>
            {isLoggedIn && (
              <button
                className="hdr-logout"
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = 'https://xdrive.my';
                }}
              >
                Logout
              </button>
            )}
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="hdr-wa"
            >
              <MessageCircle
                style={{ width: "13px", height: "13px", flexShrink: 0 }}
              />
              {t("common.whatsappUs")}
            </a>
          </div>

          {/* Mobile burger — shown on ≤1024px only */}
          <div
            className="hdr-mobile-only"
            style={{ alignItems: "center", gap: "8px" }}
          >
            <div className="hdr-lang">
              <button
                onClick={toggleLang}
                className={`hdr-lang-btn${isEn ? " on" : ""}`}
              >
                EN
              </button>
              <button
                onClick={toggleLang}
                className={`hdr-lang-btn${!isEn ? " on" : ""}`}
              >
                BM
              </button>
            </div>
            <button
              className="hdr-burger"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Menu"
            >
              {mobileOpen ? (
                <X style={{ width: "17px", height: "17px", color: "white" }} />
              ) : (
                <Menu
                  style={{ width: "17px", height: "17px", color: "#94a3b8" }}
                />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="hdr-mobile-panel"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="hdr-mobile-inner">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.key}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    to={link.path}
                    onClick={() => handleNav(link.path)}
                    className={`hdr-mlink${link.isSpecial ? " special" : location.pathname === link.path ? " active" : ""}`}
                  >
                    {link.isSpecial && (
                      <Crown
                        style={{ width: "13px", height: "13px", flexShrink: 0 }}
                      />
                    )}
                    <span style={{ flex: 1 }}>{link.name}</span>
                    {link.isSpecial && (
                      <Sparkles
                        style={{ width: "11px", height: "11px", flexShrink: 0 }}
                      />
                    )}
                  </Link>
                </motion.div>
              ))}

              <div className="hdr-mobile-bottom">
                {isLoggedIn && (
                  <button
                    className="hdr-logout"
                    style={{ textAlign: "left", padding: "8px 14px" }}
                    onClick={async () => {
                      await supabase.auth.signOut();
                      window.location.href = "/";
                    }}
                  >
                    Logout
                  </button>
                )}
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hdr-wa-mobile"
                >
                  <MessageCircle
                    style={{ width: "16px", height: "16px", flexShrink: 0 }}
                  />
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
