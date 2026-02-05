import { describe, it, expect } from 'vitest';
import {
    formatTime,
    normalizeCategoryName,
    normalizePin,
    formatFileSize,
    getBackupIntervalLabel,
} from './utils';

describe('Layout Utils', () => {
    describe('formatTime', () => {
        it('should format seconds to MM:SS', () => {
            expect(formatTime(0)).toBe('00:00');
            expect(formatTime(65)).toBe('01:05');
            expect(formatTime(3600)).toBe('60:00');
        });
    });

    describe('normalizeCategoryName', () => {
        it('should trim whitespace', () => {
            expect(normalizeCategoryName('  hello  ')).toBe('hello');
        });

        it('should collapse multiple spaces', () => {
            expect(normalizeCategoryName('hello   world')).toBe('hello world');
        });
    });

    describe('normalizePin', () => {
        it('should remove non-digits', () => {
            expect(normalizePin('12ab34')).toBe('1234');
        });

        it('should limit to 8 characters', () => {
            expect(normalizePin('123456789012')).toBe('12345678');
        });
    });

    describe('formatFileSize', () => {
        it('should format bytes', () => {
            expect(formatFileSize(500)).toBe('500 B');
        });

        it('should format kilobytes', () => {
            expect(formatFileSize(2048)).toBe('2.0 KB');
        });

        it('should format megabytes', () => {
            expect(formatFileSize(1048576)).toBe('1.0 MB');
        });
    });

    describe('getBackupIntervalLabel', () => {
        it('should return Italian labels', () => {
            expect(getBackupIntervalLabel('24h', 'it')).toBe('Giornaliero');
            expect(getBackupIntervalLabel('weekly', 'it')).toBe('Settimanale');
        });

        it('should return English labels', () => {
            expect(getBackupIntervalLabel('24h', 'en')).toBe('Daily');
            expect(getBackupIntervalLabel('weekly', 'en')).toBe('Weekly');
        });
    });
});
