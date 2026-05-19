import React, { useEffect, useState } from 'react';
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
import { isSubdomain } from '../hooks/useTenant';

const CalculatorPage = () => {
  const [searchParams] = useSearchParams();
  const [initialPrice,   setInitialPrice]   = useState(85000);
  const [engineCcParam,  setEngineCcParam]  = useState(null);
  const [bodyTypeParam,  setBodyTypeParam]  = useState(null);
  const { t } = useTranslation();

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

      {isSubdomain() ? <Header /> : <MarketplaceHeader />}

      <main style={{ paddingTop: isSubdomain() ? 82 : 72, background: '#F7F6F2', minHeight: '100vh', fontFamily: "'DM Sans',sans-serif" }}>
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
            <h1 style={{ color: '#111827', fontSize: 'clamp(1.5rem,4vw,2rem)', fontWeight: 800, margin: '0 0 6px', lineHeight: 1.2 }}>
              {t('calculator.header.title')}
            </h1>
            <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>
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
              light
            />
          </motion.div>

          {/* Info section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.5 }}
            style={{ marginTop: 40 }}
          >
            <CalculatorInfoSection />
          </motion.div>

        </div>
      </main>

      {!isSubdomain() && <MarketplaceFooter />}
      <StickyWhatsAppButton />
    </>
  );
};

export default CalculatorPage;
