import { db } from './db';
import { t as translate } from './translations';

export const useTranslation = (langOverride?: string) => {
  const user = db.auth.getCurrentUser();
  const lang = langOverride || user?.language || 'it';
  return {
    t: (key: string, override?: string) => translate(key, override || lang),
    lang,
  };
};
