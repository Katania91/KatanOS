export type PickerLang = 'it' | 'en' | 'fr' | 'es' | 'de';

const LOCALE_MAP: Record<PickerLang, string> = {
  it: 'it-IT',
  en: 'en-US',
  fr: 'fr-FR',
  es: 'es-ES',
  de: 'de-DE',
};

const pad2 = (value: number) => String(value).padStart(2, '0');

export const getLocaleFromLang = (lang?: string) =>
  LOCALE_MAP[(lang as PickerLang) || 'it'] || 'it-IT';

export const formatDateValue = (date: Date) => {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  return `${year}-${month}-${day}`;
};

export const parseDateValue = (value?: string) => {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

export const parseDateTimeValue = (value?: string) => {
  if (!value) return null;
  const separator = value.includes('T') ? 'T' : ' ';
  const [datePart, timePart] = value.split(separator);
  const date = parseDateValue(datePart);
  if (!date) return null;
  const [hoursRaw, minutesRaw] = (timePart || '').split(':');
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  return {
    date,
    hours: Number.isFinite(hours) ? hours : 0,
    minutes: Number.isFinite(minutes) ? minutes : 0,
  };
};

export const formatDateTimeValue = (date: Date, hours: number, minutes: number) => {
  const safeHours = Math.min(23, Math.max(0, Math.floor(hours)));
  const safeMinutes = Math.min(59, Math.max(0, Math.floor(minutes)));
  return `${formatDateValue(date)}T${pad2(safeHours)}:${pad2(safeMinutes)}`;
};

export const getMonthLabel = (viewDate: Date, lang?: string) =>
  viewDate.toLocaleDateString(getLocaleFromLang(lang), { month: 'long', year: 'numeric' });

export const getWeekdayLabels = (lang?: string) => {
  const locale = getLocaleFromLang(lang);
  const base = new Date(2024, 0, 1);
  const labels: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    labels.push(date.toLocaleDateString(locale, { weekday: 'short' }));
  }
  return labels;
};

export const buildCalendarDays = (viewDate: Date) => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];
  for (let i = 0; i < 42; i++) {
    const dayNumber = i - startOffset + 1;
    const date = new Date(year, month, dayNumber);
    const inMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
    days.push({ date, inMonth });
  }
  return days;
};

export const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();
