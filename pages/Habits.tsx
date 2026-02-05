
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, Habit } from '../types';
import { db } from '../services/db';
import { useTranslation } from '../services/useTranslation';
import { Plus, X, Trash2, CheckCircle2, Circle, Flame, CalendarCheck, BarChart3, Trophy, Lock, Minus, ShieldCheck, SkipForward } from 'lucide-react';
import ChartWrapper from '../components/ChartWrapper';
import ModalPortal from '../components/ModalPortal';
import RequiredInput from '../components/RequiredInput';
import ach1 from '../assets/achievements/ach_1.webp';
import ach2 from '../assets/achievements/ach_2.webp';
import ach3 from '../assets/achievements/ach_3.webp';
import ach4 from '../assets/achievements/ach_4.webp';
import ach5 from '../assets/achievements/ach_5.webp';
import ach6 from '../assets/achievements/ach_6.webp';
import ach7 from '../assets/achievements/ach_7.webp';
import ach8 from '../assets/achievements/ach_8.webp';
import ach9 from '../assets/achievements/ach_9.webp';
import ach10 from '../assets/achievements/ach_10.webp';
import ach11 from '../assets/achievements/ach_11.webp';
import ach12 from '../assets/achievements/ach_12.webp';
import achievementSound from '../assets/audio/achievement.mp3';

interface HabitsProps {
    user: User;
}

interface Achievement {
    id: string;
    titleKey: string;
    descKey: string;
    imageUrl: string;
}

const COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
];

const ACHIEVEMENTS: Achievement[] = [
    { id: 'ach_1', titleKey: 'ach_1_title', descKey: 'ach_1_desc', imageUrl: ach1 },
    { id: 'ach_2', titleKey: 'ach_2_title', descKey: 'ach_2_desc', imageUrl: ach2 },
    { id: 'ach_3', titleKey: 'ach_3_title', descKey: 'ach_3_desc', imageUrl: ach3 },
    { id: 'ach_4', titleKey: 'ach_4_title', descKey: 'ach_4_desc', imageUrl: ach4 },
    { id: 'ach_5', titleKey: 'ach_5_title', descKey: 'ach_5_desc', imageUrl: ach5 },
    { id: 'ach_6', titleKey: 'ach_6_title', descKey: 'ach_6_desc', imageUrl: ach6 },
    { id: 'ach_7', titleKey: 'ach_7_title', descKey: 'ach_7_desc', imageUrl: ach7 },
    { id: 'ach_8', titleKey: 'ach_8_title', descKey: 'ach_8_desc', imageUrl: ach8 },
    { id: 'ach_9', titleKey: 'ach_9_title', descKey: 'ach_9_desc', imageUrl: ach9 },
    { id: 'ach_10', titleKey: 'ach_10_title', descKey: 'ach_10_desc', imageUrl: ach10 },
    { id: 'ach_11', titleKey: 'ach_11_title', descKey: 'ach_11_desc', imageUrl: ach11 },
    { id: 'ach_12', titleKey: 'ach_12_title', descKey: 'ach_12_desc', imageUrl: ach12 },
];

const formatLocalDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const Habits: React.FC<HabitsProps> = ({ user }) => {
    const { t } = useTranslation();
    const [habits, setHabits] = useState<Habit[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [showAchievements, setShowAchievements] = useState(false);
    const [title, setTitle] = useState('');
    const [titleError, setTitleError] = useState(false);
    const [color, setColor] = useState(COLORS[3]);
    const [loading, setLoading] = useState(true);
    const prevUnlockedRef = useRef<Set<string>>(new Set());
    const hasSyncedInitialData = useRef(false);

    // Normalize "Today" to midnight
    const [today, setToday] = useState(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const lang = user.language || 'it';

    useEffect(() => {
        loadHabits();
    }, [user]);

    useEffect(() => {
        const handleEscape = (event: Event) => {
            let handled = false;
            if (showModal) {
                setShowModal(false);
                handled = true;
            } else if (showAchievements) {
                setShowAchievements(false);
                handled = true;
            }
            if (handled) {
                const custom = event as CustomEvent<{ handled?: boolean }>;
                if (custom.detail) {
                    custom.detail.handled = true;
                }
            }
        };
        window.addEventListener('katanos:escape', handleEscape);
        return () => window.removeEventListener('katanos:escape', handleEscape);
    }, [showModal, showAchievements]);

    // Check every minute if the date has changed
    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            if (now.getTime() !== today.getTime()) {
                setToday(now);
            }
        }, 60000);
        return () => clearInterval(interval);
    }, [today]);

    const loadHabits = async () => {
        const data = await db.habits.list(user.id);
        setHabits(data);
        setLoading(false);
    };

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        const isTitleMissing = !title.trim();
        setTitleError(isTitleMissing);
        if (isTitleMissing) return;

        await db.habits.add({
            userId: user.id,
            title,
            color,
            logs: [],
            skips: [],
            createdAt: new Date().toISOString()
        });

        setTitle('');
        setTitleError(false);
        setShowModal(false);
        loadHabits();
    };

    const handleToggle = async (habitId: string, dateStr: string) => {
        const habit = habits.find(h => h.id === habitId);
        if (!habit) return;

        const isLogged = habit.logs.includes(dateStr);
        const isSkipped = habit.skips?.includes(dateStr);

        if (isLogged) {
            // Logged -> Skipped
            await db.habits.toggleSkip(habitId, dateStr);
        } else if (isSkipped) {
            // Skipped -> Empty
            await db.habits.toggleSkip(habitId, dateStr);
        } else {
            // Empty -> Logged
            await db.habits.toggleLog(habitId, dateStr);
            // Play sound
            new Audio(achievementSound).play().catch(() => { });
        }
        loadHabits();
    };

    const deleteHabit = async (id: string) => {
        await db.habits.delete(id);
        loadHabits();
    };

    // --- Date & Grid Helpers ---
    const weekDays = useMemo(() => {
        const current = new Date(today);
        const day = current.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;

        const monday = new Date(current);
        monday.setDate(current.getDate() + diffToMonday);

        const days = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            days.push(d);
        }
        return days;
    }, [today]);

    const getDayStatus = (habit: Habit, date: Date) => {
        const dateStr = formatLocalDate(date);
        const todayStr = formatLocalDate(today);

        const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
        const creationDate = new Date(habit.createdAt); creationDate.setHours(0, 0, 0, 0);

        const isCompleted = habit.logs.includes(dateStr);
        const isSkipped = habit.skips?.includes(dateStr);
        const isToday = dateStr === todayStr;

        const isBeforeCreation = targetDate.getTime() < creationDate.getTime();
        const isFuture = targetDate.getTime() > today.getTime();

        return { dateStr, isCompleted, isSkipped, isToday, isBeforeCreation, isFuture };
    };

    // --- Stats Logic ---
    const calculateStreak = (logs: string[], skips: string[] = []) => {
        let streak = 0;
        const tStr = formatLocalDate(today);
        const yDate = new Date(today); yDate.setDate(yDate.getDate() - 1);
        const yStr = formatLocalDate(yDate);

        // Determine start date: Today if logged/skipped, else Yesterday
        let checkDateStr = (logs.includes(tStr) || skips.includes(tStr)) ? tStr : yStr;

        let daysChecked = 0;
        while (daysChecked < 3650) { // 10 years max safety
            if (logs.includes(checkDateStr)) {
                streak++;
            } else if (!skips.includes(checkDateStr)) {
                // Neither logged nor skipped -> Break
                break;
            }
            // If skipped, just continue to previous day without incrementing streak

            const d = parseLocalDate(checkDateStr);
            d.setDate(d.getDate() - 1);
            checkDateStr = formatLocalDate(d);
            daysChecked++;
        }
        return streak;
    };

    const calculateConsistency = (habit: Habit) => {
        const creationDate = new Date(habit.createdAt); creationDate.setHours(0, 0, 0, 0);
        const msDiff = today.getTime() - creationDate.getTime();
        const daysLife = Math.floor(msDiff / (1000 * 60 * 60 * 24)) + 1;
        if (daysLife <= 0) return 0;

        const validLogs = habit.logs.filter(l => {
            const ld = parseLocalDate(l); ld.setHours(0, 0, 0, 0);
            return ld.getTime() >= creationDate.getTime() && ld.getTime() <= today.getTime();
        });

        return Math.round((validLogs.length / daysLife) * 100);
    };

    // --- Achievement Unlock Logic ---
    const unlockedAchievements = useMemo(() => {
        const unlockedIds = new Set<string>();

        if (habits.length > 0) unlockedIds.add('ach_1');
        if (habits.length >= 3) unlockedIds.add('ach_7');
        if (habits.length >= 5) unlockedIds.add('ach_8');

        habits.forEach(h => {
            const streak = calculateStreak(h.logs, h.skips);
            const consistency = calculateConsistency(h);
            const creation = new Date(h.createdAt);
            const ageDays = Math.floor((today.getTime() - creation.getTime()) / (1000 * 60 * 60 * 24));

            if (streak >= 3) unlockedIds.add('ach_2');
            if (streak >= 7) unlockedIds.add('ach_3');
            if (streak >= 14) unlockedIds.add('ach_4');
            if (streak >= 30) unlockedIds.add('ach_5');
            if (streak >= 60) unlockedIds.add('ach_6');

            if (consistency >= 100 && ageDays >= 5) unlockedIds.add('ach_9');
            if (consistency >= 100 && ageDays >= 14) unlockedIds.add('ach_10');

            if (ageDays >= 30) unlockedIds.add('ach_11');
            if (ageDays >= 60) unlockedIds.add('ach_12');
        });

        return unlockedIds;
    }, [habits, today]);

    // Notify on new unlocks
    useEffect(() => {
        if (loading) return;

        const newUnlocked = unlockedAchievements;

        if (!hasSyncedInitialData.current) {
            prevUnlockedRef.current = newUnlocked;
            hasSyncedInitialData.current = true;
            return;
        }

        const prev = prevUnlockedRef.current;

        if (newUnlocked.size > prev.size) {
            newUnlocked.forEach(id => {
                if (!prev.has(id)) {
                    const ach = ACHIEVEMENTS.find(a => a.id === id);
                    if (ach) {
                        window.dispatchEvent(new CustomEvent('katanos:notify', {
                            detail: {
                                title: t('achievementUnlocked', lang),
                                message: t(ach.titleKey, lang),
                                type: 'success'
                            }
                        }));
                    }
                }
            });
        }
        prevUnlockedRef.current = newUnlocked;
    }, [unlockedAchievements, lang, loading]);

    const stats = useMemo(() => {
        if (habits.length === 0) return { perfectDays: 0, globalConsistency: 0, chartData: null };

        let perfectDays = 0;
        for (let i = 0; i < 30; i++) {
            const d = new Date(today); d.setDate(d.getDate() - i);
            const dStr = formatLocalDate(d);
            const activeHabits = habits.filter(h => {
                const c = new Date(h.createdAt); c.setHours(0, 0, 0, 0);
                return c.getTime() <= d.getTime();
            });

            if (activeHabits.length > 0) {
                const allDone = activeHabits.every(h => h.logs.includes(dStr) || h.skips?.includes(dStr));
                if (allDone) perfectDays++;
            }
        }

        const totalCons = habits.reduce((acc, h) => acc + calculateConsistency(h), 0);
        const globalCons = Math.round(totalCons / habits.length);

        const chartLabels = weekDays.map(d => d.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', { weekday: 'short' }));
        const chartValues = weekDays.map(d => {
            const dStr = d.toISOString().slice(0, 10);
            return habits.filter(h => {
                const c = new Date(h.createdAt); c.setHours(0, 0, 0, 0);
                const exists = c.getTime() <= d.getTime();
                return exists && (h.logs.includes(dStr) || h.skips?.includes(dStr));
            }).length;
        });

        const chartData = {
            labels: chartLabels,
            datasets: [{
                data: chartValues,
                backgroundColor: '#6366f1',
                borderRadius: 4,
                barThickness: 20
            }]
        };

        return { perfectDays, globalConsistency: globalCons, chartData };
    }, [habits, weekDays, today, lang]);

    return (
        <div className="min-h-0 md:h-full md:overflow-hidden flex flex-col space-y-6 [@media(max-height:900px)]:space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-display font-bold">{t('habitsTitle', lang)}</h2>
                    <p className="text-slate-300 text-sm mt-1">{t('habitsSubtitle', lang)}</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowAchievements(true)}
                        className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 border border-white/5 transition-all group"
                    >
                        <Trophy size={18} className="text-yellow-400 group-hover:scale-110 transition-transform" /> <span className="hidden md:inline">{t('collection', lang)}</span>
                    </button>
                    <button
                        onClick={() => { setShowModal(true); setTitleError(false); }}
                        className="bg-primary hover:bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 shadow-lg shadow-primary/25 transition-all"
                    >
                        <Plus size={18} /> {t('newHabit', lang)}
                    </button>
                </div>
            </div>

            {/* DASHBOARD STATS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 [@media(max-height:900px)]:gap-4 shrink-0">
                <div className="lg:col-span-1 grid grid-cols-2 gap-4 [@media(max-height:900px)]:gap-3">
                    <div className="bg-slate-900/50 border border-white/5 p-4 [@media(max-height:900px)]:p-3 rounded-2xl flex flex-col justify-between">
                        <div className="text-indigo-400 mb-2"><ShieldCheck size={20} /></div>
                        <div>
                            <div className="text-2xl font-bold text-white">{stats.perfectDays}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-300">{t('perfectDays', lang)}</div>
                        </div>
                    </div>
                    <div className="bg-slate-900/50 border border-white/5 p-4 [@media(max-height:900px)]:p-3 rounded-2xl flex flex-col justify-between">
                        <div className="text-emerald-400 mb-2"><CalendarCheck size={20} /></div>
                        <div>
                            <div className="text-2xl font-bold text-white">{habits.length}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-300">{t('totalHabits', lang)}</div>
                        </div>
                    </div>
                    <div className="col-span-2 bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-white/5 p-4 [@media(max-height:900px)]:p-3 rounded-2xl flex items-center justify-between">
                        <div>
                            <div className="text-[10px] uppercase font-bold text-slate-300 mb-1">{t('completionRate', lang)}</div>
                            <div className="text-3xl font-bold text-white">{stats.globalConsistency}%</div>
                        </div>
                        <div className="h-12 w-12 rounded-full border-4 border-indigo-500/30 flex items-center justify-center relative">
                            <Flame size={24} className={`text-orange-400 transition-all ${stats.globalConsistency > 80 ? 'animate-pulse scale-110' : ''}`} />
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 p-5 [@media(max-height:900px)]:p-4 rounded-2xl flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xs font-bold uppercase text-slate-300 flex items-center gap-2"><BarChart3 size={14} /> {t('weeklyOverview', lang)}</h3>
                        <span className="text-[10px] text-slate-300 font-mono">{t('currentWeek', lang)}</span>
                    </div>
                    <div className="flex-1 w-full min-h-[120px]">
                        {stats.chartData ? (
                            <ChartWrapper
                                type="bar"
                                data={stats.chartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: { legend: { display: false } },
                                    scales: {
                                        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { family: "'Outfit', sans-serif" } } },
                                        y: { display: false, grid: { display: false }, min: 0, suggestedMax: Math.max(habits.length, 5) }
                                    }
                                }}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-slate-500 text-xs">{t('noHabits', lang)}</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 [@media(max-height:900px)]:gap-4 pb-6 md:overflow-y-auto md:flex-1 md:min-h-0 custom-scrollbar pr-1">
                {habits.map(habit => {
                    const streak = calculateStreak(habit.logs, habit.skips);
                    const consistency = calculateConsistency(habit);
                    const todayStr = formatLocalDate(today);
                    const bigBtnStatus = getDayStatus(habit, today);
                    const canMarkToday = !bigBtnStatus.isFuture && !bigBtnStatus.isBeforeCreation;

                    return (
                        <div key={habit.id} className={`glass-panel p-6 [@media(max-height:900px)]:p-4 [@media(max-height:760px)]:p-3 rounded-3xl relative overflow-hidden transition-all duration-300 border border-white/5 hover:border-white/10 ${bigBtnStatus.isCompleted ? 'shadow-[0_0_30px_-5px_rgba(var(--glow-color),0.15)]' : ''}`} style={{ '--glow-color': habit.color } as React.CSSProperties}>
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl -mr-10 -mt-10"></div>

                            <div className="flex justify-between items-start mb-6 [@media(max-height:900px)]:mb-4 relative z-10">
                                <div>
                                    <h3 className="text-xl [@media(max-height:900px)]:text-lg font-bold text-white mb-1">{habit.title}</h3>
                                    <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                                        <span className="flex items-center gap-1 text-orange-400"><Flame size={12} /> {streak} {t('streak', lang)}</span>
                                        <span>{consistency}% {t('consistency', lang)}</span>
                                    </div>
                                </div>
                                <button onClick={() => deleteHabit(habit.id)} className="text-slate-500 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                            </div>

                            <div className="flex justify-between items-center mb-6 [@media(max-height:900px)]:mb-4 relative z-10">
                                {weekDays.map((day, i) => {
                                    const { dateStr, isCompleted, isSkipped, isBeforeCreation, isFuture, isToday } = getDayStatus(habit, day);
                                    return (
                                        <div key={i} className="flex flex-col items-center gap-2 [@media(max-height:900px)]:gap-1.5">
                                            <span className={`text-[10px] uppercase font-bold ${isToday ? 'text-white' : 'text-slate-500'}`}>
                                                {day.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', { weekday: 'narrow' })}
                                            </span>
                                            {isBeforeCreation ? (
                                                <div className="w-8 h-8 flex items-center justify-center opacity-20" title={t('notCreatedYet', lang)}><Minus size={8} className="text-slate-500" /></div>
                                            ) : isFuture ? (
                                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 opacity-30 flex items-center justify-center cursor-not-allowed"><Lock size={12} className="text-slate-300" /></div>
                                            ) : (
                                                <button
                                                    onClick={() => handleToggle(habit.id, dateStr)}
                                                    className={`w-8 h-8 [@media(max-height:900px)]:w-7 [@media(max-height:900px)]:h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${isCompleted ? 'text-white shadow-lg scale-105' : isSkipped ? 'bg-white/5 text-slate-300' : 'bg-white/5 text-transparent hover:bg-white/10'}`}
                                                    style={{ backgroundColor: isCompleted ? habit.color : undefined }}
                                                    title={isCompleted ? t('completed', lang) : isSkipped ? t('skipped', lang) : ''}
                                                >
                                                    {isCompleted ? <CheckCircle2 size={16} /> : isSkipped ? <SkipForward size={14} /> : <CheckCircle2 size={16} />}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <button
                                onClick={() => canMarkToday && handleToggle(habit.id, todayStr)}
                                disabled={!canMarkToday}
                                className={`w-full py-3 [@media(max-height:900px)]:py-2 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all relative z-10 ${!canMarkToday ? 'bg-white/5 text-slate-500 cursor-not-allowed opacity-50' : bigBtnStatus.isCompleted ? 'bg-white/10 text-white' : bigBtnStatus.isSkipped ? 'bg-white/5 text-slate-300' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
                            >
                                {!canMarkToday ? <span>{t('notAvailable', lang)}</span> : bigBtnStatus.isCompleted ? <>{t('completed', lang)} <CheckCircle2 size={16} className="text-emerald-400" /></> : bigBtnStatus.isSkipped ? <>{t('skipped', lang)} <SkipForward size={16} /></> : <>{t('markDone', lang)} <Circle size={16} /></>}
                            </button>
                        </div>
                    );
                })}

                {habits.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-300 border-2 border-dashed border-white/5 rounded-3xl">
                        <p className="mb-4">{t('noHabits', lang)}</p>
                        <button onClick={() => { setShowModal(true); setTitleError(false); }} className="text-indigo-400 hover:text-white underline">{t('newHabit', lang)}</button>
                    </div>
                )}
            </div>

            {/* --- MODALS --- */}

            {/* 1. NEW HABIT MODAL */}
            {showModal && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                        <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-md p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar animate-scale-in">
                            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-300 hover:text-white"><X size={20} /></button>
                            <h3 className="text-2xl font-bold mb-6 text-white">{t('newHabit', lang)}</h3>
                            <form onSubmit={handleAdd} className="space-y-6">
                                <RequiredInput
                                    value={title}
                                    onChange={setTitle}
                                    error={titleError}
                                    onErrorClear={() => setTitleError(false)}
                                    label={t('habitName', lang)}
                                    labelClassName="text-xs text-slate-300 mb-2 uppercase font-bold"
                                    inputClassName="w-full bg-slate-900 rounded-xl px-4 py-3 text-white outline-none"
                                    normalBorderClassName="border border-slate-700 focus:border-primary"
                                    placeholder={t('habitPlaceholder', lang)}
                                    autoFocus
                                />
                                <div>
                                    <label className="block text-xs text-slate-300 mb-2 uppercase font-bold">{t('colorTheme', lang)}</label>
                                    <div className="flex gap-3 flex-wrap">
                                        {COLORS.map(c => (
                                            <button key={c} type="button" onClick={() => setColor(c)} className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                                        ))}
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-primary/25 mt-4">{t('save', lang)}</button>
                            </form>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* 2. ACHIEVEMENTS MODAL */}
            {showAchievements && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                        <div className="glass-panel border border-white/10 rounded-3xl w-full max-w-5xl p-5 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh] min-h-0">
                            <button onClick={() => setShowAchievements(false)} className="absolute top-4 right-4 text-slate-300 hover:text-white z-20"><X size={20} /></button>

                            <div className="mb-6 relative z-10 shrink-0">
                                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white flex items-center gap-3">
                                    <Trophy className="text-yellow-400" size={32} />
                                    {t('achievements', lang)}
                                </h3>
                                <p className="text-slate-300 mt-2 text-sm">{unlockedAchievements.size} / {ACHIEVEMENTS.length} {t('unlocked', lang)}</p>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 sm:gap-6 overflow-y-auto custom-scrollbar relative z-10 pb-4 flex-1 min-h-0">
                                {ACHIEVEMENTS.map(ach => {
                                    const isUnlocked = unlockedAchievements.has(ach.id);

                                    return (
                                        <div key={ach.id} className={`relative p-3 sm:p-4 rounded-2xl border transition-all duration-300 group overflow-hidden flex items-center gap-4 ${isUnlocked ? 'bg-white/5 border-indigo-500/30' : 'bg-black/40 border-white/5'}`}>
                                            {/* Glow effect for unlocked */}
                                            {isUnlocked && <div className="absolute -top-10 -right-10 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl group-hover:bg-indigo-500/40 transition-colors"></div>}

                                            {/* Image Container - Larger for full body */}
                                            <div className={`w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl shrink-0 flex items-center justify-center overflow-hidden transition-all duration-500 ${isUnlocked ? 'filter-none opacity-100 scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]' : 'grayscale opacity-30 blur-[1px]'}`}>
                                                <img src={ach.imageUrl} alt="Character" className="w-full h-full object-contain" />
                                            </div>

                                            <div className="relative z-10 w-full min-w-0">
                                                <div className="flex flex-col items-start gap-1 mb-1">
                                                    <div className="flex items-center gap-2 w-full flex-wrap">
                                                        <h4 className={`font-bold text-sm sm:text-base ${isUnlocked ? 'text-white' : 'text-slate-500'}`}>{t(ach.titleKey, lang)}</h4>
                                                        {isUnlocked && (
                                                            <span className="shrink-0 text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20 uppercase tracking-wider">
                                                                {t('unlocked', lang)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-[11px] sm:text-xs text-slate-300 leading-snug line-clamp-2 min-h-[2.5em]">{t(ach.descKey, lang)}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default Habits;
