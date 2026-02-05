import { itTranslations } from './locales/it';
import { enTranslations } from './locales/en';
import { frTranslations } from './locales/fr';
import { esTranslations } from './locales/es';
import { deTranslations } from './locales/de';

export type Language = 'it' | 'en' | 'fr' | 'es' | 'de';

type TranslationValue = string | string[];

const translations: Record<Language, Record<string, TranslationValue>> = {
  it: itTranslations,
  en: enTranslations,
  fr: frTranslations,
  es: esTranslations,
  de: deTranslations,
};

export const t = (key: string, lang: string = 'it'): string => {
  const code = lang as Language;
  const dict = translations[code] || translations.it;
  const value = dict[key];
  return typeof value === 'string' ? value : key;
};

export const getTranslationValue = <T = unknown>(key: string, lang: string = 'it'): T | undefined => {
  const code = lang as Language;
  const dict = translations[code] || translations.it;
  return dict[key] as T | undefined;
};
