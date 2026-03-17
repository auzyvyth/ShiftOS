
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Info, Percent, PiggyBank, Calendar } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const InfoItem = ({ title, icon: Icon, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg mb-3 overflow-hidden bg-white">
     <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors focus:outline-none"
      >
        <div className="flex items-center gap-3">
          <div className="bg-[#1E3A8A]/10 p-2 rounded-full">
            <Icon className="w-5 h-5 text-[#1E3A8A]" />
          </div>
          <span className="font-semibold text-gray-900">{title}</span>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-5 h-5 text-gray-500" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-4 text-gray-700 bg-white border-t border-gray-100 text-sm leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CalculatorInfoSection = () => {
  const { t } = useTranslation();

  return (
    <div className="mt-12 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{t('calculator.tips.title')}</h2>
      
      <InfoItem title={t('calculator.tips.tip1Title')} icon={Info}>
        <p>{t('calculator.tips.tip1Content1')}</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>{t('calculator.tips.tip1L1')}</li>
          <li>{t('calculator.tips.tip1L2')}</li>
          <li>{t('calculator.tips.tip1L3')}</li>
        </ul>
      </InfoItem>

      <InfoItem title={t('calculator.tips.tip2Title')} icon={Percent}>
        <p>{t('calculator.tips.tip2Content1')}</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>{t('calculator.tips.tip2L1')}</li>
          <li>{t('calculator.tips.tip2L2')}</li>
          <li>{t('calculator.tips.tip2L3')}</li>
          <li>{t('calculator.tips.tip2L4')}</li>
        </ul>
      </InfoItem>

      <InfoItem title={t('calculator.tips.tip3Title')} icon={PiggyBank}>
        <p>{t('calculator.tips.tip3Content1')}</p>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>{t('calculator.tips.tip3L1')}</li>
          <li>{t('calculator.tips.tip3L2')}</li>
          <li>{t('calculator.tips.tip3L3')}</li>
          <li>{t('calculator.tips.tip3L4')}</li>
        </ul>
      </InfoItem>

      <InfoItem title={t('calculator.tips.tip4Title')} icon={Calendar}>
        <p>{t('calculator.tips.tip4Content1')}</p>
        <div className="mt-3">
          <strong>{t('calculator.tips.tip4Content2')}</strong>
          <p className="text-gray-600 mb-2">{t('calculator.tips.tip4Content3')}</p>
          
          <strong>{t('calculator.tips.tip4Content4')}</strong>
          <p className="text-gray-600">{t('calculator.tips.tip4Content5')}</p>
        </div>
      </InfoItem>
    </div>
  );
};

export default CalculatorInfoSection;
