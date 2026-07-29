import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import ar from './ar/common.json';
import en from './en/common.json';

const LOCALE_KEY = 'rcos.locale';

export const AVAILABLE_LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof AVAILABLE_LOCALES)[number];

export function setDirection(locale: Locale) {
  document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', locale);
}

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'ar',
    supportedLngs: [...AVAILABLE_LOCALES],
    resources: {
      ar: { common: ar },
      en: { common: en },
    },
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_KEY,
      caches: ['localStorage'],
    },
  })
  .then(() => setDirection((i18next.language.startsWith('ar') ? 'ar' : 'en') as Locale));

i18next.on('languageChanged', (lng) => {
  setDirection(lng.startsWith('ar') ? 'ar' : 'en');
});

export function toggleLocale() {
  const next: Locale = i18next.language.startsWith('ar') ? 'en' : 'ar';
  void i18next.changeLanguage(next);
}

export { i18next };
