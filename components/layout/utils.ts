// Layout utilities - extracted from Layout.tsx

/**
 * Format time from seconds to MM:SS
 */
export function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Normalize category name (trim and collapse whitespace)
 */
export function normalizeCategoryName(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

/**
 * Normalize PIN (digits only, max 8 chars)
 */
export function normalizePin(value: string): string {
    return value.replace(/\D/g, '').slice(0, 8);
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: Date, lang: string): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return lang === 'it' ? 'Adesso' : 'Just now';
    if (diffMins < 60) return lang === 'it' ? `${diffMins} min fa` : `${diffMins}m ago`;
    if (diffHours < 24) return lang === 'it' ? `${diffHours} ore fa` : `${diffHours}h ago`;
    if (diffDays < 7) return lang === 'it' ? `${diffDays} giorni fa` : `${diffDays}d ago`;

    return date.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US');
}

/**
 * Clamp position to screen bounds
 */
export function clampToScreen(
    x: number,
    y: number,
    width: number,
    height: number
): { x: number; y: number } {
    const { innerWidth, innerHeight } = window;
    return {
        x: Math.max(0, Math.min(x, innerWidth - width)),
        y: Math.max(0, Math.min(y, innerHeight - height)),
    };
}

/**
 * Get backup interval label for display
 */
export function getBackupIntervalLabel(interval: string, lang: string): string {
    const labels: Record<string, Record<string, string>> = {
        '30m': { it: '30 minuti', en: '30 minutes' },
        '1h': { it: '1 ora', en: '1 hour' },
        '6h': { it: '6 ore', en: '6 hours' },
        '12h': { it: '12 ore', en: '12 hours' },
        '24h': { it: 'Giornaliero', en: 'Daily' },
        'weekly': { it: 'Settimanale', en: 'Weekly' },
        'monthly': { it: 'Mensile', en: 'Monthly' },
    };
    return labels[interval]?.[lang === 'it' ? 'it' : 'en'] || interval;
}
