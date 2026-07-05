import { useState, useEffect } from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSiteProfile } from '../hooks/useSiteProfile';
import { useCTAContext, buildWaUrl } from '../hooks/useCTAContext';
import { supabase } from '../supabaseClient';
import { trackEvent, getSlugFromURL, getOrCreateSessionId } from '../utils/analytics';
import ContactGate from './ContactGate';

export default function StickyWhatsAppButton({ phoneNumber, message }) {
  const { t } = useTranslation();
  const { waUrl, profile: tenant } = useSiteProfile();
  const ctaCtx = useCTAContext();
  const [gateOpen, setGateOpen] = useState(false);

  // On mobile the button is distracting floating over the hero, so it stays gone
  // until the user scrolls down past the hero (>140px), then stays put while
  // they're scrolled in. Desktop (>=768px) always shows it. Initial state is
  // derived from the viewport so it doesn't flash in on a mobile page load.
  const [visible, setVisible] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      setVisible(window.innerWidth >= 768 ? true : window.scrollY > 140);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  const msg = message || t('common.needHelp');

  let url;
  if (phoneNumber) {
    url = `https://wa.me/${phoneNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
  } else if (ctaCtx.type === 'salesman') {
    url = buildWaUrl(ctaCtx, null, msg);
  } else {
    url = waUrl(msg);
  }

  const handleClick = () => {
    const dealerId = tenant?.id || null;
    trackEvent(supabase, 'whatsapp_click', {
      dealer_id: dealerId,
      metadata: { source: 'sticky_button' },
    });
    if (dealerId) {
      supabase.from('whatsapp_enquiries').insert({
        dealer_id: dealerId,
        buyer_name: null,
        buyer_phone: null,
        buyer_message: msg,
        source: 'sticky_button',
        status: 'new',
        ref_slug: getSlugFromURL() || null,
        session_id: getOrCreateSessionId(),
      }).then(() => {});
    }
  };

  const dealerId = tenant?.id || null;

  return (
    <>
      <motion.a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          // On a dealer storefront, capture the buyer's name first (creates a
          // pipeline lead). On the generic marketplace (no dealer) go direct.
          if (dealerId) { e.preventDefault(); setGateOpen(true); }
          else handleClick();
        }}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center bg-[#25D366] text-white w-14 h-14 rounded-full shadow-2xl hover:shadow-[0_0_30px_rgba(37,211,102,0.5)] transition-shadow duration-300 group"
        style={{ pointerEvents: visible ? 'auto' : 'none' }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 20 }}
        transition={{ duration: 0.3 }}
        aria-hidden={!visible}
      >
        <MessageCircle className="w-6 h-6 group-hover:rotate-12 transition-transform duration-300" />
      </motion.a>
      <ContactGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        waUrl={url}
        dealerId={dealerId}
        carId={null}
        onConfirmed={handleClick}
      />
    </>
  );
}
