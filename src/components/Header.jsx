import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, MessageCircle, Sparkles, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useSiteProfile } from "../hooks/useSiteProfile";
import { supabase } from "../supabaseClient";
import { isSubdomain } from "../hooks/useTenant";

const HDR_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

  .hdr-root {
    font-family: 'Outfit', sans-serif;
    position: relative;
    border-radius: 22px;
    transition: background 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease;
  }


  /* ── Glass states — no solid colours anywhere ── */
  .hdr-glass {
    background: rgba(9, 9, 14, 0.38);
    backdrop-filter: blur(40px) saturate(180%) brightness(1.1);
    -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.1);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.05),
      0 4px 28px rgba(0,0,0,0.28),
      0 1px 0 rgba(0,0,0,0.15);
  }

  .hdr-glass-scrolled {
    background: rgba(9, 9, 14, 0.72);
    backdrop-filter: blur(52px) saturate(200%) brightness(1.05);
    -webkit-backdrop-filter: blur(52px) saturate(200%) brightness(1.05);
    border: 1px solid rgba(255,255,255,0.11);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.09),
      0 12px 56px rgba(0,0,0,0.55),
      0 2px 8px rgba(0,0,0,0.35);
  }

  /* Dashboard: glass too — no more solid background */
  .hdr-dashboard {
    background: rgba(9, 9, 14, 0.82);
    backdrop-filter: blur(52px) saturate(160%);
    -webkit-backdrop-filter: blur(52px) saturate(160%);
    border: 1px solid rgba(255,255,255,0.07);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.07),
      0 8px 36px rgba(0,0,0,0.45);
  }

  /* ── Inner ── */
  .hdr-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 22px;
    height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    position: relative;
    z-index: 1;
  }

  /* ── Logo ── */
  .hdr-logo {
    display: flex; align-items: center; gap: 10px;
    text-decoration: none; flex-shrink: 0;
  }
  .hdr-mark {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: #DC2626;
    box-shadow: 0 0 0 1px rgba(220,38,38,0.35), 0 4px 14px rgba(220,38,38,0.25);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    font-family: 'Outfit', sans-serif;
    font-weight: 800; font-size: 14px; color: white;
    letter-spacing: -0.01em;
    transition: box-shadow 0.3s;
  }
  .hdr-logo:hover .hdr-mark {
    box-shadow: 0 0 0 1px rgba(220,38,38,0.55), 0 6px 22px rgba(220,38,38,0.35);
  }
  .hdr-logo-text { display: flex; flex-direction: column; }
  .hdr-logo-name {
    font-family: 'Outfit', sans-serif;
    font-size: 16px; font-weight: 700; color: #F0F0F0;
    letter-spacing: -0.02em; line-height: 1.1; white-space: nowrap;
  }
  .hdr-logo-sub {
    font-size: 8px; font-weight: 500; color: rgba(255,255,255,0.18);
    letter-spacing: 0.2em; text-transform: uppercase; white-space: nowrap;
    margin-top: 1px;
  }

  /* ── Desktop nav ── */
  .hdr-nav {
    display: flex; align-items: center; gap: 30px;
    flex: 1; justify-content: center;
  }
  .hdr-link {
    position: relative;
    font-size: 13px; font-weight: 500;
    color: rgba(140,140,150,0.85);
    text-decoration: none; white-space: nowrap;
    transition: color 0.22s; padding: 5px 0;
    letter-spacing: 0.01em;
  }
  .hdr-link::after {
    content: ''; position: absolute;
    bottom: 0; left: 50%; right: 50%; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
    transition: left 0.28s ease, right 0.28s ease;
    border-radius: 1px;
  }
  .hdr-link:hover { color: rgba(240,240,240,0.95); }
  .hdr-link:hover::after { left: 0; right: 0; }
  .hdr-link.active { color: #F0F0F0; }
  .hdr-link.active::after { left: 0; right: 0; }

  /* ── For Dealers pill ── */
  .hdr-dealer {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; font-weight: 600; color: #F87171;
    background: rgba(220,38,38,0.07);
    border: 1px solid rgba(220,38,38,0.18);
    border-radius: 50px; padding: 5px 13px;
    text-decoration: none; white-space: nowrap;
    transition: all 0.22s ease; letter-spacing: 0.02em;
    box-shadow: 0 0 14px rgba(220,38,38,0.05);
  }
  .hdr-dealer:hover {
    background: rgba(220,38,38,0.12);
    border-color: rgba(220,38,38,0.35);
    box-shadow: 0 0 18px rgba(220,38,38,0.12);
    transform: translateY(-1px);
  }

  /* ── Desktop right actions ── */
  .hdr-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

  /* ── Lang toggle ── */
  .hdr-lang {
    display: flex; align-items: center;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 50px; padding: 3px;
  }
  .hdr-lang-btn {
    padding: 3px 10px; border-radius: 50px;
    font-size: 10px; font-weight: 600;
    border: none; cursor: pointer; transition: all 0.18s;
    background: transparent; color: rgba(255,255,255,0.22);
    letter-spacing: 0.06em; font-family: 'Outfit', sans-serif;
  }
  .hdr-lang-btn.on {
    background: rgba(220,38,38,0.1);
    border: 1px solid rgba(220,38,38,0.22);
    color: #F87171;
  }

  /* ── WhatsApp button ── */
  .hdr-wa {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 600; color: rgba(74,222,128,0.9);
    background: rgba(37,211,102,0.05);
    border: 1px solid rgba(37,211,102,0.18);
    border-radius: 50px; padding: 7px 15px;
    text-decoration: none; white-space: nowrap;
    transition: all 0.22s ease; font-family: 'Outfit', sans-serif;
    letter-spacing: 0.02em;
  }
  .hdr-wa:hover {
    background: rgba(37,211,102,0.1);
    border-color: rgba(37,211,102,0.38);
    color: #4ADE80;
    box-shadow: 0 0 18px rgba(37,211,102,0.1);
    transform: translateY(-1px);
  }

  /* ── Logout ── */
  .hdr-logout {
    font-size: 11.5px; color: rgba(255,255,255,0.22);
    background: none; border: none; cursor: pointer;
    padding: 5px 10px; border-radius: 50px;
    transition: color 0.2s; font-family: 'Outfit', sans-serif;
    letter-spacing: 0.01em;
  }
  .hdr-logout:hover { color: rgba(255,255,255,0.55); }

  /* ── Mobile burger ── */
  .hdr-burger {
    padding: 8px; border-radius: 50%;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    cursor: pointer; display: flex;
    align-items: center; justify-content: center;
    transition: background 0.18s;
  }
  .hdr-burger:hover { background: rgba(255,255,255,0.08); }

  /* ── Responsive ── */
  .hdr-desktop { display: flex; align-items: center; gap: 10px; }
  .hdr-mobile-only { display: none; }

  @media (max-width: 1024px) {
    .hdr-desktop { display: none !important; }
    .hdr-mobile-only { display: flex !important; }
    .hdr-nav { display: none !important; }
  }

  /* ── Mobile panel — exact same glass as header pill ── */
  .hdr-mobile-panel {
    position: fixed;
    top: 82px;
    left: 16px;
    right: 16px;
    z-index: 40;
    border-radius: 18px;
    background: rgba(9, 9, 14, 0.52);
    backdrop-filter: blur(40px) saturate(180%) brightness(1.08);
    -webkit-backdrop-filter: blur(40px) saturate(180%) brightness(1.08);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.06),
      0 12px 48px rgba(0,0,0,0.45);
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    overflow-x: hidden;
  }
  /* Same specular top reflection as the header pill */
  .hdr-mobile-panel::before {
    content: '';
    position: absolute;
    top: 0; left: 12%; right: 12%;
    height: 1px;
    background: linear-gradient(90deg,
      transparent            0%,
      rgba(255,255,255,0.18) 18%,
      rgba(255,255,255,0.58) 38%,
      rgba(255,255,255,0.82) 50%,
      rgba(255,255,255,0.58) 62%,
      rgba(255,255,255,0.18) 82%,
      transparent            100%
    );
    border-radius: 100%;
    pointer-events: none;
  }
  .hdr-mobile-inner {
    max-width: 1280px; margin: 0 auto;
    padding: 10px 14px 22px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .hdr-mlink {
    display: flex; align-items: center; gap: 12px;
    padding: 12px 14px; border-radius: 12px;
    font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.3);
    text-decoration: none; transition: all 0.16s;
    border: 1px solid transparent; letter-spacing: 0.01em;
  }
  .hdr-mlink:hover { background: rgba(255,255,255,0.04); color: rgba(240,240,240,0.85); }
  .hdr-mlink.active { background: rgba(255,255,255,0.04); color: #F0F0F0; }
  .hdr-mlink.special {
    color: #F87171;
    background: rgba(220,38,38,0.05);
    border-color: rgba(220,38,38,0.1);
  }
  .hdr-mlink.special:hover { background: rgba(220,38,38,0.09); }

  .hdr-mobile-bottom {
    margin-top: 12px; padding-top: 14px;
    border-top: 1px solid rgba(255,255,255,0.05);
    display: flex; flex-direction: column; gap: 8px;
  }
  .hdr-wa-mobile {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 13px; font-weight: 600; color: rgba(74,222,128,0.9);
    background: rgba(37,211,102,0.05);
    border: 1px solid rgba(37,211,102,0.18);
    border-radius: 12px; padding: 13px 20px;
    text-decoration: none; transition: all 0.18s; font-family: 'Outfit', sans-serif;
    letter-spacing: 0.02em;
  }
  .hdr-wa-mobile:hover { background: rgba(37,211,102,0.1); color: #4ADE80; }
`;

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const lastScrollY = useRef(0);
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { siteName, siteInitial, waUrl } = useSiteProfile();

  const isDashboard =
    location.pathname.startsWith("/dashboard") ||
    location.pathname.startsWith("/salesman");

  useEffect(() => {
    const fn = () => {
      const current = window.scrollY;
      const delta = current - lastScrollY.current;
      setIsScrolled(current > 20);
      if (current < 20) {
        setHidden(false);
      } else if (delta > 6) {
        setHidden(true);
        setMobileOpen(false);
      } else if (delta < -6) {
        setHidden(false);
      }
      lastScrollY.current = current;
    };
    window.addEventListener("scroll", fn, { passive: true });
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

  const onSub = isSubdomain();
  const navLinks = onSub
    ? [
        { name: t("nav.home"),       path: "/",              key: "home" },
        { name: t("nav.browseCars"), path: "/showroom",      key: "cars" },
        { name: t("nav.calculator"), path: "/calculator",    key: "calculator" },
        { name: t("nav.howItWorks"), path: "/#how-it-works", key: "howitworks" },
      ]
    : [
        { name: t("nav.home"),       path: "/",              key: "home" },
        { name: t("nav.browseCars"), path: "/showroom",      key: "cars" },
        { name: t("nav.calculator"), path: "/calculator",    key: "calculator" },
        { name: t("nav.howItWorks"), path: "/#how-it-works", key: "howitworks" },
        { name: "For Dealers",       path: "/shiftos",       key: "dealers", isSpecial: true },
      ];
  if (isLoggedIn)
    navLinks.push({ name: t("nav.dashboard"), path: dashboardPath, key: "dashboard" });
  else
    navLinks.push({ name: t("nav.login"), path: "/login", key: "login" });

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
        style={{
          position: "fixed",
          top: "12px",
          left: "16px",
          right: "16px",
          zIndex: 50,
          transform: hidden ? "translateY(calc(-100% - 24px))" : "translateY(0)",
          transition: "transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease",
        }}
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
              ) : link.path.includes("#") ? (
                <button
                  key={link.key}
                  onClick={() => handleNav(link.path)}
                  className={`hdr-link`}
                  style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                >
                  {link.name}
                </button>
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
                  window.location.href = '/login';
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
                ? <X style={{ width: "16px", height: "16px", color: "rgba(255,255,255,0.7)" }} />
                : <Menu style={{ width: "16px", height: "16px", color: "rgba(255,255,255,0.4)" }} />
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
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="hdr-mobile-inner">
              {navLinks.map((link, i) => (
                <motion.div
                  key={link.key}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.035, ease: "easeOut" }}
                >
                  {link.path.includes("#") ? (
                    <button
                      onClick={() => handleNav(link.path)}
                      className="hdr-mlink"
                      style={{ background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left", fontFamily: "inherit" }}
                    >
                      <span style={{ flex: 1 }}>{link.name}</span>
                    </button>
                  ) : (
                    <Link
                      to={link.path}
                      onClick={() => handleNav(link.path)}
                      className={`hdr-mlink${link.isSpecial ? " special" : location.pathname === link.path ? " active" : ""}`}
                    >
                      {link.isSpecial && <Crown style={{ width: "12px", height: "12px", flexShrink: 0 }} />}
                      <span style={{ flex: 1 }}>{link.name}</span>
                      {link.isSpecial && <Sparkles style={{ width: "10px", height: "10px", flexShrink: 0 }} />}
                    </Link>
                  )}
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
