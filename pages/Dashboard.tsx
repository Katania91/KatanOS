import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User, WeatherData, CalendarEvent, Transaction, Contact } from '../types';
import { getWeather, getWeatherCodeDescription, searchCities, getCityFromCoords } from '../services/weather';
import { db } from '../services/db';
import { useTranslation } from '../services/useTranslation';
import { getCalendarCategoriesForUser, resolveCalendarCategory } from '../services/calendarCategories';
import { getFinanceCategoryLabel } from '../services/financeCategories';
import { modulesService } from '../services/modules';
import EmojiGlyph from '../components/EmojiGlyph';
import { ArrowUpRight, Calendar, Wallet, Star, Phone, MapPin, Wind, Droplets, Search, X, Thermometer, Clock, Sofa, Quote, Mail, Check, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react';
import ChartWrapper from '../components/ChartWrapper';
import FlipClock from '../components/FlipClock';
import PomodoroWidget from '../components/PomodoroWidget';
import { getRandomQuote } from '../services/quotes';
import {
    type OnThisDayEvent,
    type CityResult,
    type WikiOnThisDayEvent,
    fetchOnThisDayEvents,
    fetchIpLocation,
    getTimeBasedGreeting,
    formatDashboardDate,
    createMoneyFormatter,
} from './dashboard/index';

interface DashboardProps {
    user: User;
    onViewContact: (id: string) => void;
    onViewEvent: (id: string) => void;
    onNavigate: (page: string) => void;
}

// Types imported from ./dashboard/index

const Dashboard: React.FC<DashboardProps> = ({ user, onViewContact, onViewEvent, onNavigate }) => {
    const { t } = useTranslation();
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [favorites, setFavorites] = useState<Contact[]>([]);
    const [loadingWeather, setLoadingWeather] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isForecastOpen, setIsForecastOpen] = useState(false);
    const [onThisDayItems, setOnThisDayItems] = useState<OnThisDayEvent[]>([]);
    const [onThisDayIndex, setOnThisDayIndex] = useState(0);
    const [onThisDayVisible, setOnThisDayVisible] = useState(true);
    const [clockScale, setClockScale] = useState(1);

    // Quote State
    const [dailyQuote, setDailyQuote] = useState({ text: '', author: '' });

    // Weather Search States
    const [isSearchingCity, setIsSearchingCity] = useState(false);
    const [cityQuery, setCityQuery] = useState('');
    const [cityResults, setCityResults] = useState<CityResult[]>([]);
    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const weatherLocationRef = useRef<{ lat: number; lon: number; name: string; label: string } | null>(null);
    const clockContainerRef = useRef<HTMLDivElement | null>(null);
    const clockMeasureRef = useRef<HTMLDivElement | null>(null);

    // Copy Feedback State
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const lang = user.language || 'it';
    const availableWidgets = useMemo(() => new Set(modulesService.getAvailableWidgets(user)), [user?.modulesConfig]);
    const isWidgetEnabled = (widgetId: string) => availableWidgets.has(widgetId);
    const calendarCategories = useMemo(() => getCalendarCategoriesForUser(user, lang), [user, lang]);
    const getEventCategory = (event: CalendarEvent) => resolveCalendarCategory(calendarCategories, event.type);
    const getEventCategoryLabel = (event: CalendarEvent) => getEventCategory(event)?.name || event.type;
    const getEventCategoryColor = (event: CalendarEvent) => getEventCategory(event)?.color || event.color || '#475569';
    const getEventCategoryEmoji = (event: CalendarEvent) => getEventCategory(event)?.emoji;
    const setWeatherFromLocation = async (
        lat: number,
        lon: number,
        label: string,
        storageName: string,
        persist: boolean = true
    ) => {
        const w = await getWeather(lat, lon, label, lang);
        setWeather(w);
        setLoadingWeather(false);
        weatherLocationRef.current = { lat, lon, name: storageName, label };
        if (persist) {
            const locationData = { lat, lon, name: storageName, label };
            localStorage.setItem(`katanos_weather_loc_${user.id}`, JSON.stringify(locationData));
            db.autosave(user.id);
        }
    };
    const currencySymbol = user.currency === 'USD' ? '$' : user.currency === 'GBP' ? '£' : user.currency === 'JPY' ? '¥' : user.currency === 'CHF' ? 'CHF' : '€';

    useEffect(() => {
        setDailyQuote(getRandomQuote(lang));
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);

        const loadData = async () => {
            const ev = await db.events.list(user.id);
            setEvents(ev);
            const tx = await db.transactions.list(user.id);
            setTransactions(tx);
            const ct = await db.contacts.list(user.id);
            setFavorites(ct.filter(c => c.isFavorite));

            const fetchIpLocation = async () => {
                try {
                    const response = await fetch('https://ipapi.co/json/');
                    if (!response.ok) return null;
                    const data = await response.json();
                    if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return null;
                    return {
                        lat: data.latitude,
                        lon: data.longitude,
                        name: data.city || data.region || "Unknown",
                    };
                } catch (e) {
                    return null;
                }
            };

            const refreshLocation = async () => {
                setLoadingWeather(true);
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        async (position) => {
                            const lat = position.coords.latitude;
                            const lon = position.coords.longitude;
                            let cityName = await getCityFromCoords(lat, lon, lang);

                            if (!cityName) {
                                // Fallback to IP if reverse geocoding fails
                                const ipLoc = await fetchIpLocation();
                                cityName = ipLoc?.name || "Unknown";
                            }

                            await setWeatherFromLocation(lat, lon, cityName, cityName);
                        },
                        async () => {
                            const ipLoc = await fetchIpLocation();
                            if (ipLoc) {
                                await setWeatherFromLocation(ipLoc.lat, ipLoc.lon, ipLoc.name, ipLoc.name);
                                return;
                            }
                            await setWeatherFromLocation(41.9028, 12.4964, "Roma", "Roma");
                        }
                    );
                } else {
                    const ipLoc = await fetchIpLocation();
                    if (ipLoc) {
                        await setWeatherFromLocation(ipLoc.lat, ipLoc.lon, ipLoc.name, ipLoc.name);
                    } else {
                        await setWeatherFromLocation(41.9028, 12.4964, "Roma", "Roma");
                    }
                }
            };

            setLoadingWeather(true);
            const savedLoc = localStorage.getItem(`katanos_weather_loc_${user.id}`);

            if (savedLoc) {
                const loc = JSON.parse(savedLoc);
                const label = loc.label || loc.name;
                const name = loc.name || label;
                await setWeatherFromLocation(loc.lat, loc.lon, label, name);
            } else {
                refreshLocation();
            }
        };
        loadData();

        return () => clearInterval(timer);
    }, [user]);

    // Expose refreshLocation to the UI via a ref or just duplicate the logic? 
    // Since I can't easily export it from useEffect, I'll define it outside or use a ref.
    // Actually, I can just define it inside the component body and use it in useEffect.

    const fetchIpLocation = async () => {
        try {
            const response = await fetch('https://ipapi.co/json/');
            if (!response.ok) return null;
            const data = await response.json();
            if (!data || typeof data.latitude !== 'number' || typeof data.longitude !== 'number') return null;
            return {
                lat: data.latitude,
                lon: data.longitude,
                name: data.city || data.region || "Unknown",
            };
        } catch (e) {
            return null;
        }
    };

    const handleAutoDetectLocation = async () => {
        setLoadingWeather(true);
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    let cityName = await getCityFromCoords(lat, lon, lang);

                    if (!cityName) {
                        const ipLoc = await fetchIpLocation();
                        cityName = ipLoc?.name || "Unknown";
                    }

                    await setWeatherFromLocation(lat, lon, cityName, cityName);
                },
                async () => {
                    const ipLoc = await fetchIpLocation();
                    if (ipLoc) {
                        await setWeatherFromLocation(ipLoc.lat, ipLoc.lon, ipLoc.name, ipLoc.name);
                    } else {
                        await setWeatherFromLocation(41.9028, 12.4964, "Roma", "Roma");
                    }
                }
            );
        } else {
            const ipLoc = await fetchIpLocation();
            if (ipLoc) {
                await setWeatherFromLocation(ipLoc.lat, ipLoc.lon, ipLoc.name, ipLoc.name);
            } else {
                await setWeatherFromLocation(41.9028, 12.4964, "Roma", "Roma");
            }
        }
    };

    useEffect(() => {
        let isMounted = true;
        const fetchOnThisDay = async () => {
            try {
                const supported = ['it', 'en', 'fr', 'es', 'de'];
                const wikiLang = supported.includes(lang) ? lang : 'en';
                const now = new Date();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const response = await fetch(`https://${wikiLang}.wikipedia.org/api/rest_v1/feed/onthisday/events/${month}/${day}`);
                if (!response.ok) throw new Error('onthisday request failed');
                const data = await response.json();
                const events = Array.isArray(data?.events)
                    ? data.events
                        .filter((event: WikiOnThisDayEvent) => typeof event?.text === 'string' && event.text.trim())
                        .map((event: WikiOnThisDayEvent) => ({ year: Number(event.year) || 0, text: event.text!.trim() }))
                        .filter((event: OnThisDayEvent) => event.year > 0 && event.text)
                    : [];

                if (!isMounted) return;
                setOnThisDayItems(events);
                if (events.length > 0) {
                    setOnThisDayIndex(Math.floor(Math.random() * events.length));
                    setOnThisDayVisible(true);
                }
            } catch (e) {
                if (!isMounted) return;
                setOnThisDayItems([]);
            }
        };

        fetchOnThisDay();
        return () => {
            isMounted = false;
        };
    }, [lang]);



    useEffect(() => {
        const container = clockContainerRef.current;
        const measure = clockMeasureRef.current;
        if (!container || !measure || typeof ResizeObserver === 'undefined') return;
        let raf = 0;

        const updateScale = () => {
            const containerRect = container.getBoundingClientRect();
            const measureRect = measure.getBoundingClientRect();
            if (!containerRect.width || !containerRect.height || !measureRect.width || !measureRect.height) return;

            // Less padding reserved to allow larger clock
            const safeDistance = 0;
            const availableHeight = Math.max(0, containerRect.height - safeDistance);

            // Allow much larger scaling for high-res screens
            const maxScale = 3.5;
            const minScale = 0.5;

            const nextScale = Math.min(containerRect.width / measureRect.width, availableHeight / measureRect.height, maxScale);
            const clamped = Math.max(minScale, Math.min(nextScale, maxScale));
            setClockScale((prev) => (Math.abs(prev - clamped) > 0.01 ? clamped : prev));
        };

        updateScale();
        const observer = new ResizeObserver(() => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(updateScale);
        });
        observer.observe(container);
        return () => {
            if (raf) cancelAnimationFrame(raf);
            observer.disconnect();
        };
    }, [lang]);

    useEffect(() => {
        const interval = setInterval(async () => {
            const loc = weatherLocationRef.current;
            if (!loc) return;
            const label = loc.label || loc.name || weather?.city || t('currentLocation', lang);
            await setWeatherFromLocation(loc.lat, loc.lon, label, loc.name, false);
        }, 30 * 60 * 1000);

        return () => clearInterval(interval);
    }, [lang, weather?.city]);

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        if (!cityQuery.trim()) {
            setCityResults([]);
            return;
        }

        searchTimeout.current = setTimeout(async () => {
            const results = await searchCities(cityQuery, lang);
            setCityResults(results);
        }, 500);
    }, [cityQuery, lang]);

    useEffect(() => {
        const handleEscape = (event: Event) => {
            if (!isForecastOpen) return;
            setIsForecastOpen(false);
            const customEvent = event as CustomEvent<{ handled?: boolean }>;
            if (customEvent.detail) customEvent.detail.handled = true;
        };

        window.addEventListener('katanos:escape', handleEscape);
        return () => window.removeEventListener('katanos:escape', handleEscape);
    }, [isForecastOpen]);

    const selectCity = async (city: CityResult) => {
        setLoadingWeather(true);
        setIsSearchingCity(false);
        const label = `${t('currentLocation', lang)} - ${city.name}`;
        await setWeatherFromLocation(city.latitude, city.longitude, label, `${city.name}`);
        setCityQuery('');
    };

    const copyText = async (value: string) => {
        if (!value) return false;
        if (window.katanos?.copyText) {
            try {
                return await window.katanos.copyText(value);
            } catch (e) {
                // fall through to browser copy
            }
        }
        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(value);
                return true;
            } catch (e) {
                // fall through
            }
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            return ok;
        } catch (e) {
            return false;
        }
    };

    const handleCopy = async (text: string, id: string) => {
        const ok = await copyText(text);
        if (!ok) return;
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const weatherInfo = weather ? getWeatherCodeDescription(weather.currentCode, lang, weather.isDay === 1, weather.windSpeed) : null;
    const todayForecast = weather?.daily?.[0];
    const timeLocale = lang === 'en' ? 'en-US' : lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'de' ? 'de-DE' : 'it-IT';
    const formatShortTime = (value?: string) => {
        if (!value) return '--:--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--:--';
        return date.toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' });
    };

    const todayEvents = events.filter(e => {
        const start = new Date(e.start);
        const end = new Date(e.end);
        const now = new Date();
        const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
        const eDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        const n = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return n.getTime() >= s.getTime() && n.getTime() <= eDate.getTime();
    });

    // Logic for Next Event
    const nextEvent = events
        .filter(e => new Date(e.end) > new Date()) // Not ended yet
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
    const nextEventCategoryLabel = nextEvent ? getEventCategoryLabel(nextEvent) : '';
    const nextEventCategoryColor = nextEvent ? getEventCategoryColor(nextEvent) : '#475569';
    const nextEventCategoryEmoji = nextEvent ? getEventCategoryEmoji(nextEvent) : '';

    const getGreeting = () => {
        const hour = currentTime.getHours();
        if (hour < 12) return t('greet_morning', lang);
        if (hour < 18) return t('greet_afternoon', lang);
        return t('greet_evening', lang);
    };

    // Helper for Event Date formatting (Today/Tomorrow/Date)
    const getEventDateString = (dateStr: string) => {
        const date = new Date(dateStr);
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (date.toDateString() === today.toDateString()) return t('today', lang);
        if (date.toDateString() === tomorrow.toDateString()) return t('tomorrow', lang);
        return date.toLocaleDateString(timeLocale, { day: 'numeric', month: 'short' });
    };

    // Finance Calcs
    const income = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
    const balance = income - expense;
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;

    const hasData = income > 0 || expense > 0;
    const incomePct = hasData ? Math.round((income / (income + expense)) * 100) : 0;
    const expensePct = hasData ? Math.round((expense / (income + expense)) * 100) : 0;

    // Show only last 4 transactions
    const recentTransactions = transactions.slice().reverse().slice(0, 4);

    const formatDate = (date: Date) => date.toLocaleDateString(timeLocale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const formatMoney = (amount: number) => new Intl.NumberFormat(lang === 'it' ? 'it-IT' : 'en-US', { style: 'currency', currency: user.currency || 'EUR' }).format(amount);

    const chartData = useMemo(() => ({
        labels: [t('income', lang), t('expense', lang)],
        datasets: [
            {
                data: [income, expense],
                backgroundColor: ['rgba(16, 185, 129, 0.4)', 'rgba(239, 68, 68, 0.4)'],
                borderColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'],
                borderWidth: 1,
                cutout: '88%',
            },
        ],
    }), [income, expense, lang]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
    }), []);

    return (
        <div className="h-auto min-h-0 flex flex-col gap-3 md:gap-4 xl:gap-6 animate-fade-in pb-2">
            <div className="flex items-center mb-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-display font-bold">{t('dashboard', lang)}</h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5 xl:gap-6 auto-rows-min">

                {/* HERO WIDGETS AREA - SPLIT INTO 4 */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5 xl:gap-6">

                    {/* 1. CLOCK & GREETING */}
                    <div className="glass-panel rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[240px] shadow-2xl group transition-all hover:shadow-primary/5">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950/50 z-0"></div>
                        <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:20px_20px]"></div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div>
                                <div className="text-primary font-display font-semibold text-[clamp(1.2rem,2.5vmin,1.8rem)] drop-shadow-[0_0_14px_rgb(var(--color-primary)/0.8)]">
                                    {getGreeting()}, {user.username}
                                </div>
                                <div className="text-slate-300 text-sm font-light tracking-wide mt-1">
                                    {t('todayIs', lang)} {formatDate(currentTime)}
                                </div>
                            </div>

                            <div ref={clockContainerRef} className="relative mt-4 flex-1 min-h-[100px] flex items-center justify-center">
                                <div className="block 2xl:hidden text-center w-full">
                                    <div className="text-[clamp(2.5rem,6vmin,4rem)] font-bold font-mono text-white leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
                                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="text-slate-300 text-xs font-bold uppercase tracking-[0.3em] mt-2">
                                        {t('clock_hours', lang)} &bull; {t('clock_minutes', lang)}
                                    </div>
                                </div>

                                <div className="hidden 2xl:block relative w-full h-full">
                                    <div className="absolute top-0 left-0 w-0 h-0 overflow-hidden">
                                        <div ref={clockMeasureRef} className="w-max opacity-0">
                                            <FlipClock time={currentTime} lang={lang} use12Hour={user.clockUse12h === true} />
                                        </div>
                                    </div>
                                    <div className="origin-center flex justify-center items-center h-full w-full" style={{ transform: `scale(${clockScale})` }}>
                                        <FlipClock time={currentTime} lang={lang} use12Hour={user.clockUse12h === true} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. WEATHER */}
                    <div className="glass-panel rounded-3xl p-6 relative flex flex-col shadow-2xl group transition-all hover:shadow-primary/5 min-h-[240px] z-20">
                        {/* Background Wrapper - Clipped */}
                        <div className="absolute inset-0 rounded-3xl overflow-hidden z-0 pointer-events-none">
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950/50"></div>
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:20px_20px]"></div>
                            {/* Background Icon */}
                            <div className="absolute -bottom-4 -right-4 text-[8rem] opacity-[0.03] select-none">
                                {weatherInfo?.icon}
                            </div>
                        </div>

                        <style>{`
                    @keyframes weather-marquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-100%); }
                    }
                `}</style>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-4 z-20">
                                <div className="relative">
                                    {isSearchingCity ? (
                                        <div className="relative w-fit flex items-center gap-2 bg-slate-900/90 rounded-xl p-1 animate-scale-in origin-left border border-white/20 z-50">
                                            <Search size={14} className="text-slate-300 ml-2" />
                                            <input
                                                autoFocus
                                                type="text"
                                                value={cityQuery}
                                                onChange={e => setCityQuery(e.target.value)}
                                                placeholder={t('searchCity', lang)}
                                                className="bg-transparent border-none outline-none text-sm text-white w-32 placeholder:text-slate-500"
                                            />
                                            <button onClick={() => setIsSearchingCity(false)} className="text-slate-300 hover:text-white p-1"><X size={14} /></button>

                                            {cityResults.length > 0 && (
                                                <div className="absolute top-full left-0 mt-2 w-64 max-h-60 overflow-y-auto custom-scrollbar bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-50">
                                                    {cityResults.map(city => (
                                                        <button
                                                            key={city.id}
                                                            onClick={() => selectCity(city)}
                                                            className="w-full text-left px-4 py-2 hover:bg-white/5 text-sm flex flex-col border-b border-white/5 last:border-0"
                                                        >
                                                            <span className="font-bold text-white">{city.name}</span>
                                                            <span className="text-xs text-slate-300">{city.admin1 ? `${city.admin1}, ` : ''}{city.country}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-0 bg-black/20 backdrop-blur-md rounded-full border border-white/5 p-1 pr-2 group/loc">
                                                <button
                                                    onClick={() => setIsSearchingCity(true)}
                                                    className="flex items-center gap-2 text-indigo-300 hover:text-white transition-colors px-2 py-0.5"
                                                >
                                                    <MapPin size={14} />
                                                    <span className="uppercase tracking-widest text-xs font-bold max-w-[200px] truncate">
                                                        {loadingWeather ? "..." : (weather?.city || "Unknown")}
                                                    </span>
                                                </button>
                                                <div className="w-px h-3 bg-white/10 mx-1"></div>
                                                <button
                                                    onClick={handleAutoDetectLocation}
                                                    className="text-slate-300 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                                                    title={t('currentLocation', lang)}
                                                >
                                                    <RefreshCw size={12} className={loadingWeather ? "animate-spin" : ""} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setIsForecastOpen((prev) => !prev)}
                                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-3 py-1 rounded-full border border-white/10"
                                >
                                    {t('forecast', lang)}
                                </button>
                            </div>

                            <div className="flex-1 flex flex-col justify-center z-10">
                                <div className="flex items-center gap-4">
                                    <span className="text-5xl">{weatherInfo?.icon}</span>
                                    <div>
                                        <div className="text-4xl font-bold">{Math.round(weather?.currentTemp || 0)}&deg;</div>
                                        <div className="text-slate-300 text-sm">{weatherInfo?.label}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 mt-4 text-xs text-slate-300 z-10">
                                <div className="flex flex-col items-center bg-black/20 rounded-lg p-2">
                                    <Droplets size={14} className="text-blue-400 mb-1" />
                                    <span>{weather?.humidity}%</span>
                                </div>
                                <div className="flex flex-col items-center bg-black/20 rounded-lg p-2">
                                    <Wind size={14} className="text-slate-300 mb-1" />
                                    <span>{weather?.windSpeed} <span className="text-[9px]">km/h</span></span>
                                </div>
                                <div className="flex flex-col items-center bg-black/20 rounded-lg p-2">
                                    <Thermometer size={14} className="text-red-400 mb-1" />
                                    <span>{Math.round(weather?.feelsLike || 0)}&deg;</span>
                                </div>
                            </div>

                            {/* Forecast Popup */}
                            {isForecastOpen && weather?.daily?.length > 0 && (
                                <div className="absolute top-14 right-4 z-50 w-80 rounded-3xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl p-5 animate-scale-in origin-top-right overflow-hidden">
                                    {/* Decorative background elements */}
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                                    <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

                                    <div className="relative z-10">
                                        <div className="flex items-center justify-between mb-4 pl-1">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-blue-400" />
                                                <span className="text-xs font-bold uppercase tracking-widest text-slate-200">{t('forecast', lang)}</span>
                                            </div>
                                            <button
                                                onClick={() => setIsForecastOpen(false)}
                                                className="p-1.5 rounded-full bg-white/5 text-slate-300 hover:text-white hover:bg-white/20 transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>

                                        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                                            {weather.daily.slice(0, 7).map((day, i) => {
                                                const info = getWeatherCodeDescription(day.weatherCode, lang);
                                                const date = new Date(day.date);
                                                const dayNameRaw = i === 0 ? t('today', lang) : date.toLocaleDateString(timeLocale, { weekday: 'long' });
                                                const dayName = dayNameRaw.charAt(0).toUpperCase() + dayNameRaw.slice(1);

                                                return (
                                                    <div key={day.date} className="group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5">
                                                        <span className="text-xs font-medium text-slate-300 w-24 truncate">{dayName}</span>

                                                        <div className="flex items-center gap-3 flex-1 justify-center">
                                                            <span className="text-xl filter drop-shadow-lg group-hover:scale-110 transition-transform duration-300">{info.icon}</span>
                                                        </div>

                                                        <div className="flex items-center justify-end gap-2 text-xs font-mono w-20">
                                                            <span className="text-white font-bold text-sm">{Math.round(day.maxTemp)}°</span>
                                                            <span className="text-slate-600">/</span>
                                                            <span className="text-slate-400">{Math.round(day.minTemp)}°</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. ON THIS DAY & QUOTE */}
                    <div className="glass-panel rounded-3xl p-6 relative overflow-hidden flex flex-col justify-between shadow-2xl group transition-all hover:shadow-primary/5 min-h-[180px]">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950/50 z-0"></div>
                        <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:20px_20px]"></div>

                        <div className="relative z-10 flex flex-col gap-4 h-full">
                            {onThisDayItems.length > 0 && (
                                <div className="p-3 bg-white/5 rounded-2xl border border-white/5 backdrop-blur-md overflow-hidden">
                                    <style>{`
                          @keyframes marquee {
                            0% { left: 100%; transform: translateX(0); }
                            100% { left: 0; transform: translateX(-100%); }
                          }
                        `}</style>
                                    <div className="text-[11px] font-semibold text-slate-300 mb-2 flex items-center gap-2">
                                        <Calendar size={12} className="text-indigo-400" />
                                        {t('onThisDay', lang)}
                                    </div>
                                    <div className="flex items-center overflow-hidden text-sm text-slate-300 leading-relaxed h-6 relative">
                                        <span className="text-indigo-300 font-bold shrink-0 mr-2 z-10 bg-slate-900/50 px-1 rounded">
                                            {onThisDayItems[onThisDayIndex]?.year}
                                        </span>
                                        <div className="flex-1 overflow-hidden relative h-full flex items-center">
                                            <div
                                                key={`${onThisDayIndex}-${onThisDayItems[onThisDayIndex]?.year}`}
                                                className="whitespace-nowrap absolute"
                                                style={{
                                                    animation: `marquee ${Math.max(10, (onThisDayItems[onThisDayIndex]?.text?.length || 0) * 0.15)}s linear forwards`,
                                                    willChange: 'left, transform'
                                                }}
                                                onAnimationEnd={() => {
                                                    setOnThisDayIndex((prev) => (prev + 1) % onThisDayItems.length);
                                                }}
                                            >
                                                {onThisDayItems[onThisDayIndex]?.text}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 p-3 bg-white/5 rounded-xl border border-white/5 relative group/quote hover:bg-white/10 transition-colors flex flex-col justify-center">
                                <Quote className="absolute top-2 left-2 text-indigo-500/30" size={16} />
                                <div className="px-2 pt-2 text-center">
                                    <p className="text-sm font-handwriting text-slate-300 italic leading-relaxed">"{dailyQuote.text}"</p>
                                    <p className="text-[10px] text-indigo-400 text-right mt-2 font-bold uppercase tracking-wider">- {dailyQuote.author}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. NEXT EVENT */}
                    <div className="glass-panel rounded-3xl p-6 relative overflow-hidden flex flex-col shadow-2xl group transition-all hover:shadow-primary/5 min-h-[180px]">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-indigo-950/50 z-0"></div>
                        <div className="absolute inset-0 z-0 opacity-10 bg-[radial-gradient(rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:20px_20px]"></div>

                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center gap-2 mb-4 opacity-80">
                                <Calendar size={16} className="text-indigo-400" />
                                <p className="text-xs uppercase font-bold text-slate-300 tracking-wider">{t('nextEvent', lang)}</p>
                            </div>

                            {nextEvent ? (
                                <div className="flex flex-col justify-center flex-1">
                                    <h4 className="font-bold text-white text-lg truncate pr-2 mb-2" title={nextEvent.title}>{nextEvent.title}</h4>
                                    <div className="flex flex-col gap-2 text-xs text-slate-200/80">
                                        <div className="flex items-center gap-2 font-bold text-slate-100 bg-black/20 p-2 rounded-lg w-fit">
                                            <Calendar size={14} className="shrink-0 text-indigo-400" />
                                            <span>
                                                {new Date(nextEvent.start) < new Date() ? (
                                                    <span className="text-emerald-400 uppercase tracking-wider text-[10px]">{t('pomo_running', lang)}</span>
                                                ) : (
                                                    getEventDateString(nextEvent.start)
                                                )}
                                            </span>
                                            <span className="text-white/30">|</span>
                                            <Clock size={14} className="shrink-0 text-indigo-400" />
                                            <span>
                                                {new Date(nextEvent.start) < new Date()
                                                    ? `${t('until', lang)} ${new Date(nextEvent.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                                    : new Date(nextEvent.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                                }
                                            </span>
                                        </div>
                                        {nextEvent.location && (
                                            <div className="flex items-center gap-2 truncate opacity-75 ml-1">
                                                <MapPin size={12} className="shrink-0" /> {nextEvent.location}
                                            </div>
                                        )}
                                    </div>
                                    <div
                                        className="mt-3 text-[10px] w-fit px-2 py-1 rounded text-white border self-start"
                                        style={{ backgroundColor: `${nextEventCategoryColor}33`, borderColor: `${nextEventCategoryColor}55` }}
                                    >
                                        <span className="flex items-center gap-1">
                                            {nextEventCategoryEmoji && <span className="text-sm">{nextEventCategoryEmoji}</span>}
                                            {nextEventCategoryLabel}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center flex-1 gap-3 opacity-70">
                                    <Sofa size={32} className="text-indigo-300/50" />
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-white">{t('noUpcoming', lang)}</p>
                                        <p className="text-xs opacity-75 text-slate-400">{t('relax', lang)}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {/* POMODORO WIDGET (Row 1, Col 3) */}
                <div className="min-h-0">
                    <PomodoroWidget lang={lang} soundEnabled={user.soundEnabled} />
                </div>

                {/* Row 2: Agenda (Col 1) - conditionally rendered based on calendar module */}
                {isWidgetEnabled('todayEvents') && (
                    <div className="glass-panel p-6 rounded-3xl min-h-[300px] 2xl:min-h-0 flex flex-col [@media(max-height:900px)]:p-4 [@media(max-height:760px)]:p-3 overflow-hidden relative group">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                                    <Calendar size={18} />
                                </div>
                                <div>
                                    <h3 className="text-[clamp(0.75rem,1.3vmin,0.95rem)] font-bold text-white uppercase tracking-wide">{t('todayEvents', lang)}</h3>
                                    <p className="text-[10px] text-slate-300 font-medium">{todayEvents.length} {t('events', lang)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 overflow-y-auto flex-1 pr-1 pb-2 custom-scrollbar relative z-10">
                            {todayEvents.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300 text-[clamp(0.65rem,1.2vmin,0.85rem)] font-medium gap-2">
                                    <Calendar size={32} className="opacity-20" />
                                    <p>{t('noEvents', lang)}</p>
                                </div>
                            ) : (
                                todayEvents.map(ev => {
                                    const now = new Date();
                                    const start = new Date(ev.start);
                                    const end = new Date(ev.end);
                                    const isCurrent = now >= start && now <= end;
                                    const isPast = now > end;
                                    const categoryColor = getEventCategoryColor(ev);
                                    const categoryLabel = getEventCategoryLabel(ev);
                                    const categoryEmoji = getEventCategoryEmoji(ev);

                                    return (
                                        <div key={ev.id} className={`relative flex gap-4 items-start p-3 rounded-2xl border transition-all group/item ${isCurrent ? 'bg-indigo-500/20 border-indigo-500/40 shadow-[0_0_15px_rgba(99,102,241,0.25)]' : 'bg-slate-800/40 border-white/10 hover:bg-slate-700/50 hover:border-white/20'} ${isPast ? 'opacity-60 grayscale' : ''}`}>
                                            {/* Time Column */}
                                            <div className="flex flex-col items-center gap-1 pt-1 shrink-0 w-12">
                                                <span className={`text-sm font-bold font-mono ${isCurrent ? 'text-white' : 'text-slate-200'}`}>
                                                    {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className={`text-[10px] font-mono ${isCurrent ? 'text-white/70' : 'text-slate-300'}`}>
                                                    {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                {isCurrent && (
                                                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse"></span>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <h4 className={`font-bold text-sm truncate ${isCurrent ? 'text-white' : 'text-slate-200'} group-hover/item:text-white transition-colors`}>{ev.title}</h4>

                                                <div className="flex flex-wrap gap-2 mt-1.5">
                                                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/10">
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: categoryColor }}></div>
                                                        {categoryEmoji && <EmojiGlyph emoji={categoryEmoji} size={16} />}
                                                        {categoryLabel}
                                                    </span>
                                                    {ev.location && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/80 border border-white/10 truncate max-w-[120px]">
                                                            <MapPin size={8} />
                                                            {ev.location}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => onViewEvent(ev.id)}
                                                className="self-center p-2 rounded-xl bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-colors opacity-0 group-hover/item:opacity-100"
                                                title="View Event"
                                            >
                                                <ArrowUpRight size={16} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Decorative BG */}
                        <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    </div>
                )}

                {/* Row 2: Favorites (Col 2) - conditionally rendered based on contacts module */}
                {isWidgetEnabled('favorites') && (
                    <div className="glass-panel p-6 rounded-3xl flex flex-col min-h-[300px] 2xl:min-h-0 [@media(max-height:900px)]:p-4 [@media(max-height:760px)]:p-3 overflow-hidden relative">
                        <div className="flex justify-between items-center mb-6 relative z-10">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-400">
                                    <Star size={18} className="fill-yellow-400" />
                                </div>
                                <div>
                                    <h3 className="text-[clamp(0.75rem,1.3vmin,0.95rem)] font-bold text-white uppercase tracking-wide">{t('favorites', lang)}</h3>
                                    <p className="text-[10px] text-slate-300 font-medium">{favorites.length} {t('contacts', lang)}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-1 custom-scrollbar relative z-10">
                            {favorites.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-slate-300 text-[clamp(0.65rem,1.2vmin,0.85rem)] font-medium gap-2">
                                    <Star size={32} className="opacity-20" />
                                    <p>{t('noFavorites', lang)}</p>
                                </div>
                            ) : (
                                favorites.map(c => (
                                    <div key={c.id} className="flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all group">
                                        <div className="relative shrink-0">
                                            <img src={c.avatar} className="w-12 h-12 rounded-full object-cover border-2 border-slate-700 group-hover:border-slate-500 transition-colors" alt={c.name} />
                                            {/* Online/Status indicator could go here if we had it */}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-bold truncate text-white group-hover:text-indigo-300 transition-colors">{c.name}</p>
                                                {/* Birthday Indicator */}
                                                {c.birthday && new Date(c.birthday).getDate() === new Date().getDate() && new Date(c.birthday).getMonth() === new Date().getMonth() && (
                                                    <span className="text-[10px] bg-pink-500/20 text-pink-300 px-1.5 py-0.5 rounded font-bold animate-pulse">
                                                        🎂
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-3 mt-1">
                                                <button
                                                    onClick={() => void handleCopy(c.phone, c.id + '_phone')}
                                                    className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors ${copiedId === c.id + '_phone' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-black/20 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-300'}`}
                                                    title={c.phone}
                                                >
                                                    {copiedId === c.id + '_phone' ? <Check size={10} /> : <Phone size={10} />}
                                                    <span className="max-w-[80px] truncate">{copiedId === c.id + '_phone' ? t('copied', lang) : c.phone || '---'}</span>
                                                </button>

                                                {c.email && (
                                                    <button
                                                        onClick={() => void handleCopy(c.email, c.id + '_email')}
                                                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg transition-colors ${copiedId === c.id + '_email' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-black/20 text-slate-300 hover:bg-pink-500/20 hover:text-pink-300'}`}
                                                        title={c.email}
                                                    >
                                                        {copiedId === c.id + '_email' ? <Check size={10} /> : <Mail size={10} />}
                                                        <span className="max-w-[80px] truncate">{copiedId === c.id + '_email' ? t('copied', lang) : 'Email'}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => onViewContact(c.id)}
                                            className="self-center p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-300 transition-colors opacity-0 group-hover:opacity-100"
                                            title="View Contact"
                                        >
                                            <ArrowUpRight size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Decorative BG */}
                        <div className="absolute -top-12 -left-12 w-40 h-40 bg-yellow-500/5 rounded-full blur-3xl pointer-events-none"></div>
                    </div>
                )}

                {/* Row 2: Finance Widget - conditionally rendered based on finance module */}
                {modulesService.isModuleEnabled(user, 'finance') && (
                    <div className="glass-panel rounded-3xl p-6 flex flex-col min-h-[180px] transition-all hover:shadow-primary/5 [@media(max-height:900px)]:p-4 [@media(max-height:760px)]:p-3">
                        {/* Header */}
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2 opacity-80">
                                <Wallet size={16} className="text-primary" />
                                <p className="text-xs uppercase font-bold text-slate-300 tracking-wider">{t('finance', lang)}</p>
                            </div>
                            <button
                                onClick={() => onNavigate('finance')}
                                className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                                title={t('openFinance', lang)}
                            >
                                <ArrowUpRight size={16} />
                            </button>
                        </div>

                        {/* Balance */}
                        <div className="mb-4">
                            <p className={`text-2xl font-bold font-mono ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                                {formatMoney(balance)}
                            </p>
                            <p className="text-[10px] text-slate-400 uppercase font-medium">{t('balance', lang)}</p>
                        </div>

                        {/* Income/Expense Row */}
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <TrendingUp size={12} className="text-emerald-400" />
                                    <span className="text-[9px] text-slate-400 uppercase font-bold">{t('income', lang)}</span>
                                </div>
                                <p className="text-sm font-bold text-emerald-400 font-mono">{formatMoney(income)}</p>
                            </div>
                            <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <TrendingDown size={12} className="text-red-400" />
                                    <span className="text-[9px] text-slate-400 uppercase font-bold">{t('expense', lang)}</span>
                                </div>
                                <p className="text-sm font-bold text-red-400 font-mono">{formatMoney(expense)}</p>
                            </div>
                        </div>

                        {/* Recent Transactions */}
                        <div className="flex-1 flex flex-col gap-1.5 overflow-y-auto custom-scrollbar">
                            {recentTransactions.length > 0 ? (
                                recentTransactions.slice(0, 3).map(tx => (
                                    <div key={tx.id} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${tx.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                {tx.type === 'income' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-medium text-white truncate" title={tx.description}>{tx.description}</p>
                                                <p className="text-[9px] text-slate-400">{getFinanceCategoryLabel(tx.category, lang)}</p>
                                            </div>
                                        </div>
                                        <span className={`text-[11px] font-mono font-bold shrink-0 ${tx.type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {tx.type === 'income' ? '+' : '-'}{Math.round(tx.amount)}
                                        </span>
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center justify-center h-full text-slate-400 text-xs">
                                    <p>{t('insufficientData', lang)}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>

        </div>
    );
};

export default Dashboard;
