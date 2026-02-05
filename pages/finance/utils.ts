// Finance module utilities

import type { Frequency } from './types';

/**
 * Creates a currency formatter function for the given locale and currency.
 */
export const createCurrencyFormatter = (lang: string, currency: string) => (value: number) =>
    new Intl.NumberFormat(lang, { style: 'currency', currency }).format(value || 0);

/**
 * Extracts the month key (YYYY-MM) from a date string.
 */
export const toMonthKey = (value: string) => value.slice(0, 7);

/**
 * Parses a comma-separated string into an array of trimmed, non-empty tags.
 */
export const parseTags = (input: string): string[] =>
    input
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

/**
 * Calculates the next date based on frequency (weekly, monthly, yearly).
 */
export const getNextDate = (dateValue: Date, frequency: Frequency): Date => {
    const next = new Date(dateValue);
    if (frequency === 'weekly') {
        next.setDate(next.getDate() + 7);
        return next;
    }
    if (frequency === 'monthly') {
        next.setMonth(next.getMonth() + 1);
        return next;
    }
    next.setFullYear(next.getFullYear() + 1);
    return next;
};

/**
 * Escapes a string value for CSV export.
 */
export const escapeCsvValue = (value: string): string => {
    if (!value) return '';
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
};
