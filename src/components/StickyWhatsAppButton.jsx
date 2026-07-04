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

  // On mobile the button is distracting when it floats over the hero, so it only
  // shows once the user scrolls down, and hides again when scrolling back up or
  // near the top. On desktop (>=768px) it stays put.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isMobile = () => window.innerWidth < 768;
    if (!isMobile()) { setVisible(true); return; }
    let last = window.scrollY;
    setVisible(window.scrollY > 140);
    const onScroll = () => {
      if (!isMobile()) { setVisible(true); return; }
      const y = window.scrollY;
      if (y < 140) setVisible(false);
      else if (y > last + 4) setVisible(true);
      else if (y < last - 4) setVisible(false);
      last = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
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
