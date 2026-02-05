import { describe, it, expect } from 'vitest';
import {
    createCurrencyFormatter,
    toMonthKey,
    parseTags,
    getNextDate,
    escapeCsvValue,
} from './utils';

describe('Finance Utils', () => {
    describe('createCurrencyFormatter', () => {
        it('should format EUR currency correctly', () => {
            const format = createCurrencyFormatter('it-IT', 'EUR');
            const result = format(1234.56);
            expect(result).toMatch(/1[.,]?234[.,]56/);
        });

        it('should format USD currency correctly', () => {
            const format = createCurrencyFormatter('en-US', 'USD');
            const result = format(1234.56);
            expect(result).toContain('1,234.56');
        });

        it('should handle zero value', () => {
            const format = createCurrencyFormatter('it-IT', 'EUR');
            const result = format(0);
            expect(result).toContain('0');
        });
    });

    describe('toMonthKey', () => {
        it('should extract month key from date string', () => {
            expect(toMonthKey('2024-03-15')).toBe('2024-03');
        });

        it('should work with ISO date strings', () => {
            expect(toMonthKey('2024-12-25T10:30:00Z')).toBe('2024-12');
        });
    });

    describe('parseTags', () => {
        it('should parse comma-separated tags', () => {
            expect(parseTags('food, travel, rent')).toEqual(['food', 'travel', 'rent']);
        });

        it('should trim whitespace', () => {
            expect(parseTags('  tag1  ,  tag2  ')).toEqual(['tag1', 'tag2']);
        });

        it('should filter empty strings', () => {
            expect(parseTags('tag1,,tag2,')).toEqual(['tag1', 'tag2']);
        });

        it('should return empty array for empty input', () => {
            expect(parseTags('')).toEqual([]);
        });
    });

    describe('getNextDate', () => {
        it('should add 7 days for weekly frequency', () => {
            const date = new Date('2024-01-01');
            const next = getNextDate(date, 'weekly');
            expect(next.toISOString().slice(0, 10)).toBe('2024-01-08');
        });

        it('should add 1 month for monthly frequency', () => {
            const date = new Date('2024-01-15');
            const next = getNextDate(date, 'monthly');
            expect(next.getMonth()).toBe(1); // February
        });

        it('should add 1 year for yearly frequency', () => {
            const date = new Date('2024-03-15');
            const next = getNextDate(date, 'yearly');
            expect(next.getFullYear()).toBe(2025);
        });
    });

    describe('escapeCsvValue', () => {
        it('should return simple string unchanged', () => {
            expect(escapeCsvValue('hello')).toBe('hello');
        });

        it('should escape strings with commas', () => {
            expect(escapeCsvValue('hello, world')).toBe('"hello, world"');
        });

        it('should escape strings with quotes', () => {
            expect(escapeCsvValue('say "hello"')).toBe('"say ""hello"""');
        });

        it('should escape strings with newlines', () => {
            expect(escapeCsvValue('line1\nline2')).toBe('"line1\nline2"');
        });

        it('should handle empty string', () => {
            expect(escapeCsvValue('')).toBe('');
        });
    });
});
