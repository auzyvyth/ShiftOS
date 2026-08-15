
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Only the FALLBACK language ships in the entry bundle. ms.json is fetched as
// its own chunk and only when it is actually the active language.
//
// Both locale files used to be static imports here, so every visitor on the
// public marketplace downloaded ~32 KB gzipped of translations to use ~16 KB of
// them. en stays static on purpose: it is `fallbackLng`, so having it present
// synchronously guarantees a key never renders raw no matter what happens to
// the ms fetch.
import enTranslations from './locales/en.json';

// Mirrors the `detection.order` below for the sources that can be read
// synchronously, so we know before init whether the ms chunk is needed. Keys are
// i18next-browser-languagedetector's defaults: `lng` querystring,
// `i18next` cookie, `i18nextLng` storage.
function detectInitialLang() {
  try {
    const qs = new URLSearchParams(window.location.search).get('lng');
    if (qs) return qs.split('-')[0];

    const cookie = document.cookie.match(/(?:^|;\s*)i18next=([^;]*)/);
    if (cookie?.[1]) return decodeURIComponent(cookie[1]).split('-')[0];

    const stored =
      window.localStorage?.getItem('i18nextLng') ||
      window.sessionStorage?.getItem('i18nextLng');
    if (stored) return stored.split('-')[0];

    if (navigator.language) return navigator.language.split('-')[0];
  } catch {
    // private browsing / blocked storage — fall through to the default
  }
  return 'en';
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: enTranslations
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
    },
    react: {
      // Non-default, and REQUIRED for the lazy locale above: react-i18next only
      // re-renders on `languageChanged` out of the box, so a bundle added after
      // init (loadLocale below, or the language toggle) would sit in the store
      // unused until some other state change happened to flush it.
      bindI18nStore: 'added',
    }
  });

const loaded = { en: true };

// Fetches a locale chunk and registers it. Safe to call repeatedly.
export function loadLocale(lng) {
  const code = (lng || '').split('-')[0];
  if (code !== 'ms' || loaded.ms) return Promise.resolve();
  return import('./locales/ms.json')
    .then((mod) => {
      i18n.addResourceBundle('ms', 'translation', mod.default, true, true);
      loaded.ms = true;
    })
    .catch(() => {
      // Chunk failed (offline, stale deploy). fallbackLng keeps the UI in
      // English rather than showing raw keys, so this is non-fatal.
    });
}

// Awaited once in main.jsx before the first render so a Malay visitor does not
// see a frame of English. Resolves immediately for English visitors.
export const i18nReady = loadLocale(detectInitialLang());

// Make every language switch fetch its bundle BEFORE the language actually
// flips, so the toggle never renders a frame of English on the way to Malay.
// Patched here rather than at the call sites because there are five of them
// (Header, ShiftOSPage, WaitlistPage, SalesmanLite x2) and a sixth added later
// would silently skip the load. Applied after init() so the detector's own
// startup call is unaffected.
const changeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = (lng, ...rest) => loadLocale(lng).then(() => changeLanguage(lng, ...rest));

// Safety net for any path that reaches the store without going through the
// wrapper above. loadLocale is idempotent, so this cannot double-fetch.
i18n.on('languageChanged', (lng) => { loadLocale(lng); });

export default i18n;
