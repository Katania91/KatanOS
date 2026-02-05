import { Language } from './translations';

const LAST_LOGIN_LANGUAGE_KEY = 'katanos_last_login_lang';
const SUPPORTED_LANGUAGES: Language[] = ['it', 'en', 'fr', 'es', 'de'];

const isLanguage = (value: string | null): value is Language =>
  !!value && SUPPORTED_LANGUAGES.includes(value as Language);

export const getLastLoginLanguage = (): Language => {
  if (typeof window === 'undefined') return 'it';
  try {
    const stored = localStorage.getItem(LAST_LOGIN_LANGUAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Ignore storage errors and fall back to default language.
  }
  return 'it';
};

export const setLastLoginLanguage = (lang: string) => {
  if (!isLanguage(lang)) return;
  try {
    localStorage.setItem(LAST_LOGIN_LANGUAGE_KEY, lang);
  } catch {
    // Ignore storage errors.
  }
};

const LAST_LOGIN_THEME_KEY = 'katanos_last_login_theme';

export const getLastLoginTheme = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_LOGIN_THEME_KEY);
  } catch {
    return null;
  }
};

export const setLastLoginTheme = (themeId: string) => {
  if (!themeId) return;
  try {
    localStorage.setItem(LAST_LOGIN_THEME_KEY, themeId);
  } catch {
    // Ignore storage errors.
  }
};

const LOGIN_BACKGROUND_KEY = 'katanos_login_bg';

export const getLoginBackground = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(LOGIN_BACKGROUND_KEY);
  } catch {
    return null;
  }
};

export const setLoginBackground = (bg: string) => {
  if (!bg) return;
  try {
    localStorage.setItem(LOGIN_BACKGROUND_KEY, bg);
  } catch {
    // Ignore storage errors.
  }
};
