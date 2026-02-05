import { CalendarCategory, User } from '../types';
import { t } from './translations';

export const DEFAULT_CALENDAR_CATEGORY_ID = 'none';

type CalendarCategoryDefinition = {
  id: string;
  nameKey: string;
  fallbackName: string;
  color: string;
  emoji?: string;
};

const DEFAULT_CALENDAR_CATEGORY_DEFS: CalendarCategoryDefinition[] = [
  { id: DEFAULT_CALENDAR_CATEGORY_ID, nameKey: 'calendarCategoryNone', fallbackName: 'No Category', color: '#475569', emoji: '\u2796' },
  { id: 'meeting', nameKey: 'cat_meeting', fallbackName: 'Meeting', color: '#818cf8', emoji: '\u{1F91D}' },
  { id: 'work', nameKey: 'cat_work', fallbackName: 'Work', color: '#3b82f6', emoji: '\u{1F4BC}' },
  { id: 'personal', nameKey: 'cat_personal', fallbackName: 'Personal', color: '#f472b6', emoji: '\u2764\uFE0F' },
  { id: 'vacation', nameKey: 'cat_vacation', fallbackName: 'Vacation', color: '#34d399', emoji: '\u2708\uFE0F' },
  { id: 'health', nameKey: 'cat_health', fallbackName: 'Health', color: '#f87171', emoji: '\u{1F48A}' },
];


const LEGACY_ICON_EMOJI_MAP: Record<string, string> = {
  briefcase: '\u{1F4BC}',
  user: '\u{1F464}',
  heart: '\u2764\uFE0F',
  plane: '\u2708\uFE0F',
  activity: '\u{1F3C3}',
  star: '\u2B50',
  flag: '\u{1F3C1}',
  coffee: '\u2615',
  calendar: '\u{1F4C5}',
  check: '\u2705',
  minus: '\u2796',
};


export const getDefaultCalendarCategories = (lang: string): CalendarCategory[] => {
  return DEFAULT_CALENDAR_CATEGORY_DEFS.map((def) => ({
    id: def.id,
    name: t(def.nameKey, lang) || def.fallbackName,
    color: def.color,
    emoji: def.emoji,
    isDefault: true,
  }));
};

const normalizeCategoryEmoji = (category: CalendarCategory): CalendarCategory => {
  if (category.emoji) return category;
  if (category.icon && LEGACY_ICON_EMOJI_MAP[category.icon]) {
    return { ...category, emoji: LEGACY_ICON_EMOJI_MAP[category.icon] };
  }
  return category;
};

export const getCalendarCategoriesForUser = (user: User | null | undefined, lang: string): CalendarCategory[] => {
  const defaults = getDefaultCalendarCategories(lang);
  const custom = (user?.calendarCategories || []).map((cat) => ({
    ...normalizeCategoryEmoji(cat),
    isDefault: false,
  }));
  const merged = [...defaults];
  custom.forEach((cat) => {
    const index = merged.findIndex((item) => item.id === cat.id);
    if (index >= 0) merged[index] = cat;
    else merged.push(cat);
  });
  return merged;
};

export const resolveCalendarCategory = (categories: CalendarCategory[], id?: string | null) => {
  if (!categories.length) return undefined;
  if (id) {
    const match = categories.find((cat) => cat.id === id);
    if (match) return match;
  }
  const fallback = categories.find((cat) => cat.id === DEFAULT_CALENDAR_CATEGORY_ID);
  return fallback || categories[0];
};
