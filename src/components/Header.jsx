import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, MessageCircle, Globe, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const Header = () => {
  const [isScrolled, setIsScrolled]       = useState(false);
  const [isMobileMenuOpen, setMobileMenu] = useState(false);
  const location  = useLocation();
  const { t, i18n } = useTranslation();
  const isDashboard = location.pathname.startsWith('/dashboard');
  const token = localStorage.getItem('authToken');

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language.startsWith('en') ? 'ms' : 'en');
  };

  const navLinks = [
    { name: t('nav.home'),       path: '/'            },
    { name: t('nav.browseCars'), path: '/cars'         },
    { name: t('nav.calculator'), path: '/calculator'   },
    { name: t('nav.howItWorks'), path: '/#how-it-works'},
    { name: 'For Dealers',       path: '/for-dealers'  },
  ];
  if (token) {
    navLinks.push({ name: t('nav.dashboard'), path: '/dashboard' });
  } else {
    navLinks.push({ name: t('nav.login'), path: '/login' });
  }

  const handleNavClick = (path) => {
    setMobileMenu(false);
    if (path.includes('#') && location.pathname === '/') {
      const el = document.getElementById(path.split('#')[1]);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <>
      {/* ── Keyframes injected once ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Bebas+Neue&display=swap');

        .nav-link-line::after {
          content: '';
          display: block;
          height: 2px;
          width: 0;
          background: #dc2626;
          transition: width 0.25s ease;
          margin-top: 2px;
        }
        .nav-link-line:hover::after,
        .nav-link-line.active::after { width: 100%; }

        .dealer-badge {
          background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
          box-shadow: 0 0 12px rgba(220,38,38,0.4);
        }

        .shine-btn {
          position: relative;
          overflow: hidden;
        }
        .shine-btn::before {
          content: '';
          position: absolute;
          top: 0; left: -75%;
          width: 50%; height: 100%;
          background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
          transform: skewX(-20deg);
          transition: left 0.5s ease;
        }
        .shine-btn:hover::before { left: 125%; }

        .glass-nav {
          background: rgba(8, 12, 20, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .glass-nav-solid {
          background: rgba(8, 12, 20, 0.98);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(220,38,38,0.15);
        }
      `}</style>

      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isDashboard
            ? 'bg-gray-950 border-b border-gray-800'
            : isScrolled ? 'glass-nav-solid shadow-2xl' : 'glass-nav'
        }`}
        style={{ fontFamily: "'DM Sans', sans-serif" }}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">

            {/* ── Logo ── */}
            <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="relative w-9 h-9 flex items-center justify-center">
                <div className="absolute inset-0 bg-red-600 rounded-lg rotate-6 group-hover:rotate-12 transition-transform duration-300" />
                <span className="relative text-white font-black text-lg" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.05em' }}>D</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">
                Drevo<span className="text-red-500">.</span>
              </span>
            </Link>

            {/* ── Desktop Nav ── */}
            <div className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) =>
                link.name === 'For Dealers' ? (
                  <Link
                    key={link.name}
                    to={link.path}
                    className="dealer-badge text-white text-xs font-bold px-3 py-1.5 rounded-full tracking-wide uppercase shine-btn"
                  >
                    For Dealers
                  </Link>
                ) : (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => handleNavClick(link.path)}
                    className={`nav-link-line text-sm font-medium transition-colors duration-200 ${
                      location.pathname === link.path
                        ? 'text-white active'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {link.name}
                  </Link>
                )
              )}
            </div>

            {/* ── Desktop Right ── */}
            <div className="hidden lg:flex items-center gap-3">
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm font-medium transition-colors px-2 py-1.5 rounded-lg hover:bg-white/5"
              >
                <Globe className="w-4 h-4" />
                <span className={i18n.language.startsWith('en') ? 'text-white font-semibold' : ''}>EN</span>
                <span className="text-gray-600">/</span>
                <span className={i18n.language.startsWith('ms') ? 'text-white font-semibold' : ''}>BM</span>
              </button>

              {token && (
                <button
                  onClick={() => { localStorage.removeItem('authToken'); window.location.href = '/'; }}
                  className="text-sm text-gray-400 hover:text-white transition-colors px-3 py-2"
                >
                  Logout
                </button>
              )}

              <a
                href="https://wa.me/60174155191?text=Hi%20Drevo%2C%20I%20need%20help%20finding%20a%20car"
                target="_blank"
                rel="noopener noreferrer"
                className="shine-btn flex items-center gap-2 bg-[#25D366] text-white text-sm px-5 py-2.5 rounded-full font-semibold hover:bg-[#22c55e] transition-colors shadow-lg shadow-green-900/30"
              >
                <MessageCircle className="w-4 h-4" />
                {t('common.whatsappUs')}
              </a>
            </div>

            {/* ── Mobile Right ── */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                onClick={toggleLanguage}
                className="text-gray-400 hover:text-white text-xs font-medium px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1"
              >
                <Globe className="w-3.5 h-3.5" />
                {i18n.language.startsWith('en') ? 'EN' : 'BM'}
              </button>
              <button
                onClick={() => setMobileMenu(!isMobileMenuOpen)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                {isMobileMenuOpen
                  ? <X className="w-5 h-5 text-white" />
                  : <Menu className="w-5 h-5 text-gray-300" />
                }
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* ── Mobile Menu ── */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed top-[60px] left-0 right-0 z-40 lg:hidden"
            style={{
              background: 'rgba(8,12,20,0.97)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid rgba(220,38,38,0.15)',
              fontFamily: "'DM Sans', sans-serif"
            }}
          >
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => handleNavClick(link.path)}
                  className={`block py-3 px-3 rounded-lg font-medium transition-colors text-sm ${
                    link.name === 'For Dealers'
                      ? 'text-red-400 font-bold'
                      : location.pathname === link.path
                      ? 'text-white bg-white/5'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              <div className="pt-4 border-t border-white/5 mt-4">
                <a
                  href="https://wa.me/60174155191?text=Hi%20Drevo%2C%20I%20need%20help%20finding%20a%20car"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shine-btn flex items-center justify-center gap-2 bg-[#25D366] text-white px-6 py-3.5 rounded-full font-semibold hover:bg-[#22c55e] transition-colors w-full"
                >
                  <MessageCircle className="w-5 h-5" />
                  {t('common.whatsappUs')}
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;