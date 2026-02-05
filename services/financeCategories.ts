import { t } from './translations';

export const DEFAULT_FINANCE_CATEGORIES = [
  { id: 'food', labelKey: 'f_cat_food' },
  { id: 'transport', labelKey: 'f_cat_transport' },
  { id: 'utilities', labelKey: 'f_cat_utilities' },
  { id: 'entertainment', labelKey: 'f_cat_entertainment' },
  { id: 'salary', labelKey: 'f_cat_salary' },
  { id: 'investment', labelKey: 'f_cat_investment' },
  { id: 'other', labelKey: 'f_cat_other' },
];

export const getDefaultFinanceCategories = (lang: string) =>
  DEFAULT_FINANCE_CATEGORIES.map((cat) => ({
    id: cat.id,
    label: t(cat.labelKey, lang),
  }));

export const getFinanceCategoryLabel = (value: string, lang: string) => {
  const match = DEFAULT_FINANCE_CATEGORIES.find((cat) => cat.id === value);
  if (match) return t(match.labelKey, lang);
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
};
