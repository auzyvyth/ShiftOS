import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSiteProfile } from '../hooks/useSiteProfile';

export default function StickyWhatsAppButton({ phoneNumber, message }) {
  const { t } = useTranslation();
  const { waUrl } = useSiteProfile();

  // If phoneNumber prop is passed explicitly, use it; otherwise fall back to profile
  const url = phoneNumber
    ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message || t('common.needHelp'))}`
    : waUrl(message || t('common.needHelp'));

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center justify-center bg-[#25D366] text-white w-14 h-14 rounded-full shadow-2xl hover:shadow-[0_0_30px_rgba(37,211,102,0.5)] transition-all duration-300 group"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
    </motion.a>
  );
}
