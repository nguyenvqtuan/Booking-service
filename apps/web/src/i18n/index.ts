import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, isLocale, type Locale, SUPPORTED_LOCALES } from '@booking/shared';
import { NAMESPACES, resources } from './resources';

export const LANGUAGE_STORAGE_KEY = 'bs_lang';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    ns: NAMESPACES,
    defaultNS: 'common',
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    nonExplicitSupportedLngs: true, // "en-US" -> "en"
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    returnNull: false,
  });

/** Current UI language, normalized to a supported locale. */
export function currentLocale(): Locale {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  return isLocale(lng) ? lng : DEFAULT_LOCALE;
}

export default i18n;
