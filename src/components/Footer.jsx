import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle, Mail, Clock, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSiteProfile } from '../hooks/useSiteProfile';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();
  const { siteName, siteInitial, waUrl, profile } = useSiteProfile();
  const fbUrl   = profile?.social_facebook  ? `https://facebook.com/${profile.social_facebook.replace(/^@/,'')}` : 'https://facebook.com';
  const igUrl   = profile?.social_instagram ? `https://instagram.com/${profile.social_instagram.replace(/^@/,'')}` : 'https://instagram.com';
  const waPhone = profile?.whatsapp_number ? (profile.whatsapp_number.replace(/\D/g,'').startsWith('60') ? profile.whatsapp_number.replace(/\D/g,'') : `60${profile.whatsapp_number.replace(/\D/g,'')}`) : '60174155191';
  const waDisplay = waPhone.replace(/^60/, '+60 ').replace(/(\d{2})(\d{3,4})(\d{4})$/, '$1-$2 $3');

  return (
    <footer
      style={{
        background: '#080C14',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

          {/* Col 1: Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-2.5 mb-4 group w-fit">
              <div className="relative w-9 h-9 flex items-center justify-center flex-shrink-0">
                <div className="absolute inset-0 bg-red-600 rounded-lg rotate-6 group-hover:rotate-12 transition-transform duration-300" />
                <span className="relative text-white font-black text-lg" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>{siteInitial}</span>
              </div>
              <span className="text-white font-bold text-xl tracking-tight">
                {siteName}<span className="text-red-500">.</span>
              </span>
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">{t('footer.tagline')}</p>
            <div className="flex gap-3">
              <a href={fbUrl} target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                aria-label="Facebook"
              >
                <Facebook className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
              </a>
              <a href={igUrl} target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4 text-gray-400 hover:text-white transition-colors" />
              </a>
              <a href={waUrl()} target="_blank" rel="noopener noreferrer"
                className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{ background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.25)' }}
                aria-label="WhatsApp"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
              </a>
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <p className="text-white text-sm font-semibold uppercase tracking-wider mb-5">{t('footer.quickLinks')}</p>
            <ul className="space-y-3">
              {[
                { label: t('nav.browseCars'), path: '/cars'          },
                { label: t('nav.howItWorks'), path: '/#how-it-works' },
                { label: t('nav.calculator'), path: '/calculator'    },
                { label: 'For Dealers',       path: '/for-dealers'   },
              ].map(link => (
                <li key={link.path}>
                  <Link to={link.path}
                    className="text-gray-500 hover:text-white text-sm transition-colors flex items-center gap-1.5 group"
                  >
                    <ArrowRight className="w-3 h-3 text-red-600 opacity-0 group-hover:opacity-100 -ml-4 group-hover:ml-0 transition-all" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Contact */}
          <div>
            <p className="text-white text-sm font-semibold uppercase tracking-wider mb-5">{t('footer.contactUs')}</p>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#25D366]" />
                <div>
                  <p className="text-white text-sm font-medium">{t('footer.whatsapp')}</p>
                  <a href={waUrl()}
                    className="text-gray-500 hover:text-white text-sm transition-colors">
                    {waDisplay}
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                <div>
                  <p className="text-white text-sm font-medium">{t('footer.email')}</p>
                  <a href="mailto:info@drevo.my"
                    className="text-gray-500 hover:text-white text-sm transition-colors">
                    info@drevo.my
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-600" />
                <div>
                  <p className="text-white text-sm font-medium">{t('footer.hours')}</p>
                  <p className="text-gray-500 text-sm">{t('footer.hoursText')}</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Col 4: ShiftOS CTA */}
          <div>
            <p className="text-white text-sm font-semibold uppercase tracking-wider mb-5">For Dealers</p>
            <div
              className="rounded-xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(220,38,38,0.03) 100%)',
                border: '1px solid rgba(220,38,38,0.15)',
              }}
            >
              <p className="text-white text-sm font-semibold mb-1">Manage with ShiftOS</p>
              <p className="text-gray-500 text-xs leading-relaxed mb-3">The all-in-one SaaS platform for Malaysian used car dealers.</p>
              <Link
                to="/for-dealers"
                className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 text-xs font-semibold transition-colors group"
              >
                Learn more
                <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p>&copy; {currentYear} {siteName}. {t('footer.rights')}</p>
          <p>Powered by <span className="text-red-600 font-semibold">ShiftOS</span></p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;