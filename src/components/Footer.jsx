
import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, MessageCircle, Mail, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();

  return (
    <footer className="bg-[#1F2937] text-white">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          {/* Column 1: Logo and Social */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-[#1E3A8A] text-white font-bold text-2xl px-3 py-1 rounded-lg">
                X
              </div>
              <span className="text-2xl font-bold">Drive</span>
            </div>
            <p className="text-gray-300 mb-6">{t('footer.tagline')}</p>
            <div className="flex gap-4">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
                aria-label="Visit our Facebook page"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
                aria-label="Visit our Instagram page"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="https://wa.me/60174155191"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#25D366] hover:bg-[#25D366]/90 p-3 rounded-full transition-colors"
                aria-label="Chat with us on WhatsApp"
              >
                <MessageCircle className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div>
            <p className="text-xl font-bold mb-4">{t('footer.quickLinks')}</p>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/cars"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {t('nav.browseCars')}
                </Link>
              </li>
              <li>
                <Link
                  to="/#how-it-works"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {t('nav.howItWorks')}
                </Link>
              </li>
              <li>
                <Link
                  to="/calculator"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {t('nav.calculator')}
                </Link>
              </li>
              <li>
                <Link
                  to="/#contact"
                  className="text-gray-300 hover:text-white transition-colors"
                >
                  {t('nav.contact')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact Us */}
          <div>
            <p className="text-xl font-bold mb-4">{t('footer.contactUs')}</p>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 mt-1 flex-shrink-0 text-[#25D366]" />
                <div>
                  <p className="font-semibold">{t('footer.whatsapp')}</p>
                  <a
                    href="https://wa.me/60174155191"
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    +60 17-415 5191
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 mt-1 flex-shrink-0 text-[#1E3A8A]" />
                <div>
                  <p className="font-semibold">{t('footer.email')}</p>
                  <a
                    href="mailto:info@xdrive.my"
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    info@xdrive.my
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Clock className="w-5 h-5 mt-1 flex-shrink-0 text-[#1E3A8A]" />
                <div>
                  <p className="font-semibold">{t('footer.hours')}</p>
                  <p className="text-gray-300">{t('footer.hoursText')}</p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-700 pt-8 text-center text-gray-400">
          <p>&copy; {currentYear} {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
