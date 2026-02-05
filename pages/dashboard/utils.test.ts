import { describe, it, expect } from 'vitest';
import { getTimeBasedGreeting, formatDashboardDate, createMoneyFormatter } from './utils';

describe('Dashboard Utils', () => {
    describe('getTimeBasedGreeting', () => {
        it('should return morning greeting before noon', () => {
            expect(getTimeBasedGreeting(8, 'it')).toBe('greet_morning');
            expect(getTimeBasedGreeting(11, 'en')).toBe('greet_morning');
        });

        it('should return afternoon greeting between noon and 6pm', () => {
            expect(getTimeBasedGreeting(12, 'it')).toBe('greet_afternoon');
            expect(getTimeBasedGreeting(17, 'en')).toBe('greet_afternoon');
        });

        it('should return evening greeting after 6pm', () => {
            expect(getTimeBasedGreeting(18, 'it')).toBe('greet_evening');
            expect(getTimeBasedGreeting(23, 'en')).toBe('greet_evening');
        });
    });

    describe('formatDashboardDate', () => {
        it('should format date in Italian locale', () => {
            const date = new Date('2024-03-15');
            const result = formatDashboardDate(date, 'it');
            expect(result).toContain('2024');
        });

        it('should format date in English locale', () => {
            const date = new Date('2024-03-15');
            const result = formatDashboardDate(date, 'en');
            expect(result).toContain('2024');
        });
    });

    describe('createMoneyFormatter', () => {
        it('should format EUR currency', () => {
            const format = createMoneyFormatter('it', 'EUR');
            const result = format(100);
            expect(result).toMatch(/100/);
        });

        it('should format USD currency', () => {
            const format = createMoneyFormatter('en', 'USD');
            const result = format(100);
            expect(result).toMatch(/100/);
        });
    });
});
