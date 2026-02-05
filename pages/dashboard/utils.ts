// Dashboard utilities - extracted from Dashboard.tsx

import type { WikiOnThisDayEvent, OnThisDayEvent } from './types';

/**
 * Fetch "On This Day" events from Wikipedia API
 */
export async function fetchOnThisDayEvents(lang: string): Promise<OnThisDayEvent[]> {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const wikiLang = lang === 'it' ? 'it' : 'en';

    try {
        const res = await fetch(
            `https://api.wikimedia.org/feed/v1/wikipedia/${wikiLang}/onthisday/events/${mm}/${dd}`
        );
        if (!res.ok) return [];
        const data = await res.json();
        const events = (data?.events || []) as WikiOnThisDayEvent[];
        return events
            .filter((e): e is { year: number; text: string } =>
                typeof e.year === 'number' && typeof e.text === 'string'
            )
            .slice(0, 20);
    } catch (e) {
        console.error('Failed to fetch onThisDay:', e);
        return [];
    }
}

/**
 * Fetch city search results from Open-Meteo geocoding API
 */
export async function searchCities(query: string): Promise<{ id: number; name: string; country: string; latitude: number; longitude: number; admin1?: string }[]> {
    if (!query.trim()) return [];

    try {
        const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`
        );
        if (!response.ok) return [];
        const data = await response.json();
        return data.results || [];
    } catch (e) {
        console.error('City search failed:', e);
        return [];
    }
}

/**
 * Fetch location from IP address
 */
export async function fetchIpLocation(): Promise<{ lat: number; lon: number; name: string } | null> {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) return null;
        const data = await response.json();
        if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return null;
        return {
            lat: data.latitude,
            lon: data.longitude,
            name: data.city || data.region || 'Unknown',
        };
    } catch (e) {
        return null;
    }
}

/**
 * Get greeting based on time of day
 */
export function getTimeBasedGreeting(hour: number, lang: string): 'greet_morning' | 'greet_afternoon' | 'greet_evening' {
    if (hour < 12) return 'greet_morning';
    if (hour < 18) return 'greet_afternoon';
    return 'greet_evening';
}

/**
 * Format date for display
 */
export function formatDashboardDate(date: Date, locale: string): string {
    const timeLocale = locale === 'it' ? 'it-IT' : locale === 'de' ? 'de-DE' : locale === 'fr' ? 'fr-FR' : locale === 'es' ? 'es-ES' : 'en-US';
    return date.toLocaleDateString(timeLocale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Create currency formatter
 */
export function createMoneyFormatter(lang: string, currency: string = 'EUR'): (amount: number) => string {
    const formatter = new Intl.NumberFormat(
        lang === 'it' ? 'it-IT' : 'en-US',
        { style: 'currency', currency }
    );
    return (amount: number) => formatter.format(amount);
}
