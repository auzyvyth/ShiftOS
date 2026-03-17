import React from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const StickyWhatsAppButton = () => {
  const { t } = useTranslation();

  return (
    <motion.a
      href="https://wa.me/60174155191?text=Hi%20XDrive%2C%20I%20need%20help%20finding%20a%20car&20"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#25D366] text-white px-6 py-4 rounded-full shadow-2xl hover:shadow-[0_0_30px_rgba(37,211,102,0.5)] transition-all duration-300 group"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
      <span className="hidden sm:block font-semibold">{t('common.needHelp')}</span>
    </motion.a>
  );
};

export default StickyWhatsAppButton;