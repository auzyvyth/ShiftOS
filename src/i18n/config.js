
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import msTranslations from './locales/ms.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations
      },
      ms: {
        translation: msTranslations
      }
    },
    fallbackLng: 'en',
    debug: false,
    detection: {
      // localStorage can silently fail to persist (private browsing, strict
      // privacy settings, "clear data on close") — cache to a long-lived
      // cookie too so the choice survives a close/reopen either way
      order: ['querystring', 'cookie', 'localStorage', 'sessionStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
      cookieMinutes: 60 * 24 * 365,
    },
    interpolation: {
      escapeValue: false, 
    }
  });

export default i18n;
