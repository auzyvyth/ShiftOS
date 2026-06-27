import { useState } from 'react';
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
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center bg-[#25D366] text-white w-14 h-14 rounded-full shadow-2xl hover:shadow-[0_0_30px_rgba(37,211,102,0.5)] transition-all duration-300 group"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
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
