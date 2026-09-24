import React, { useEffect, useState } from 'react';
import { useMarketplaceTracking } from '../hooks/useMarketplaceTracking';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MarketplaceHeader from '@/components/MarketplaceHeader';
import Header from '@/components/Header';
import MarketplaceFooter from '../components/MarketplaceFooter';
import StickyWhatsAppButton from '@/components/StickyWhatsAppButton';
import FinancingCalculator from '@/components/FinancingCalculator';
import CalculatorInfoSection from '@/components/CalculatorInfoSection';
import { motion } from 'framer-motion';
import useTenant, { isSubdomain } from '../hooks/useTenant';

const CalculatorPage = () => {
  useMarketplaceTracking();
  const [searchParams] = useSearchParams();
  const [initialPrice,   setInitialPrice]   = useState(85000);
  const [engineCcParam,  setEngineCcParam]  = useState(null);
  const [bodyTypeParam,  setBodyTypeParam]  = useState(null);
  const { t } = useTranslation();
  const sub = isSubdomain(); // subdomain storefront = dark theme
  // On a dealer subdomain, quotations should be branded to that dealer; on the
  // root public page there is no seller yet, so the PDF falls back to XDrive.my
  // rather than guessing from whoever happens to be logged in.
  const { tenant } = useTenant();

  useEffect(() => {
    const priceParam = searchParams.get('carPrice');
    if (priceParam && !isNaN(parseFloat(priceParam))) setInitialPrice(parseFloat(priceParam));
    const ccParam = searchParams.get('engineCc');
    if (ccParam && !isNaN(parseInt(ccParam))) setEngineCcParam(parseInt(ccParam));
    const bt = searchParams.get('bodyType');
    if (bt) setBodyTypeParam(bt);
  }, [searchParams]);

  return (
    <>
      <Helmet>
        <title>{t('calculator.header.title')} | XDrive</title>
        <meta name="description" content={t('calculator.header.subtitle')} />
      </Helmet>

      {sub ? <Header /> : <MarketplaceHeader />}

      {/* MarketplaceHeader is position:sticky (self-clearing, no padding needed);
          Header (subdomain) is position:fixed and needs the 64px bar + 18px
          breathing room cleared explicitly. Using 72px for the sticky case too
          was leftover from before MarketplaceHeader switched to sticky — it
          double-reserved the header's height and left a dead gap above the
          calculator (see CarListingPage.jsx's `dark ? '84px' : 0` for the same rule). */}
      <main style={{ paddingTop: sub ? 82 : 0, background: sub ? '#08090f' : '#F7F6F2', minHeight: '100vh', fontFamily: "system-ui,sans-serif" }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 16px 48px' }}>

          {/* Page header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ marginBottom: 28 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 24, height: 2, background: '#dc2626' }} />
              <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                Financing Tools
              </span>
            </div>
            <h1 style={{ color: sub ? '#f3f4f6' : '#111827', fontSize: 'clamp(1.5rem,4vw,2rem)', fontWeight: 800, margin: '0 0 6px', lineHeight: 1.2 }}>
              {t('calculator.header.title')}
            </h1>
            <p style={{ color: sub ? '#9ca3af' : '#6b7280', fontSize: 14, margin: 0 }}>
              {t('calculator.header.subtitle')}
            </p>
          </motion.div>

          {/* Calculator */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <FinancingCalculator
              initialPrice={initialPrice}
              engineCc={engineCcParam}
              bodyType={bodyTypeParam}
              key={`${initialPrice}-${engineCcParam || ''}-${bodyTypeParam || ''}`}
              light={!sub}
              dealer={sub ? (tenant || null) : null}
              resolveFromSession={false}
            />
          </motion.div>

          {/* Info section — light-only component; hidden on the dark storefront */}
          {!sub && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ duration: 0.5 }}
              style={{ marginTop: 40 }}
            >
              <CalculatorInfoSection />
            </motion.div>
          )}

        </div>
      </main>

      {!sub && <MarketplaceFooter />}
      <StickyWhatsAppButton />
    </>
  );
};

export default CalculatorPage;
