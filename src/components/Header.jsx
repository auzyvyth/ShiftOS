
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, MessageCircle, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isDashboard = location.pathname.startsWith('/dashboard');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleLanguage = () => {
    const newLang = i18n.language.startsWith('en') ? 'ms' : 'en';
    i18n.changeLanguage(newLang);
  };

  const token = localStorage.getItem('authToken');
  const navLinks = [
    { name: t('nav.home'), path: '/' },
    { name: t('nav.browseCars'), path: '/cars' },
    { name: t('nav.calculator'), path: '/calculator' },
    { name: t('nav.howItWorks'), path: '/#how-it-works' },
    { name: t('nav.contact'), path: '/#contact' },
  ];
  if (token) {
    navLinks.push({ name: t('nav.dashboard'), path: '/dashboard' });
  } else {
    navLinks.push({ name: t('nav.login'), path: '/login' });
  }

  const handleNavClick = (path) => {
    setIsMobileMenuOpen(false);
    if (path.includes('#') && location.pathname === '/') {
      const id = path.split('#')[1];
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          isDashboard
            ? 'bg-purple-700 text-white'
            : isScrolled
            ? 'bg-white shadow-lg'
            : 'bg-white/95 backdrop-blur-sm'
        }`}
      >
        <nav className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-[#1E3A8A] text-white font-bold text-2xl w-10 h-10 flex items-center justify-center rounded-full">
                X
              </div>
              <span className="text-2xl font-bold text-[#1E3A8A]">Drive</span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-6 xl:gap-8">
              {navLinks.map((link) => (
                link.path.includes('#') ? (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => handleNavClick(link.path)}
                    className={`font-medium transition-colors ${
                      isDashboard
                        ? 'text-white hover:text-purple-200'
                        : 'text-gray-700 hover:text-[#1E3A8A]'
                    }`}
                  >
                    {link.name}
                  </Link>
                ) : (
                  <Link
                    key={link.name}
                    to={link.path}
                    className={`font-medium transition-colors ${
                      isDashboard
                        ? 'text-white hover:text-purple-200'
                        : `hover:text-[#1E3A8A] ${
                            location.pathname === link.path ? 'text-[#1E3A8A]' : 'text-gray-700'
                          }`
                    }`}
                  >
                    {link.name}
                  </Link>
                )
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-4">
              {/* Language Switcher */}
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-2 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 text-[#1E3A8A] px-3 py-2 rounded-full font-medium transition-colors"
                aria-label="Toggle language"
              >
                <Globe className="w-4 h-4" />
                <span className={i18n.language.startsWith('en') ? 'font-bold' : ''}>EN</span>
                <span className="opacity-50">|</span>
                <span className={i18n.language.startsWith('ms') ? 'font-bold' : ''}>BM</span>
              </button>

              {/* Desktop WhatsApp Button */}
              {token && (
                <button
                  onClick={() => { localStorage.removeItem('authToken'); window.location.href = '/'; }}
                  className="font-medium text-gray-700 hover:text-[#1E3A8A] mr-4"
                >
                  Logout
                </button>
              )}
              <a
                href="https://wa.me/60174155191?text=Hi%20XDrive%2C%20I%20need%20help%20finding%20a%20car"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#25D366] text-white px-5 py-2.5 rounded-full font-semibold hover:bg-[#25D366]/90 transition-colors shadow-md hover:shadow-lg"
              >
                <MessageCircle className="w-5 h-5" />
                {t('common.whatsappUs')}
              </a>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex lg:hidden items-center gap-3">
              <button
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 bg-[#1E3A8A]/5 hover:bg-[#1E3A8A]/10 text-[#1E3A8A] px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span className={i18n.language.startsWith('en') ? 'font-bold' : ''}>EN</span>
                <span className="opacity-50">|</span>
                <span className={i18n.language.startsWith('ms') ? 'font-bold' : ''}>BM</span>
              </button>
              
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Toggle mobile menu"
              >
                {isMobileMenuOpen ? (
                  <X className="w-6 h-6 text-gray-700" />
                ) : (
                  <Menu className="w-6 h-6 text-gray-700" />
                )}
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-[72px] left-0 right-0 bg-white shadow-xl z-30 lg:hidden"
          >
            <div className="container mx-auto px-4 py-6 space-y-4">
              {navLinks.map((link) => (
                link.path.includes('#') ? (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => handleNavClick(link.path)}
                    className={`block w-full text-left font-medium py-2 transition-colors ${
                      isDashboard
                        ? 'text-white hover:text-purple-200'
                        : 'text-gray-700 hover:text-[#1E3A8A]'
                    }`}
                  >
                    {link.name}
                  </Link>
                ) : (
                  <Link
                    key={link.name}
                    to={link.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`block font-medium py-2 transition-colors ${
                      isDashboard
                        ? 'text-white hover:text-purple-200'
                        : 'text-gray-700 hover:text-[#1E3A8A]'
                    }`}
                  >
                    {link.name}
                  </Link>
                )
              ))}
              <div className="pt-2 border-t border-gray-100">
                <a
                  href="https://wa.me/60174155191?text=Hi%20XDrive%2C%20I%20need%20help%20finding%20a%20car"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 bg-[#25D366] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#25D366]/90 transition-colors w-full"
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
