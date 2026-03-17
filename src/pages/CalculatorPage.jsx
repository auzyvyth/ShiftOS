
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import StickyWhatsAppButton from '@/components/StickyWhatsAppButton';
import FinancingCalculator from '@/components/FinancingCalculator';
import CalculatorInfoSection from '@/components/CalculatorInfoSection';
import { motion } from 'framer-motion';

const CalculatorPage = () => {
  const [searchParams] = useSearchParams();
  const [initialPrice, setInitialPrice] = useState(85000);
  const [engineCcParam, setEngineCcParam] = useState(null);
  const [bodyTypeParam, setBodyTypeParam] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    const priceParam = searchParams.get('carPrice');
    if (priceParam && !isNaN(parseFloat(priceParam))) {
      setInitialPrice(parseFloat(priceParam));
    }
    const ccParam = searchParams.get('engineCc');
    if (ccParam && !isNaN(parseInt(ccParam))) setEngineCcParam(parseInt(ccParam));
    const bt = searchParams.get('bodyType');
    if (bt) setBodyTypeParam(bt);
  }, [searchParams]);

  return (
    <>
      <Helmet>
        <title>{t('calculator.header.title')} | XDrive</title>
        <meta
          name="description"
          content={t('calculator.header.subtitle')}
        />
      </Helmet>

      <Header />

      <main className="pt-20 bg-[#F7F8FA] min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-6">

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
          >
            {/* Inline header inside the card */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h1 className="text-lg font-extrabold text-gray-900">{t('calculator.header.title')}</h1>
                <p className="text-xs text-gray-400 mt-0.5">{t('calculator.header.subtitle')}</p>
              </div>
            </div>
            <FinancingCalculator initialPrice={initialPrice} engineCc={engineCcParam} bodyType={bodyTypeParam} key={`${initialPrice}-${engineCcParam || ''}-${bodyTypeParam || ''}`} flat compact />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5 }}
          >
            <CalculatorInfoSection />
          </motion.div>

        </div>
      </main>

      <Footer />
      <StickyWhatsAppButton />
    </>
  );
};

export default CalculatorPage;
