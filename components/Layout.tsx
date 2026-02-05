import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, CheckSquare, Wallet, Users, LogOut, Settings, X, Coins, Languages, Camera, Upload, Key, Save, Bell, Menu, Activity, Search, RefreshCw, Lightbulb, Globe, Mail, Bug, Database, Info, Sparkles, ShieldAlert, Coffee, Timer, ArrowLeft, Compass, Plus, Trash2, Tag, Palette, Image as ImageIcon, Puzzle, HardDrive, FolderOpen, Clock, ToggleLeft, ToggleRight, Play, BookOpen, ChevronDown } from 'lucide-react';
import appLogo from '../assets/icon.webp';
import loginBackground from '../assets/login-bg.webp';
import defaultAppBg from '../assets/app-bg.webp';
import { CalendarCategory, JournalMood, User } from '../types';
import { db } from '../services/db';
import { buildAvatarDataUri } from '../services/avatar';
import { useTranslation } from '../services/useTranslation';
import { DEFAULT_CALENDAR_CATEGORY_ID, getCalendarCategoriesForUser, getDefaultCalendarCategories } from '../services/calendarCategories';
import { DEFAULT_FINANCE_CATEGORIES, getDefaultFinanceCategories } from '../services/financeCategories';
import { setLastLoginLanguage, setLoginBackground } from '../services/localSettings';
import { THEME_OPTIONS } from '../services/themes';
import { MODULE_REGISTRY, modulesService } from '../services/modules';
import { backupService, backupScheduler } from '../services/backup';
import { getStorageStatus } from '../services/storage';
import CommandPalette from './CommandPalette';
import SeasonalEffects from './SeasonalEffects';
import { usePomodoro } from '../services/PomodoroContext';
import MapsAssistant from './MapsAssistant';
import Select from './Select';
import WindowControls from './WindowControls';
import EmojiPicker from './EmojiPicker';
import EmojiGlyph from './EmojiGlyph';
import ModalPortal from './ModalPortal';
import ColorPicker from './ColorPicker';
import {
    type SettingsTab,
    type DevInfo,
    type BackupHistoryItem,
    type BackupStatus,
    formatTime,
    normalizeCategoryName,
    normalizePin,
} from './layout/index';

interface LayoutProps {
    children: React.ReactNode;
    user: User | null;
    activePage: string;
    onNavigate: (page: string) => void;
    onLogout: () => void;
    onUserUpdate: (user: User) => void;
    devModeActive?: boolean;
    devModeEndsAt?: number | null;
}

const Layout: React.FC<LayoutProps> = ({
    children,
    user,
    activePage,
    onNavigate,
    onLogout,
    onUserUpdate,
    devModeActive = false,
    devModeEndsAt = null,
}) => {
    const { timeLeft, isActive, mode, durations } = usePomodoro();
    const { t } = useTranslation();

    const isTimerActive = isActive || timeLeft !== durations[mode] * 60;

    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isCommandOpen, setIsCommandOpen] = useState(false);
    const [isHowToOpen, setIsHowToOpen] = useState(false);
    const [isAiScoutOpen, setIsAiScoutOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [uiScale, setUiScale] = useState(1);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleteBusy, setIsDeleteBusy] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [pendingExternalUrl, setPendingExternalUrl] = useState<string | null>(null);
    const [emailCopied, setEmailCopied] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'profile' | 'personalization' | 'preferences' | 'categories' | 'modules' | 'backup' | 'system' | 'info'>('profile');
    const [newCalendarCategoryName, setNewCalendarCategoryName] = useState('');
    const [newCalendarCategoryColor, setNewCalendarCategoryColor] = useState('#6366f1');
    const [newCalendarCategoryEmoji, setNewCalendarCategoryEmoji] = useState('');
    const [newFinanceCategoryName, setNewFinanceCategoryName] = useState('');
    const [newJournalMoodName, setNewJournalMoodName] = useState('');
    const [newJournalMoodEmoji, setNewJournalMoodEmoji] = useState('');
    const [emojiPickerTarget, setEmojiPickerTarget] = useState<'new' | string | null>(null);
    const [journalEmojiPickerTarget, setJournalEmojiPickerTarget] = useState<'new' | string | null>(null);
    const [lockPin, setLockPin] = useState('');
    const [lockPinConfirm, setLockPinConfirm] = useState('');
    const [lockPinError, setLockPinError] = useState('');
    const [backupFolderPath, setBackupFolderPath] = useState<string | null>(null);
    const [backupHistory, setBackupHistory] = useState<{ name: string; mtime: number; size: number }[]>([]);
    const [backupStatus, setBackupStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
    const [lastBackupTime, setLastBackupTime] = useState<Date | null>(null);
    const [storageStatus, setStorageStatus] = useState({ ready: false, idbAvailable: false, migrated: false });
    const [isBackupIntervalOpen, setIsBackupIntervalOpen] = useState(false);
    const [restoreBusy, setRestoreBusy] = useState(false);
    const showWindowBar = !isFullscreen;

    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [devInfo, setDevInfo] = useState<{
        appVersion?: string;
        appName?: string;
        isPackaged?: boolean;
        appPath?: string;
        userDataPath?: string;
        katanosDataPath?: string;
        logDir?: string;
        platform?: string;
        arch?: string;
        osVersion?: string;
        locale?: string;
        logPath?: string;
        electronVersion?: string;
        chromeVersion?: string;
        nodeVersion?: string;
        v8Version?: string;
        uptimeSec?: number;
        startedAt?: string;
        totalMemory?: number;
        freeMemory?: number;
    } | null>(null);
    const [devInfoLoading, setDevInfoLoading] = useState(false);
    const [devInfoError, setDevInfoError] = useState('');
    const [devModeRemainingMs, setDevModeRemainingMs] = useState<number | null>(null);

    const [draftUser, setDraftUser] = useState<User | null>(user);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const appBgInputRef = useRef<HTMLInputElement>(null);
    const loginBgInputRef = useRef<HTMLInputElement>(null);
    const restoreFileInputRef = useRef<HTMLInputElement>(null);
    const backupIntervalRef = useRef<HTMLDivElement>(null);
    const originalOpenRef = useRef<typeof window.open | null>(null);

    // Widget Dragging State
    const [widgetPos, setWidgetPos] = useState({ x: window.innerWidth - 280, y: window.innerHeight - 120 });
    const dragOffset = useRef({ x: 0, y: 0 });

    useEffect(() => {
        // Initial position bottom-right
        setWidgetPos({ x: window.innerWidth - 280, y: window.innerHeight - 120 });

        const handleResize = () => {
            setWidgetPos(prev => {
                const { innerWidth, innerHeight } = window;
                let newX = prev.x;
                let newY = prev.y;

                // Clamp to screen bounds
                if (newX > innerWidth - 260) newX = innerWidth - 260;
                if (newY > innerHeight - 100) newY = innerHeight - 100;

                return { x: Math.max(0, newX), y: Math.max(0, newY) };
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        let raf = 0;
        let lastFontScale = Number(document.documentElement.style.getPropertyValue('--app-scale')) || 1;
        let lastUiScale = 1;
        const applyScale = () => {
            const dpr = window.devicePixelRatio || 1;
            const isHiDpi = dpr >= 1.25;
            const fontScale = isHiDpi ? 0.94 : 1;
            const baseWidth = 1536;
            const baseHeight = 864;
            const sizeScale = Math.min(
                1,
                window.innerWidth / baseWidth,
                window.innerHeight / baseHeight
            );
            const nextUiScale = isHiDpi ? sizeScale : 1;
            if (Math.abs(fontScale - lastFontScale) > 0.001) {
                document.documentElement.style.setProperty('--app-scale', String(fontScale));
                lastFontScale = fontScale;
            }
            if (Math.abs(nextUiScale - lastUiScale) > 0.001) {
                setUiScale(nextUiScale);
                lastUiScale = nextUiScale;
            }
        };
        applyScale();
        const handleResize = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(applyScale);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            if (raf) cancelAnimationFrame(raf);
            window.removeEventListener('resize', handleResize);
            document.documentElement.style.setProperty('--app-scale', '1');
        };
    }, []);

    const handleDragStart = (e: React.DragEvent) => {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        dragOffset.current = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        e.dataTransfer.effectAllowed = 'move';
        // Set a dummy data to identify this drag source
        e.dataTransfer.setData('text/plain', 'katanos-widget');
    };

    const handleDragEnd = (e: React.DragEvent) => {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;

        let newX = clientX - dragOffset.current.x;
        let newY = clientY - dragOffset.current.y;

        // Snapping Logic
        const snapThreshold = 50;

        if (newX < snapThreshold) newX = 24; // Left
        if (newX > innerWidth - 260 - snapThreshold) newX = innerWidth - 260; // Right
        if (newY < snapThreshold) newY = 24; // Top
        if (newY > innerHeight - 100 - snapThreshold) newY = innerHeight - 100; // Bottom

        setWidgetPos({ x: newX, y: newY });
    };

    const handleGlobalDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Necessary to allow dropping (and change cursor)
        e.dataTransfer.dropEffect = 'move';
    };

    useEffect(() => {
        setDraftUser(user);
    }, [user, isSettingsOpen]);

    useEffect(() => {
        if (!isSettingsOpen) {
            setEmojiPickerTarget(null);
            setLockPin('');
            setLockPinConfirm('');
            setLockPinError('');
        }
    }, [isSettingsOpen]);

    useEffect(() => {
        if (!isSettingsOpen || settingsTab !== 'backup') return;
        setStorageStatus(getStorageStatus());
    }, [isSettingsOpen, settingsTab]);

    useEffect(() => {
        if (!devModeEndsAt) {
            setDevModeRemainingMs(null);
            return;
        }
        const tick = () => {
            setDevModeRemainingMs(Math.max(0, devModeEndsAt - Date.now()));
        };
        tick();
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [devModeEndsAt]);

    useEffect(() => {
        if (devModeActive) return;
        setDevInfo(null);
        setDevInfoError('');
        setDevInfoLoading(false);
    }, [devModeActive]);

    // Backup scheduler initialization
    useEffect(() => {
        if (!user || !user.backupSettings?.enabled || !user.backupSettings?.folderPath) return;

        // Initialize backup state from user settings
        if (user.backupSettings?.folderPath) {
            setBackupFolderPath(user.backupSettings.folderPath);
        }
        if (user.backupSettings?.lastBackupAt) {
            setLastBackupTime(new Date(user.backupSettings.lastBackupAt));
        }

        // Start backup scheduler
        backupScheduler.start(user.id, user.backupSettings);

        return () => {
            backupScheduler.stop();
        };
    }, [user?.id, user?.backupSettings?.enabled, user?.backupSettings?.interval, user?.backupSettings?.folderPath]);

    // Load backup history when backup tab is opened
    useEffect(() => {
        if (settingsTab !== 'backup') return;
        const currentUser = db.auth.getCurrentUser();
        if (currentUser?.backupSettings?.lastBackupAt) {
            setLastBackupTime(new Date(currentUser.backupSettings.lastBackupAt));
        }
        if (!user?.backupSettings?.folderPath) return;

        const loadBackupHistory = async () => {
            const history = await backupService.getBackupHistory(user.backupSettings?.folderPath || '');
            setBackupHistory(history);
        };

        loadBackupHistory();
    }, [settingsTab, user?.backupSettings?.folderPath]);

    const profileAvatar = (() => {
        if (!draftUser) return '';
        const avatar = (draftUser.avatar || '').trim();
        if (avatar && !avatar.startsWith('http') && !avatar.includes('ui-avatars.com')) {
            return avatar;
        }
        return buildAvatarDataUri(draftUser.username);
    })();
    const lang = user?.language || 'it';
    const calendarCategories = useMemo(() => {
        if (!draftUser) return [];
        return getCalendarCategoriesForUser(draftUser, lang).filter((cat) => !cat.isDefault);
    }, [draftUser, lang]);
    const financeCategories = useMemo(() => (draftUser?.financeCategories || []), [draftUser]);
    const journalMoods = useMemo(() => (draftUser?.journalMoods || []), [draftUser]);
    const defaultFinanceCategoryNames = useMemo(() => {
        const ids = DEFAULT_FINANCE_CATEGORIES.map((cat) => cat.id.toLowerCase());
        const labels = getDefaultFinanceCategories(lang).map((cat) => cat.label.toLowerCase());
        return new Set([...ids, ...labels]);
    }, [lang]);
    const defaultJournalMoodIds = useMemo(() => new Set(['happy', 'neutral', 'sad', 'stressed', 'energetic']), []);
    const emojiCategoryLabels = useMemo(() => ({
        'Smileys & Emotion': t('emojiCategorySmileys', lang),
        'People & Body': t('emojiCategoryPeople', lang),
        'Animals & Nature': t('emojiCategoryNature', lang),
        'Food & Drink': t('emojiCategoryFood', lang),
        'Travel & Places': t('emojiCategoryTravel', lang),
        'Activities': t('emojiCategoryActivities', lang),
        'Objects': t('emojiCategoryObjects', lang),
        'Symbols': t('emojiCategorySymbols', lang),
        'Flags': t('emojiCategoryFlags', lang),
    }), [lang]);
    const resolvedBackupSettings = useMemo(() => {
        const base = backupService.getDefaultSettings();
        const fromUser = (draftUser?.backupSettings || {}) as typeof base & { maxBackups?: number };
        const legacyMax = typeof fromUser.maxBackups === 'number' ? fromUser.maxBackups : null;
        const retentionValue = Number.isFinite(fromUser.retentionValue)
            ? fromUser.retentionValue
            : (legacyMax ?? base.retentionValue);
        return {
            ...base,
            ...fromUser,
            retentionValue,
        };
    }, [draftUser?.backupSettings]);
    const storageStatusLabel = useMemo(() => {
        if (!storageStatus.ready) return t('storageMigrationPending', lang);
        if (!storageStatus.idbAvailable) return t('storageMigrationUnavailable', lang);
        if (storageStatus.migrated) return t('storageMigrationDone', lang);
        return t('storageMigrationReady', lang);
    }, [storageStatus, lang]);
    const storageStatusDetail = useMemo(() => {
        if (!storageStatus.ready) return t('storageMigrationPendingDesc', lang);
        if (!storageStatus.idbAvailable) return t('storageMigrationUnavailableDesc', lang);
        if (storageStatus.migrated) return t('storageMigrationDoneDesc', lang);
        return t('storageMigrationReadyDesc', lang);
    }, [storageStatus, lang]);
    const backupIntervalOptions = useMemo(() => (['30m', '1h', '6h', '12h', '24h', 'weekly', 'monthly'] as const), []);
    const backupIntervalValue = useMemo(() => {
        const interval = resolvedBackupSettings.interval || '24h';
        return (interval === 'daily' ? '24h' : interval) as typeof backupIntervalOptions[number];
    }, [resolvedBackupSettings.interval, backupIntervalOptions]);

    useEffect(() => {
        if (!isBackupIntervalOpen) return;
        const handleClick = (event: MouseEvent) => {
            if (!backupIntervalRef.current) return;
            if (!backupIntervalRef.current.contains(event.target as Node)) {
                setIsBackupIntervalOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [isBackupIntervalOpen]);

    useEffect(() => {
        if (!resolvedBackupSettings.enabled && isBackupIntervalOpen) {
            setIsBackupIntervalOpen(false);
        }
    }, [resolvedBackupSettings.enabled, isBackupIntervalOpen]);

    // Get nav items filtered by enabled modules (must be before conditional return)
    const navItems = useMemo(() => {
        if (!user) return [];
        return modulesService.getNavItems(user, lang);
    }, [user, user?.modulesConfig, lang]);

    useEffect(() => {
        if (!window.katanos?.setRichPresence) return;
        if (!isAiScoutOpen) return;
        void window.katanos.setRichPresence({
            details: t('aiScoutTitle', lang),
            state: t('presence_aiScout', lang),
        });
    }, [isAiScoutOpen, lang]);

    useEffect(() => {
        let pollId: number | null = null;
        let isMounted = true;

        const syncFullscreenState = async () => {
            if (!isMounted) return;
            if (window.katanos?.isFullScreen) {
                try {
                    const status = await window.katanos.isFullScreen();
                    setIsFullscreen(status);
                    return;
                } catch {
                    setIsFullscreen(!!document.fullscreenElement);
                    return;
                }
            }
            setIsFullscreen(!!document.fullscreenElement);
        };

        void syncFullscreenState();
        document.addEventListener('fullscreenchange', syncFullscreenState);

        if (window.katanos?.isFullScreen) {
            pollId = window.setInterval(() => {
                void syncFullscreenState();
            }, 1000);
        }

        return () => {
            isMounted = false;
            document.removeEventListener('fullscreenchange', syncFullscreenState);
            if (pollId) window.clearInterval(pollId);
        };
    }, []);


    // Global Command Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsCommandOpen(prev => !prev);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const exitFullscreenIfNeeded = async () => {
            let isFullScreen = false;
            if (window.katanos?.isFullScreen) {
                try {
                    isFullScreen = await window.katanos.isFullScreen();
                } catch (e) {
                    isFullScreen = false;
                }
            } else {
                isFullScreen = !!document.fullscreenElement;
            }
            if (!isFullScreen) return;
            if (window.katanos?.setFullScreen) {
                await window.katanos.setFullScreen(false);
                return;
            }
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (pendingExternalUrl) {
                setPendingExternalUrl(null);
                return;
            }
            if (isDeleteOpen) {
                setIsDeleteOpen(false);
                return;
            }
            if (isSettingsOpen) {
                setIsSettingsOpen(false);
                return;
            }
            if (isHowToOpen) {
                setIsHowToOpen(false);
                return;
            }
            if (isCommandOpen) {
                setIsCommandOpen(false);
                return;
            }
            if (isAiScoutOpen) {
                setIsAiScoutOpen(false);
                return;
            }
            const escapeEvent = new CustomEvent('katanos:escape', { detail: { handled: false } });
            window.dispatchEvent(escapeEvent);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [pendingExternalUrl, isDeleteOpen, isSettingsOpen, isHowToOpen, isCommandOpen, isAiScoutOpen]);

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            const anchor = target?.closest('a');
            if (!anchor) return;
            const href = anchor.getAttribute('href');
            if (!href || !/^https?:/i.test(href)) return;
            event.preventDefault();
            event.stopPropagation();
            requestExternalOpen(href);
        };

        const originalOpen = window.open;
        originalOpenRef.current = originalOpen;
        const patchedOpen: typeof window.open = (url?: string | URL, target?: string, features?: string) => {
            const resolved = typeof url === 'string' ? url : url?.toString();
            if (resolved && /^https?:/i.test(resolved)) {
                requestExternalOpen(resolved);
                return null;
            }
            return originalOpen.call(window, url as string, target, features);
        };

        window.open = patchedOpen;
        document.addEventListener('click', handleClick, true);
        return () => {
            window.open = originalOpen;
            originalOpenRef.current = null;
            document.removeEventListener('click', handleClick, true);
        };
    }, []);

    // Close mobile menu when navigating
    const handleNavigate = (page: string) => {
        onNavigate(page);
        setIsMobileMenuOpen(false);
        setIsAiScoutOpen(false);
    };

    const handleToggleAiScout = () => {
        setIsAiScoutOpen((prev) => !prev);
        setIsMobileMenuOpen(false);
    };

    const handleDraftChange = (key: keyof User, value: any) => {
        if (draftUser) {
            setDraftUser({ ...draftUser, [key]: value });
        }
    };

    const hasSettingsChanges = useMemo(() => {
        if (!user || !draftUser) return false;
        return JSON.stringify(user) !== JSON.stringify(draftUser);
    }, [user, draftUser]);

    const handleCloseSettings = () => {
        if (hasSettingsChanges) {
            setShowUnsavedConfirm(true);
        } else {
            setIsSettingsOpen(false);
        }
    };

    const confirmCloseSettings = () => {
        setShowUnsavedConfirm(false);
        setDraftUser(user); // Reset draft to original
        setIsSettingsOpen(false);
    };


    const handleCalendarCategoryChange = (id: string, updates: Partial<CalendarCategory>) => {
        if (!draftUser) return;
        const current = draftUser.calendarCategories || [];
        const next = current.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat));
        handleDraftChange('calendarCategories', next);
    };

    const handleAddCalendarCategory = () => {
        if (!draftUser) return;
        const normalized = normalizeCategoryName(newCalendarCategoryName);
        if (!normalized) return;
        const current = draftUser.calendarCategories || [];
        if (current.some((cat) => cat.name.toLowerCase() === normalized.toLowerCase())) {
            setNewCalendarCategoryName('');
            return;
        }
        const defaultIds = new Set(getDefaultCalendarCategories(lang).map((cat) => cat.id));
        let slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (!slug) slug = 'category';
        let id = `custom_${slug}_${Date.now().toString(36)}`;
        while (defaultIds.has(id) || current.some((cat) => cat.id === id)) {
            id = `custom_${slug}_${Date.now().toString(36)}_${Math.floor(Math.random() * 100)}`;
        }
        const newCategory: CalendarCategory = {
            id,
            name: normalized,
            color: newCalendarCategoryColor,
            emoji: newCalendarCategoryEmoji || undefined,
        };
        handleDraftChange('calendarCategories', [...current, newCategory]);
        setNewCalendarCategoryName('');
        setNewCalendarCategoryEmoji('');
    };

    const handleRemoveCalendarCategory = (id: string) => {
        if (!draftUser) return;
        const current = draftUser.calendarCategories || [];
        const next = current.filter((cat) => cat.id !== id);
        handleDraftChange('calendarCategories', next);
    };

    const handleAddFinanceCategory = () => {
        if (!draftUser) return;
        const normalized = normalizeCategoryName(newFinanceCategoryName);
        if (!normalized) return;
        if (defaultFinanceCategoryNames.has(normalized.toLowerCase())) {
            setNewFinanceCategoryName('');
            return;
        }
        if (financeCategories.some((cat) => cat.toLowerCase() === normalized.toLowerCase())) {
            setNewFinanceCategoryName('');
            return;
        }
        handleDraftChange('financeCategories', [...financeCategories, normalized]);
        setNewFinanceCategoryName('');
    };

    const handleRemoveFinanceCategory = (value: string) => {
        if (!draftUser) return;
        const next = financeCategories.filter((cat) => cat !== value);
        handleDraftChange('financeCategories', next);
    };

    const handleJournalMoodChange = (id: string, updates: Partial<JournalMood>) => {
        if (!draftUser) return;
        const current = draftUser.journalMoods || [];
        const next = current.map((mood) => (mood.id === id ? { ...mood, ...updates } : mood));
        handleDraftChange('journalMoods', next);
    };

    const handleAddJournalMood = () => {
        if (!draftUser) return;
        const normalized = normalizeCategoryName(newJournalMoodName);
        if (!normalized) return;
        if (journalMoods.some((mood) => mood.label.toLowerCase() === normalized.toLowerCase())) {
            setNewJournalMoodName('');
            return;
        }
        let slug = normalized.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (!slug) slug = 'mood';
        let id = `custom_${slug}_${Date.now().toString(36)}`;
        while (defaultJournalMoodIds.has(id) || journalMoods.some((mood) => mood.id === id)) {
            id = `custom_${slug}_${Date.now().toString(36)}_${Math.floor(Math.random() * 100)}`;
        }
        if (!newJournalMoodEmoji) return;
        const newMood: JournalMood = {
            id,
            label: normalized,
            emoji: newJournalMoodEmoji,
        };
        handleDraftChange('journalMoods', [...journalMoods, newMood]);
        setNewJournalMoodName('');
        setNewJournalMoodEmoji('');
    };

    const handleRemoveJournalMood = (id: string) => {
        if (!draftUser) return;
        const next = journalMoods.filter((mood) => mood.id !== id);
        handleDraftChange('journalMoods', next);
    };

    // Module toggle handler
    const handleModuleToggle = (moduleId: string, enabled: boolean) => {
        if (!draftUser) return;
        const currentConfig = draftUser.modulesConfig || {};
        handleDraftChange('modulesConfig', {
            ...currentConfig,
            [moduleId]: enabled
        });
    };

    // Backup folder selection handler
    const handleSelectBackupFolder = async () => {
        const folderPath = await backupService.selectBackupFolder();
        if (folderPath) {
            setBackupFolderPath(folderPath);
            handleDraftChange('backupSettings', {
                ...resolvedBackupSettings,
                folderPath
            });
        }
    };

    // Backup now handler
    const handleBackupNow = async () => {
        if (!user || !resolvedBackupSettings.folderPath) return;
        setBackupStatus('running');
        try {
            await backupService.triggerBackupNow(user.id, resolvedBackupSettings);
            setBackupStatus('success');
            setLastBackupTime(new Date());

            // Refresh history
            const history = await backupService.getBackupHistory(resolvedBackupSettings.folderPath || '');
            setBackupHistory(history);
            setTimeout(() => setBackupStatus('idle'), 3000);
        } catch (error) {
            setBackupStatus('error');
            window.dispatchEvent(new CustomEvent('katanos:notify', {
                detail: {
                    title: t('error', lang),
                    message: String(error),
                    type: 'error',
                }
            }));
            setTimeout(() => setBackupStatus('idle'), 3000);
        }
    };

    const handleManualRestore = async () => {
        if (restoreBusy) return;
        restoreFileInputRef.current?.click();
    };

    const handleRestoreFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        setRestoreBusy(true);
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
            try {
                const json = JSON.parse(readerEvent.target?.result as string);
                if (!json.data || !json.timestamp) {
                    throw new Error('Invalid Backup Format');
                }
                db.restore(json);
                window.dispatchEvent(new CustomEvent('katanos:notify', {
                    detail: {
                        title: t('success', lang),
                        message: t('restoreSuccess', lang),
                        type: 'success',
                    }
                }));
                setTimeout(() => window.location.reload(), 1500);
            } catch {
                window.dispatchEvent(new CustomEvent('katanos:notify', {
                    detail: {
                        title: t('error', lang),
                        message: t('invalidBackup', lang),
                        type: 'error',
                    }
                }));
                setRestoreBusy(false);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    const handleEmojiSelect = (emoji: string) => {
        if (emojiPickerTarget === 'new') {
            setNewCalendarCategoryEmoji(emoji);
            setEmojiPickerTarget(null);
            return;
        }
        if (emojiPickerTarget) {
            handleCalendarCategoryChange(emojiPickerTarget, { emoji });
            setEmojiPickerTarget(null);
            return;
        }
        if (journalEmojiPickerTarget === 'new') {
            setNewJournalMoodEmoji(emoji);
            setJournalEmojiPickerTarget(null);
            return;
        }
        if (journalEmojiPickerTarget) {
            handleJournalMoodChange(journalEmojiPickerTarget, { emoji });
        }
        setJournalEmojiPickerTarget(null);
    };

    const handlePasswordChange = async () => {
        setPasswordError('');
        setPasswordSuccess('');
        if (newPassword !== confirmPassword) {
            setPasswordError(t('passwordMismatch', lang));
            return;
        }
        if (!user || !draftUser) return;

        if (user.password) {
            if (!currentPassword) {
                setPasswordError(t('passwordIncorrect', lang));
                return;
            }
            const authCheck = await db.auth.login(user.username, currentPassword);
            if (authCheck.error) {
                setPasswordError(t('passwordIncorrect', lang));
                return;
            }
        }

        try {
            const updatedDraft = { ...draftUser, password: newPassword };
            const updatedUser = await db.auth.updateSettings(user.id, updatedDraft);
            onUserUpdate(updatedUser);

            setPasswordSuccess(t('passwordUpdated', lang));
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setPasswordSuccess(''), 3000);
        } catch (e) {
            setPasswordError(t('error', lang));
        }
    };

    const updateEventsForRemovedCategories = async (updatedUser: User, removedCategoryIds: string[]) => {
        if (!removedCategoryIds.length) return;
        const defaults = getDefaultCalendarCategories(updatedUser.language || lang);
        const fallback = defaults.find((cat) => cat.id === DEFAULT_CALENDAR_CATEGORY_ID) || defaults[0];
        const fallbackId = fallback?.id || DEFAULT_CALENDAR_CATEGORY_ID;
        const fallbackColor = fallback?.color || '#475569';
        const events = await db.events.list(updatedUser.id);
        const toUpdate = events.filter((event) => removedCategoryIds.includes(event.type));
        if (!toUpdate.length) return;
        await Promise.all(
            toUpdate.map((event) =>
                db.events.update(event.id, { type: fallbackId, color: fallbackColor })
            )
        );
    };

    const updateJournalForRemovedMoods = async (updatedUser: User, removedMoodIds: string[]) => {
        if (!removedMoodIds.length) return;
        const entries = await db.journal.list(updatedUser.id);
        const toUpdate = entries.filter((entry) => entry.mood && removedMoodIds.includes(entry.mood));
        if (!toUpdate.length) return;
        await Promise.all(
            toUpdate.map((entry) =>
                db.journal.save({ ...entry, mood: 'neutral' })
            )
        );
    };

    const saveSettings = async () => {
        if (draftUser && user) {
            try {
                const settingsToSave = { ...draftUser };
                const trimmedPin = normalizePin(lockPin);
                const trimmedPinConfirm = normalizePin(lockPinConfirm);
                if (trimmedPin || trimmedPinConfirm) {
                    if (trimmedPin.length < 4) {
                        setLockPinError(t('lockPinLength', lang));
                        return;
                    }
                    if (trimmedPin !== trimmedPinConfirm) {
                        setLockPinError(t('lockPinMismatch', lang));
                        return;
                    }
                    settingsToSave.lockPin = trimmedPin;
                }
                if (settingsToSave.lockEnabled && !user.lockPin && !trimmedPin) {
                    setLockPinError(t('lockPinRequired', lang));
                    return;
                }
                setLockPinError('');
                if (settingsToSave.backupSettings) {
                    const merged = { ...resolvedBackupSettings, ...(settingsToSave.backupSettings as typeof resolvedBackupSettings) } as typeof resolvedBackupSettings & { maxBackups?: number };
                    delete merged.maxBackups;
                    settingsToSave.backupSettings = merged;
                }
                const previousCategoryIds = (user.calendarCategories || []).map((cat) => cat.id);
                const nextCategoryIds = (draftUser.calendarCategories || []).map((cat) => cat.id);
                const removedCategoryIds = previousCategoryIds.filter((id) => !nextCategoryIds.includes(id));
                const previousMoodIds = (user.journalMoods || []).map((mood) => mood.id);
                const nextMoodIds = (draftUser.journalMoods || []).map((mood) => mood.id);
                const removedMoodIds = previousMoodIds.filter((id) => !nextMoodIds.includes(id));
                const updatedUser = await db.auth.updateSettings(user.id, settingsToSave);

                // Persist login background to local storage for the login screen
                if (updatedUser.loginBackground) {
                    setLoginBackground(updatedUser.loginBackground);
                } else {
                    setLoginBackground(loginBackground);
                }

                onUserUpdate(updatedUser);
                if (removedCategoryIds.length > 0) {
                    await updateEventsForRemovedCategories(updatedUser, removedCategoryIds);
                }
                if (removedMoodIds.length > 0) {
                    await updateJournalForRemovedMoods(updatedUser, removedMoodIds);
                }
                // setIsSettingsOpen(false); // Keep open to allow further edits
                setLockPin('');
                setLockPinConfirm('');

                const silent = updatedUser.soundEnabled === false;

                window.dispatchEvent(new CustomEvent('katanos:notify', {
                    detail: {
                        title: t('settingsSaved', lang) || 'Settings Saved',
                        message: t('settingsSavedDesc', lang) || 'Your changes have been applied successfully.',
                        type: 'success',
                        silent: silent
                    }
                }));
            } catch (e) {
                console.error("Failed to save", e);
            }
        }
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleDraftChange('avatar', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAppBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleDraftChange('appBackground', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleLoginBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                handleDraftChange('loginBackground', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleDeleteProfile = async () => {
        if (!user || isDeleteBusy) return;
        setIsDeleteBusy(true);
        setDeleteError('');

        try {
            const ok = db.auth.deleteUserData(user.id);
            if (!ok) {
                setDeleteError(t('deleteProfileError', lang));
                setIsDeleteBusy(false);
                return;
            }
            if (window.katanos?.deleteUserData) {
                await window.katanos.deleteUserData(user.id);
            }
            window.dispatchEvent(new CustomEvent('katanos:notify', {
                detail: {
                    title: t('deleteProfileToastTitle', lang),
                    message: t('deleteProfileToastMessage', lang),
                    type: 'success',
                }
            }));
            setIsDeleteOpen(false);
            setIsSettingsOpen(false);
            onLogout();
        } catch (e) {
            setDeleteError(t('deleteProfileError', lang));
        } finally {
            setIsDeleteBusy(false);
        }
    };
    const storeWebUrl = 'https://apps.microsoft.com/store/detail/9NBNSBD58DNL';
    const katanosWebUrl = 'https://katania.me/';
    const katanosChangelogUrl = 'https://katania.me/katanos';
    const katanosMailTo = 'mailto:kevin@katania.me';
    const aiStudioUrl = 'https://aistudio.google.com/app/apikey';

    const handleReportAi = () => {
        const subject = encodeURIComponent(t('reportAiSubject', lang));
        const body = encodeURIComponent(t('reportAiBody', lang).replace('{userId}', user?.id || 'unknown'));
        const mailto = `mailto:kevin@katania.me?subject=${subject}&body=${body}`;

        if (window.katanos?.openExternal) {
            window.katanos.openExternal(mailto);
        } else {
            window.open(mailto);
        }
    };

    const handleReportBug = async () => {
        const appInfo = window.katanos?.getAppInfo ? await window.katanos.getAppInfo() : null;
        const osLabel = appInfo
            ? `${appInfo.platform || 'unknown'} ${appInfo.osVersion || ''} (${appInfo.arch || 'unknown'})`.trim()
            : navigator.userAgent;
        const timestamp = new Date().toISOString();
        const bodyTemplate = t('reportBugBody', lang);
        const body = bodyTemplate
            .replace('{appVersion}', appInfo?.appVersion || 'unknown')
            .replace('{os}', osLabel || 'unknown')
            .replace('{lang}', lang)
            .replace('{page}', activePage || 'unknown')
            .replace('{userId}', user?.id || 'unknown')
            .replace('{timestamp}', timestamp)
            .replace('{logPath}', appInfo?.logPath || 'errors.log');
        const subject = t('reportBugSubject', lang);

        const mailto = `mailto:kevin@katania.me?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        if (window.katanos?.openExternal) {
            window.katanos.openExternal(mailto);
        } else {
            window.open(mailto);
        }
        if (window.katanos?.openLogFolder) {
            window.katanos.openLogFolder();
        }
    };

    const handleCheckUpdates = async () => {
        requestExternalOpen(storeWebUrl);
    };
    const requestExternalOpen = (url: string) => {
        if (!url) return;
        setPendingExternalUrl(url);
    };

    const handleExternalConfirm = async () => {
        if (!pendingExternalUrl) return;
        const targetUrl = pendingExternalUrl;
        setPendingExternalUrl(null);
        if (window.katanos?.openExternal) {
            await window.katanos.openExternal(targetUrl);
            return;
        }
        const opener = originalOpenRef.current || window.open;
        opener.call(window, targetUrl, '_blank', 'noopener,noreferrer');
    };

    const handleExternalCancel = () => {
        setPendingExternalUrl(null);
    };
    const externalConfirmModal = pendingExternalUrl ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-end p-6 pointer-events-none">
            <div className="pointer-events-auto w-full max-w-sm glass-panel rounded-2xl p-4 shadow-2xl">
                <h4 className="text-sm font-bold text-white">{t('openExternalTitle', lang)}</h4>
                <p className="text-xs text-slate-300 mt-1">{t('openExternalDesc', lang)}</p>
                <p className="text-[10px] text-slate-500 mt-2 break-all">{pendingExternalUrl}</p>
                <div className="flex justify-end gap-2 mt-4">
                    <button
                        onClick={handleExternalCancel}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors"
                    >
                        {t('openExternalCancel', lang)}
                    </button>
                    <button
                        onClick={handleExternalConfirm}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
                    >
                        {t('openExternalConfirm', lang)}
                    </button>
                </div>
            </div>
        </div>
    ) : null;
    const handleLoadDevInfo = async () => {
        if (!window.katanos?.getAppInfo) {
            setDevInfoError(t('devModeInfoUnavailable', lang));
            return null;
        }
        setDevInfoError('');
        setDevInfoLoading(true);
        try {
            const info = await window.katanos.getAppInfo();
            setDevInfo(info || null);
            return info || null;
        } catch (e) {
            setDevInfoError(t('devModeInfoUnavailable', lang));
            return null;
        } finally {
            setDevInfoLoading(false);
        }
    };
    const handleCopyDevInfo = async () => {
        let info = devInfo;
        if (!info) {
            info = await handleLoadDevInfo();
        }
        if (!info) return;
        const payload = [
            `appName: ${info.appName || 'unknown'}`,
            `appVersion: ${info.appVersion || 'unknown'}`,
            `isPackaged: ${typeof info.isPackaged === 'boolean' ? String(info.isPackaged) : 'unknown'}`,
            `appPath: ${info.appPath || 'unknown'}`,
            `userDataPath: ${info.userDataPath || 'unknown'}`,
            `katanosDataPath: ${info.katanosDataPath || 'unknown'}`,
            `logPath: ${info.logPath || 'unknown'}`,
            `logDir: ${info.logDir || 'unknown'}`,
            `platform: ${info.platform || 'unknown'}`,
            `arch: ${info.arch || 'unknown'}`,
            `osVersion: ${info.osVersion || 'unknown'}`,
            `locale: ${info.locale || 'unknown'}`,
            `electron: ${info.electronVersion || 'unknown'}`,
            `chrome: ${info.chromeVersion || 'unknown'}`,
            `node: ${info.nodeVersion || 'unknown'}`,
            `v8: ${info.v8Version || 'unknown'}`,
            `uptimeSec: ${typeof info.uptimeSec === 'number' ? info.uptimeSec.toFixed(0) : 'unknown'}`,
            `startedAt: ${info.startedAt || 'unknown'}`,
            `totalMemory: ${typeof info.totalMemory === 'number' ? info.totalMemory : 'unknown'}`,
            `freeMemory: ${typeof info.freeMemory === 'number' ? info.freeMemory : 'unknown'}`,
        ].join('\n');
        let ok = false;
        if (window.katanos?.copyText) {
            try {
                ok = await window.katanos.copyText(payload);
            } catch (e) {
                ok = false;
            }
        }
        if (!ok && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(payload);
                ok = true;
            } catch (e) {
                ok = false;
            }
        }
        if (ok) {
            window.dispatchEvent(new CustomEvent('katanos:notify', {
                detail: {
                    title: t('devModeInfoCopiedTitle', lang),
                    message: t('devModeInfoCopiedMessage', lang),
                    type: 'success',
                },
            }));
        }
    };
    const handleOpenDevLogs = async () => {
        if (!window.katanos?.openLogFolder) return;
        const result = await window.katanos.openLogFolder();
        if (result?.ok === false) {
            setDevInfoError(t('devModeInfoUnavailable', lang));
        }
    };
    const devModeMinutesLeft = devModeRemainingMs !== null
        ? Math.max(1, Math.ceil(devModeRemainingMs / 60000))
        : 0;
    const devModeDurationLabel = devModeMinutesLeft
        ? t('devModeDesc', lang).replace('{minutes}', String(devModeMinutesLeft))
        : t('devModeDescShort', lang);
    const sessionInfoText = [
        `activePage: ${activePage}`,
        `user: ${user?.username || 'guest'} (${user?.id || 'guest'})`,
        `lang: ${lang}`,
        `sound: ${user?.soundEnabled === false ? 'off' : 'on'}`,
        `seasonal: ${user?.seasonalEffect || 'none'}`,
        `screen: ${window.innerWidth}x${window.innerHeight}`,
        `timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown'}`,
    ].join('\n');
    const copyEmailAddress = async () => {
        const email = 'kevin@katania.me';
        let ok = false;
        if (window.katanos?.copyText) {
            try {
                ok = await window.katanos.copyText(email);
            } catch (e) {
                ok = false;
            }
        }
        if (!ok && navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(email);
                ok = true;
            } catch (e) {
                ok = false;
            }
        }
        if (!ok) {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = email;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.focus();
                textarea.select();
                ok = document.execCommand('copy');
                document.body.removeChild(textarea);
            } catch (e) {
                ok = false;
            }
        }
        if (ok) {
            setEmailCopied(true);
            setTimeout(() => setEmailCopied(false), 2000);
            window.dispatchEvent(new CustomEvent('katanos:notify', {
                detail: {
                    title: t('emailCopiedTitle', lang),
                    message: t('emailCopiedMessage', lang),
                    type: 'success',
                }
            }));
        }
    };

    if (!user) return <>{children}{externalConfirmModal}</>;
    const scrollablePages = new Set(['dashboard', 'agenda', 'todo', 'habits', 'journal', 'finance', 'contacts', 'games', 'bookshelf']);
    const paddedPages = new Set(['agenda', 'todo', 'habits', 'journal', 'finance', 'contacts', 'bookshelf']);

    const currencies = [
        { code: 'EUR', label: 'Euro (€)' },
        { code: 'USD', label: 'USD ($)' },
        { code: 'GBP', label: 'GBP (£)' },
        { code: 'JPY', label: 'JPY (¥)' },
        { code: 'CHF', label: 'CHF' }
    ];

    const languages = [
        { code: 'it', label: 'Italiano' },
        { code: 'en', label: 'English' },
        { code: 'fr', label: 'Français' },
        { code: 'es', label: 'Español' },
        { code: 'de', label: 'Deutsch' }
    ];

    const howToSections = [
        {
            id: 'core',
            title: t('howToUseSectionCoreTitle', lang),
            items: [
                t('howToUseCore1', lang),
                t('howToUseCore2', lang),
                t('howToUseCore3', lang),
            ],
        },
        {
            id: 'system',
            title: t('howToUseSectionSystemTitle', lang),
            items: [
                t('howToUseSystem1', lang),
                t('howToUseSystem2', lang),
                t('howToUseSystem3', lang),
            ],
        },
        {
            id: 'ai',
            title: t('howToUseSectionAiTitle', lang),
            items: [t('howToUseAi1', lang), t('howToUseAi2', lang)],
        },
        {
            id: 'key',
            title: t('howToUseSectionKeyTitle', lang),
            items: [
                <span key="key-1">
                    {t('howToUseKey1', lang)}{' '}
                    <a
                        href={aiStudioUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-300 hover:text-white underline"
                    >
                        aistudio.google.com
                    </a>
                </span>,
                t('howToUseKey2', lang),
                t('howToUseKey3', lang),
            ],
        },
        {
            id: 'data',
            title: t('howToUseSectionDataTitle', lang),
            items: [t('howToUseData1', lang), t('howToUseData2', lang)],
        },
        {
            id: 'tips',
            title: t('howToUseSectionTipsTitle', lang),
            items: [
                t('howToUseTip1', lang),
                t('howToUseTip2', lang),
            ],
        },
    ];

    return (
        <div
            className="flex flex-col h-screen w-screen text-white font-sans overflow-hidden relative"
            style={{
                transform: uiScale === 1 ? undefined : `scale(${uiScale})`,
                transformOrigin: uiScale === 1 ? undefined : 'top left',
                width: uiScale === 1 ? '100vw' : `calc(100vw / ${uiScale})`,
                height: uiScale === 1 ? '100vh' : `calc(100vh / ${uiScale})`,
            }}
            onDragOver={handleGlobalDragOver}
            onDrop={(e) => e.preventDefault()}
        >
            {/* Background Image (Grayscale) */}
            <div
                className="absolute inset-0 bg-cover bg-center grayscale z-0 transition-all duration-700"
                style={{ backgroundImage: `url(${user?.appBackground || defaultAppBg})` }}
            ></div>

            {/* Theme Overlay - Reduced opacity for better background visibility */}
            <div className="absolute inset-0 z-0 opacity-60" style={{ background: 'var(--app-background)' }}></div>

            {/* Command Palette Modal */}
            {isCommandOpen && <CommandPalette user={user} onNavigate={onNavigate} onClose={() => setIsCommandOpen(false)} />}

            {showWindowBar && (
                <div className="relative z-[60] h-10 flex items-center justify-between px-4 window-drag bg-slate-900/80 backdrop-blur-md border-b border-white/10">
                    <div className="flex items-center gap-2 text-slate-200">
                        <div className="w-5 h-5 rounded-md bg-slate-900/70 border border-white/10 overflow-hidden shadow-sm">
                            <img src={appLogo} alt="KatanOS" className="w-full h-full object-contain" />
                        </div>
                        <span className="text-xs font-semibold tracking-wide">{t('appName', lang)}</span>
                    </div>
                    <WindowControls lang={lang} />
                </div>
            )}

            <div className="relative flex flex-1 overflow-hidden">
                {/* Mobile Header */}
                <div className="xl:hidden absolute top-0 left-0 right-0 z-40 p-4 flex justify-between items-center bg-slate-900/80 backdrop-blur-md border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-white hover:bg-white/10 rounded-lg">
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                        <button
                            onClick={() => setIsCommandOpen(true)}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-[10px] font-bold"
                        >
                            <Search size={16} className="text-indigo-300" />
                            <span className="hidden sm:inline bg-black/30 px-1.5 py-0.5 rounded text-[10px] font-bold">CTRL+K</span>
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden">
                            <img src={appLogo} alt="KatanOS" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="font-display font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">KatanOS</h1>
                    </div>
                </div>

                {/* Sidebar (Drawer on Mobile, Static on Desktop) */}
                <div className={`
            fixed inset-y-0 left-0 z-50 w-64 glass-panel m-0 xl:m-4 xl:rounded-3xl flex flex-col shadow-2xl border-r border-white/10 transition-transform duration-300 ease-in-out xl:relative xl:translate-x-0 xl:top-0 overflow-hidden
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            ${showWindowBar ? 'top-10' : 'top-0'}
        `}>
                    <div className="p-8 flex items-center justify-between window-drag">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 overflow-hidden">
                                <img src={appLogo} alt="KatanOS" className="w-full h-full object-contain" />
                            </div>
                            <h1 className="font-display font-bold text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">KatanOS</h1>
                        </div>
                    </div>

                    <div className="px-4 mb-2">
                        <button
                            onClick={() => setIsCommandOpen(true)}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all text-xs text-slate-300 group"
                        >
                            <Search size={14} className="text-indigo-400" />
                            <span className="flex-1 text-left">{t('search', lang)}</span>
                            <span className="bg-black/30 px-1.5 py-0.5 rounded text-[10px] font-bold opacity-50 group-hover:opacity-100 transition-opacity">CTRL+K</span>
                        </button>
                    </div>

                    <div className="flex-1 px-4 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activePage === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavigate(item.id)}
                                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group ${isActive
                                        ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-1'
                                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                        }`}
                                >
                                    <Icon size={18} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                                    <span className="font-medium tracking-wide text-sm">{item.label}</span>
                                </button>
                            );
                        })}
                        <button
                            onClick={handleToggleAiScout}
                            className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group mt-auto ${isAiScoutOpen
                                ? 'bg-primary text-white shadow-lg shadow-primary/25 translate-x-1'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                }`}
                            title={isAiScoutOpen ? t('aiScoutClose', lang) : t('aiScoutOpen', lang)}
                            aria-label={isAiScoutOpen ? t('aiScoutClose', lang) : t('aiScoutOpen', lang)}
                        >
                            <Compass size={18} className={`transition-transform duration-300 ${isAiScoutOpen ? 'scale-110' : 'group-hover:scale-110'}`} />
                            <span className="font-medium tracking-wide text-sm">{t('aiScoutTitle', lang)}</span>
                        </button>
                    </div>

                    <div className="p-4 space-y-2 border-t border-white/5 bg-slate-900/50">
                        <button
                            onClick={() => { setIsSettingsOpen(true); setIsMobileMenuOpen(false); }}
                            className="flex w-full items-center gap-3 p-3 rounded-2xl bg-white/5 mb-3 hover:bg-white/10 transition-colors text-left"
                        >
                            <img src={user.avatar} alt="User" className="w-10 h-10 rounded-full border border-white/10 object-cover" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate text-white">{user.username}</p>
                                <div className="flex items-center gap-1 text-xs text-slate-300">
                                    <Settings size={12} /> <span>{t('settings', lang)}</span>
                                </div>
                            </div>
                        </button>

                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-center gap-2 p-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-xl transition-colors text-sm mb-2"
                        >
                            <LogOut size={16} /> {t('logout', lang)}
                        </button>

                        {/* Copyright & Version Footer */}
                        <div className="pt-4 border-t border-white/5 text-center">
                            <div className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-indigo-400 transition-colors">
                                <span>&copy; {new Date().getFullYear()}</span>
                                <a
                                    href={katanosWebUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-bold flex items-center gap-1"
                                >
                                    Katania <Globe size={10} />
                                </a>
                            </div>
                            <p className="text-[10px] text-slate-600 font-mono mt-1 tracking-wider">v1.0.9</p>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 p-0 xl:p-4 xl:pl-0 relative z-10 w-full">
                    {/* Overlay for mobile menu */}
                    {isMobileMenuOpen && (
                        <div
                            className="fixed inset-0 bg-black/50 z-40 xl:hidden backdrop-blur-md"
                            onClick={() => setIsMobileMenuOpen(false)}
                        ></div>
                    )}

                    <div className={`h-full glass-panel xl:rounded-3xl p-4 pt-20 scroll-smooth relative w-full flex flex-col ${isFullscreen && paddedPages.has(activePage) ? 'xl:pl-8 xl:pr-8 xl:pb-8 xl:pt-10' : 'xl:p-8'
                        }`}>
                        {isFullscreen && (
                            <div className="absolute top-2 right-4 z-50 flex items-center justify-end gap-2 window-no-drag">
                                <WindowControls lang={lang} className="[&>button]:p-1 [&>button]:rounded-md gap-1 [&_svg]:w-3 [&_svg]:h-3" />
                            </div>
                        )}
                        <div className={`flex-1 min-h-0 ${scrollablePages.has(activePage) ? 'overflow-y-auto pr-1 custom-scrollbar' : 'overflow-hidden'}`}>
                            {children}
                        </div>
                    </div>
                </div>
            </div>

            {isAiScoutOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
                        <div className="relative w-full max-w-6xl h-[80vh]">
                            <button
                                onClick={() => setIsAiScoutOpen(false)}
                                className="absolute -top-3 -right-3 z-20 p-2 rounded-full bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
                                title={t('aiScoutClose', lang)}
                                aria-label={t('aiScoutClose', lang)}
                            >
                                <X size={18} />
                            </button>
                            <div className="w-full h-full">
                                <MapsAssistant />
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* Cloud Sync / Backup Modal */}
            {/* How To Use Modal */}
            {isHowToOpen && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
                        <div className="w-full max-w-3xl glass-panel rounded-3xl p-6 relative shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
                            <button onClick={() => setIsHowToOpen(false)} className="absolute top-4 right-4 text-slate-300 hover:text-white">
                                <X size={20} />
                            </button>
                            <div className="mb-6">
                                <h3 className="text-xl font-bold">{t('howToUseTitle', lang)}</h3>
                                <p className="text-xs text-slate-300 mt-2">{t('howToUseSubtitle', lang)}</p>
                            </div>
                            <div className="space-y-4">
                                {howToSections.map((section) => (
                                    <div key={section.id} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                                        <h4 className="text-sm font-bold text-white mb-2">{section.title}</h4>
                                        <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside">
                                            {section.items.map((item, index) => (
                                                <li key={`${section.id}-${index}`}>{item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {/* External Link Confirm */}
            {externalConfirmModal}

            {/* Settings Modal */}
            {isSettingsOpen && draftUser && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
                    <div className="w-full max-w-5xl h-[80vh] glass-panel rounded-3xl flex overflow-hidden shadow-2xl relative">
                        {/* Close Button */}
                        <button
                            onClick={handleCloseSettings}
                            className="absolute top-4 right-4 z-10 p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                        >
                            <X size={20} />
                        </button>

                        {/* Sidebar */}
                        <div className="w-64 bg-slate-900/50 border-r border-white/10 p-6 flex flex-col gap-2 hidden md:flex">
                            <h3 className="text-xl font-bold text-white mb-6 px-2">{t('settings', lang)}</h3>

                            <button
                                onClick={() => setSettingsTab('profile')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'profile' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                            >
                                <Users size={18} /> {t('tabProfile', lang)}
                            </button>
                            <button
                                onClick={() => setSettingsTab('personalization')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'personalization' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                            >
                                <Palette size={18} /> {t('tabPersonalization', lang)}
                            </button>
                            <button
                                onClick={() => setSettingsTab('preferences')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'preferences' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                            >
                                <Settings size={18} /> {t('tabPreferences', lang)}
                            </button>
                            <button
                                onClick={() => setSettingsTab('categories')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'categories' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                            >
                                <Tag size={18} /> {t('tabCategories', lang)}
                            </button>
                            <button
                                onClick={() => setSettingsTab('modules')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'modules' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                            >
                                <Puzzle size={18} /> {t('tabModules', lang)}
                            </button>
                            <button
                                onClick={() => setSettingsTab('backup')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'backup' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                            >
                                <HardDrive size={18} /> {t('tabBackup', lang)}
                            </button>
                            <button
                                onClick={() => setSettingsTab('system')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'system' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                            >
                                <Database size={18} /> {t('tabSystem', lang)}
                            </button>
                            <button
                                onClick={() => setSettingsTab('info')}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${settingsTab === 'info' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-300 hover:text-white hover:bg-white/5'}`}
                            >
                                <Info size={18} /> {t('tabInfo', lang)}
                            </button>

                            <div className="mt-auto">
                                <button
                                    onClick={saveSettings}
                                    className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all border border-white/10"
                                >
                                    <Save size={18} /> {t('saveChanges', lang)}
                                </button>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-transparent relative flex flex-col">
                            {/* Mobile Tabs */}
                            <div className="md:hidden flex items-center gap-2 p-4 border-b border-white/5 overflow-x-auto custom-scrollbar">
                                <button onClick={() => setSettingsTab('profile')} className={`p-2 rounded-lg ${settingsTab === 'profile' ? 'bg-primary text-white' : 'text-slate-300'}`}><Users size={20} /></button>
                                <button onClick={() => setSettingsTab('personalization')} className={`p-2 rounded-lg ${settingsTab === 'personalization' ? 'bg-primary text-white' : 'text-slate-300'}`}><Palette size={20} /></button>
                                <button onClick={() => setSettingsTab('preferences')} className={`p-2 rounded-lg ${settingsTab === 'preferences' ? 'bg-primary text-white' : 'text-slate-300'}`}><Settings size={20} /></button>
                                <button onClick={() => setSettingsTab('categories')} className={`p-2 rounded-lg ${settingsTab === 'categories' ? 'bg-primary text-white' : 'text-slate-300'}`}><Tag size={20} /></button>
                                <button onClick={() => setSettingsTab('modules')} className={`p-2 rounded-lg ${settingsTab === 'modules' ? 'bg-primary text-white' : 'text-slate-300'}`}><Puzzle size={20} /></button>
                                <button onClick={() => setSettingsTab('backup')} className={`p-2 rounded-lg ${settingsTab === 'backup' ? 'bg-primary text-white' : 'text-slate-300'}`}><HardDrive size={20} /></button>
                                <button onClick={() => setSettingsTab('system')} className={`p-2 rounded-lg ${settingsTab === 'system' ? 'bg-primary text-white' : 'text-slate-300'}`}><Database size={20} /></button>
                                <button onClick={() => setSettingsTab('info')} className={`p-2 rounded-lg ${settingsTab === 'info' ? 'bg-primary text-white' : 'text-slate-300'}`}><Info size={20} /></button>
                            </div>

                            <div className="p-6 md:p-8 max-w-3xl mx-auto w-full">

                                {settingsTab === 'profile' && (
                                    <div className="space-y-8 animate-fade-in">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">{t('profileSettings', lang)}</h2>
                                            <p className="text-slate-300 text-sm">{t('profileSettingsDesc', lang)}</p>
                                        </div>

                                        <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="relative group">
                                                <img src={profileAvatar} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-slate-800 shadow-xl" />
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-full shadow-lg hover:bg-indigo-500 transition-colors"
                                                >
                                                    <Camera size={16} />
                                                </button>
                                            </div>
                                            <div className="text-center sm:text-left">
                                                <h3 className="text-lg font-bold text-white">{draftUser.username}</h3>
                                                <p className="text-slate-300 text-sm mb-3">{t('changeAvatarDesc', lang)}</p>
                                                <div className="flex justify-center sm:justify-start">
                                                    <button
                                                        onClick={() => fileInputRef.current?.click()}
                                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                                    >
                                                        <Upload size={14} /> {t('uploadPhoto', lang)}
                                                    </button>
                                                </div>
                                                <input
                                                    type="file"
                                                    ref={fileInputRef}
                                                    className="hidden"
                                                    accept="image/*"
                                                    onChange={handleAvatarUpload}
                                                />
                                            </div>
                                        </div>

                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Key size={18} /> {t('changePassword', lang)}</h3>
                                            <div className="space-y-4">
                                                <div>
                                                    <label className="text-xs text-slate-300 mb-1 block">{t('currentPassword', lang)}</label>
                                                    <input
                                                        type="password"
                                                        value={currentPassword}
                                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-primary text-sm"
                                                        placeholder="••••••"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="text-xs text-slate-300 mb-1 block">{t('newPassword', lang)}</label>
                                                        <input
                                                            type="password"
                                                            value={newPassword}
                                                            onChange={(e) => setNewPassword(e.target.value)}
                                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-primary text-sm"
                                                            placeholder="••••••"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs text-slate-300 mb-1 block">{t('passwordConfirm', lang)}</label>
                                                        <input
                                                            type="password"
                                                            value={confirmPassword}
                                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-primary text-sm"
                                                            placeholder="••••••"
                                                        />
                                                    </div>
                                                </div>

                                                {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
                                                {passwordSuccess && <p className="text-xs text-emerald-400">{passwordSuccess}</p>}

                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={handlePasswordChange}
                                                        disabled={!currentPassword || !newPassword || !confirmPassword}
                                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold transition-colors"
                                                    >
                                                        {t('updatePassword', lang)}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="pt-8 border-t border-white/5">
                                            <h3 className="text-red-400 font-bold mb-2 flex items-center gap-2"><ShieldAlert size={18} /> {t('dangerZone', lang)}</h3>
                                            <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-white font-medium mb-1">{t('deleteProfileTitle', lang)}</p>
                                                    <p className="text-xs text-slate-300">{t('deleteProfileDesc', lang)}</p>
                                                </div>
                                                <button
                                                    onClick={() => setIsDeleteOpen(true)}
                                                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-bold transition-colors whitespace-nowrap"
                                                >
                                                    {t('deleteProfileButton', lang)}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'personalization' && (
                                    <div className="space-y-8 animate-fade-in">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">{t('tabPersonalization', lang)}</h2>
                                            <p className="text-slate-300 text-sm">{t('personalizationDesc', lang)}</p>
                                        </div>

                                        {/* Themes */}
                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <label className="text-sm font-medium text-slate-300 mb-1 block flex items-center gap-2">
                                                <Sparkles size={16} className="text-cyan-400" /> {t('themeTitle', lang)}
                                            </label>
                                            <p className="text-xs text-slate-300 mb-4">{t('themeDesc', lang)}</p>
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                {THEME_OPTIONS.map((option) => {
                                                    const isActive = (draftUser.theme || 'default') === option.id;
                                                    return (
                                                        <button
                                                            key={option.id}
                                                            onClick={() => handleDraftChange('theme', option.id)}
                                                            className={`group rounded-2xl border p-2 text-left transition-all ${isActive ? 'border-primary bg-primary/10' : 'border-white/10 bg-slate-900/40 hover:border-white/30'}`}
                                                        >
                                                            <div
                                                                className="h-16 w-full rounded-xl border border-white/10"
                                                                style={{ background: option.preview }}
                                                            ></div>
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <span className="w-2 h-2 rounded-full" style={{ background: option.primary }}></span>
                                                                <span className="w-2 h-2 rounded-full" style={{ background: option.secondary }}></span>
                                                                <p className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-slate-300'}`}>
                                                                    {t(option.labelKey, lang)}
                                                                </p>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Backgrounds */}
                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <label className="text-sm font-medium text-slate-300 mb-4 block flex items-center gap-2">
                                                <ImageIcon size={16} className="text-purple-400" /> {t('backgrounds', lang)}
                                            </label>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                {/* App Background */}
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('appBackground', lang)}</p>
                                                    <div className="space-y-3">
                                                        <button
                                                            onClick={() => handleDraftChange('appBackground', undefined)}
                                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${!draftUser.appBackground ? 'bg-primary/20 border-primary text-white' : 'bg-slate-900/50 border-white/10 text-slate-300 hover:bg-white/5'}`}
                                                        >
                                                            <div className="w-10 h-10 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${defaultAppBg})` }}></div>
                                                            <span className="text-sm font-medium">{t('bgDefaultApp', lang)}</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDraftChange('appBackground', loginBackground)}
                                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${draftUser.appBackground === loginBackground ? 'bg-primary/20 border-primary text-white' : 'bg-slate-900/50 border-white/10 text-slate-300 hover:bg-white/5'}`}
                                                        >
                                                            <div className="w-10 h-10 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${loginBackground})` }}></div>
                                                            <span className="text-sm font-medium">{t('bgDefaultLogin', lang)}</span>
                                                        </button>
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => appBgInputRef.current?.click()}
                                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${draftUser.appBackground && draftUser.appBackground !== loginBackground ? 'bg-primary/20 border-primary text-white' : 'bg-slate-900/50 border-white/10 text-slate-300 hover:bg-white/5'}`}
                                                            >
                                                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden">
                                                                    {draftUser.appBackground && draftUser.appBackground !== loginBackground ? (
                                                                        <img src={draftUser.appBackground} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <Upload size={16} />
                                                                    )}
                                                                </div>
                                                                <span className="text-sm font-medium">{t('bgCustom', lang)}</span>
                                                            </button>
                                                            <input
                                                                type="file"
                                                                ref={appBgInputRef}
                                                                className="hidden"
                                                                accept="image/*"
                                                                onChange={handleAppBgUpload}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Login Background */}
                                                <div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t('loginBackground', lang)}</p>
                                                    <div className="space-y-3">
                                                        <button
                                                            onClick={() => handleDraftChange('loginBackground', undefined)}
                                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${!draftUser.loginBackground || draftUser.loginBackground === loginBackground ? 'bg-primary/20 border-primary text-white' : 'bg-slate-900/50 border-white/10 text-slate-300 hover:bg-white/5'}`}
                                                        >
                                                            <div className="w-10 h-10 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${loginBackground})` }}></div>
                                                            <span className="text-sm font-medium">{t('bgDefaultLogin', lang)}</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDraftChange('loginBackground', defaultAppBg)}
                                                            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${draftUser.loginBackground === defaultAppBg ? 'bg-primary/20 border-primary text-white' : 'bg-slate-900/50 border-white/10 text-slate-300 hover:bg-white/5'}`}
                                                        >
                                                            <div className="w-10 h-10 rounded-lg bg-cover bg-center" style={{ backgroundImage: `url(${defaultAppBg})` }}></div>
                                                            <span className="text-sm font-medium">{t('bgDefaultApp', lang)}</span>
                                                        </button>
                                                        <div className="relative">
                                                            <button
                                                                onClick={() => loginBgInputRef.current?.click()}
                                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${draftUser.loginBackground && draftUser.loginBackground !== loginBackground && draftUser.loginBackground !== defaultAppBg ? 'bg-primary/20 border-primary text-white' : 'bg-slate-900/50 border-white/10 text-slate-300 hover:bg-white/5'}`}
                                                            >
                                                                <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center overflow-hidden">
                                                                    {draftUser.loginBackground && draftUser.loginBackground !== loginBackground && draftUser.loginBackground !== defaultAppBg ? (
                                                                        <img src={draftUser.loginBackground} className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <Upload size={16} />
                                                                    )}
                                                                </div>
                                                                <span className="text-sm font-medium">{t('bgCustom', lang)}</span>
                                                            </button>
                                                            <input
                                                                type="file"
                                                                ref={loginBgInputRef}
                                                                className="hidden"
                                                                accept="image/*"
                                                                onChange={handleLoginBgUpload}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Seasonal Effects */}
                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <label className="text-sm font-medium text-slate-300 mb-4 block flex items-center gap-2">
                                                <Sparkles size={16} className="text-emerald-400" /> {t('seasonalEffects', lang)}
                                            </label>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                {['none', 'snow', 'leaves', 'blossom', 'fireflies'].map((effect) => (
                                                    <button
                                                        key={effect}
                                                        onClick={() => handleDraftChange('seasonalEffect', effect)}
                                                        className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${draftUser.seasonalEffect === effect || (!draftUser.seasonalEffect && effect === 'none') ? 'bg-primary border-primary text-white' : 'bg-slate-900 border-white/10 text-slate-300 hover:border-white/30'}`}
                                                    >
                                                        {t(`seasonal_${effect}`, lang)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'preferences' && (
                                    <div className="space-y-8 animate-fade-in">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">{t('appPreferences', lang)}</h2>
                                            <p className="text-slate-300 text-sm">{t('appPreferencesDesc', lang)}</p>
                                        </div>

                                        <div className="grid gap-6">
                                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                                    <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${draftUser.soundEnabled === false ? 'bg-primary border-primary' : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'}`}>
                                                        {draftUser.soundEnabled === false && <CheckSquare size={14} className="text-white" />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={draftUser.soundEnabled === false}
                                                        onChange={(e) => handleDraftChange('soundEnabled', !e.target.checked)}
                                                    />
                                                    <span className="text-sm font-medium text-slate-200">{t('disableSounds', lang)}</span>
                                                </label>
                                            </div>

                                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                                <label className="text-sm font-medium text-slate-300 mb-4 block flex items-center gap-2">
                                                    <Languages size={16} className="text-indigo-400" /> {t('language', lang)}
                                                </label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {languages.map(l => (
                                                        <button
                                                            key={l.code}
                                                            onClick={() => {
                                                                handleDraftChange('language', l.code);
                                                                setLastLoginLanguage(l.code);
                                                            }}
                                                            className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all ${draftUser.language === l.code ? 'bg-primary border-primary text-white' : 'bg-slate-900 border-white/10 text-slate-300 hover:border-white/30'}`}
                                                        >
                                                            {l.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                                <label className="flex items-start gap-3 cursor-pointer select-none">
                                                    <div className={`mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${draftUser.clockUse12h ? 'bg-primary border-primary' : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'}`}>
                                                        {draftUser.clockUse12h && <CheckSquare size={14} className="text-white" />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={draftUser.clockUse12h === true}
                                                        onChange={(e) => handleDraftChange('clockUse12h', e.target.checked)}
                                                    />
                                                    <div>
                                                        <span className="text-sm font-medium text-slate-200 flex items-center gap-2">
                                                            <Timer size={16} className="text-cyan-400" /> {t('clockFormatLabel', lang)}
                                                        </span>
                                                        <p className="text-xs text-slate-300 mt-1">{t('clockFormatDesc', lang)}</p>
                                                    </div>
                                                </label>
                                            </div>

                                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                                <label className="text-sm font-medium text-slate-300 mb-4 block flex items-center gap-2">
                                                    <Coins size={16} className="text-yellow-400" /> {t('currency', lang)}
                                                </label>
                                                <Select
                                                    value={draftUser.currency || 'EUR'}
                                                    onChange={(val) => handleDraftChange('currency', val)}
                                                    options={currencies.map(c => ({ value: c.code, label: c.label }))}
                                                />
                                            </div>

                                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                                <div className="flex items-start justify-between gap-4 mb-4">
                                                    <div>
                                                        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                            <Key size={16} className="text-rose-400" /> {t('lockSettingsTitle', lang)}
                                                        </label>
                                                        <p className="text-xs text-slate-300 mt-1">{t('lockSettingsDesc', lang)}</p>
                                                    </div>
                                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                                        <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${draftUser.lockEnabled === true ? 'bg-primary border-primary' : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'}`}>
                                                            {draftUser.lockEnabled === true && <CheckSquare size={14} className="text-white" />}
                                                        </div>
                                                        <input
                                                            type="checkbox"
                                                            className="hidden"
                                                            checked={draftUser.lockEnabled === true}
                                                            onChange={(e) => handleDraftChange('lockEnabled', e.target.checked)}
                                                        />
                                                        <span className="text-xs text-slate-300">{t('lockEnable', lang)}</span>
                                                    </label>
                                                </div>

                                                {draftUser.lockEnabled && (
                                                    <>
                                                        <div className="mt-4 grid grid-cols-2 gap-4 animate-fade-in">
                                                            <div>
                                                                <label className="text-[10px] text-slate-300 uppercase font-bold">{t('lockPinLabel', lang)}</label>
                                                                <input
                                                                    type="password"
                                                                    inputMode="numeric"
                                                                    value={lockPin}
                                                                    onChange={(e) => {
                                                                        setLockPin(normalizePin(e.target.value));
                                                                        setLockPinError('');
                                                                    }}
                                                                    placeholder="••••"
                                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none text-sm focus:border-primary tracking-[0.25em]"
                                                                />
                                                                <p className="text-[10px] text-slate-500 mt-2">{t('lockPinHint', lang)}</p>
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] text-slate-300 uppercase font-bold">{t('lockPinConfirmLabel', lang)}</label>
                                                                <input
                                                                    type="password"
                                                                    inputMode="numeric"
                                                                    value={lockPinConfirm}
                                                                    onChange={(e) => {
                                                                        setLockPinConfirm(normalizePin(e.target.value));
                                                                        setLockPinError('');
                                                                    }}
                                                                    placeholder="••••"
                                                                    className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none text-sm focus:border-primary tracking-[0.25em]"
                                                                />
                                                            </div>
                                                        </div>

                                                        <div className="mt-4">
                                                            <div className="flex justify-between items-center mb-2">
                                                                <label className="text-[10px] text-slate-300 uppercase font-bold">{t('lockTimeoutLabel', lang)}</label>
                                                                <span className="text-xs text-slate-300 font-bold">
                                                                    {draftUser.lockTimeoutMinutes || 5} {t('minutes', lang)}
                                                                </span>
                                                            </div>
                                                            <input
                                                                type="range"
                                                                min="1"
                                                                max="60"
                                                                step="1"
                                                                value={draftUser.lockTimeoutMinutes || 5}
                                                                onChange={(e) => handleDraftChange('lockTimeoutMinutes', parseInt(e.target.value, 10))}
                                                                className="w-full accent-primary h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                                            />
                                                        </div>

                                                        {lockPinError && (
                                                            <div className="mt-3 bg-red-500/10 border border-red-500/20 p-2 rounded-lg text-xs text-red-400">
                                                                {lockPinError}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>

                                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                                <div className="flex justify-between items-center mb-4">
                                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                        <Bell size={16} className="text-rose-400" /> {t('notifTime', lang)}
                                                    </label>
                                                    <span className="bg-white/10 px-2 py-1 rounded text-xs font-bold text-white">{draftUser.notificationAdvance || 30} {t('minutes', lang)}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="5"
                                                    max="60"
                                                    step="5"
                                                    value={draftUser.notificationAdvance || 30}
                                                    onChange={(e) => handleDraftChange('notificationAdvance', parseInt(e.target.value))}
                                                    className="w-full accent-primary h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                                />
                                                <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                                                    <span>5 min</span>
                                                    <span>60 min</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'categories' && (
                                    <div className="space-y-8 animate-fade-in">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">{t('customCategoriesTitle', lang)}</h2>
                                            <p className="text-slate-300 text-sm">{t('customCategoriesDesc', lang)}</p>
                                        </div>

                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                        <Calendar size={16} className="text-indigo-400" /> {t('calendarCategoryTitle', lang)}
                                                    </label>
                                                    <p className="text-xs text-slate-300 mt-1">{t('calendarCategoryDesc', lang)}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px_auto] gap-3">
                                                <div>
                                                    <label className="text-[10px] text-slate-300 uppercase font-bold">{t('calendarCategoryName', lang)}</label>
                                                    <input
                                                        value={newCalendarCategoryName}
                                                        onChange={(e) => setNewCalendarCategoryName(e.target.value)}
                                                        placeholder={t('calendarCategoryPlaceholder', lang)}
                                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none text-sm focus:border-primary"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-300 uppercase font-bold">{t('calendarCategoryColor', lang)}</label>
                                                    <ColorPicker
                                                        value={newCalendarCategoryColor}
                                                        onChange={setNewCalendarCategoryColor}
                                                        showInput
                                                        buttonClassName="w-full h-[42px] bg-slate-900/50 border border-white/10 rounded-xl p-1"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-300 uppercase font-bold">{t('calendarCategoryEmoji', lang)}</label>
                                                    <button
                                                        onClick={() => {
                                                            setEmojiPickerTarget('new');
                                                            setJournalEmojiPickerTarget(null);
                                                        }}
                                                        className="w-full h-[42px] bg-slate-900/50 border border-white/10 rounded-xl flex items-center justify-center text-lg hover:border-primary transition-colors"
                                                    >
                                                        {newCalendarCategoryEmoji ? (
                                                            <EmojiGlyph emoji={newCalendarCategoryEmoji} size={18} />
                                                        ) : (
                                                            <span className="text-[10px] text-slate-300">{t('calendarCategoryPickEmoji', lang)}</span>
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="flex items-end">
                                                    <button
                                                        onClick={handleAddCalendarCategory}
                                                        disabled={!newCalendarCategoryName.trim()}
                                                        className="w-full bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        <Plus size={14} /> {t('calendarCategoryAdd', lang)}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-3">
                                                {calendarCategories.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500">{t('calendarCategoryEmpty', lang)}</p>
                                                ) : (
                                                    calendarCategories.map((cat) => (
                                                        <div key={cat.id} className="grid grid-cols-1 md:grid-cols-[1fr_120px_140px_auto] gap-3 items-center p-3 rounded-xl bg-slate-900/40 border border-white/10">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-2 h-8 rounded-full" style={{ backgroundColor: cat.color }}></div>
                                                                <input
                                                                    value={cat.name}
                                                                    onChange={(e) => handleCalendarCategoryChange(cat.id, { name: e.target.value })}
                                                                    className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-primary"
                                                                />
                                                            </div>
                                                            <ColorPicker
                                                                value={cat.color}
                                                                onChange={(color) => handleCalendarCategoryChange(cat.id, { color })}
                                                                showInput
                                                                buttonClassName="w-full h-[36px] bg-slate-900/50 border border-white/10 rounded-xl p-1"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    setEmojiPickerTarget(cat.id);
                                                                    setJournalEmojiPickerTarget(null);
                                                                }}
                                                                className="w-full h-[36px] bg-slate-900/50 border border-white/10 rounded-xl flex items-center justify-center text-base hover:border-primary transition-colors"
                                                            >
                                                                {cat.emoji ? (
                                                                    <EmojiGlyph emoji={cat.emoji} size={16} />
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-300">{t('calendarCategoryPickEmoji', lang)}</span>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoveCalendarCategory(cat.id)}
                                                                className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                                                                title={t('delete', lang)}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                        <BookOpen size={16} className="text-sky-400" /> {t('journalMoodTitle', lang)}
                                                    </label>
                                                    <p className="text-xs text-slate-300 mt-1">{t('journalMoodDesc', lang)}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3">
                                                <div>
                                                    <label className="text-[10px] text-slate-300 uppercase font-bold">{t('journalMoodName', lang)}</label>
                                                    <input
                                                        value={newJournalMoodName}
                                                        onChange={(e) => setNewJournalMoodName(e.target.value)}
                                                        placeholder={t('journalMoodPlaceholder', lang)}
                                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none text-sm focus:border-primary"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-300 uppercase font-bold">{t('journalMoodEmoji', lang)}</label>
                                                    <button
                                                        onClick={() => {
                                                            setJournalEmojiPickerTarget('new');
                                                            setEmojiPickerTarget(null);
                                                        }}
                                                        className="w-full h-[42px] bg-slate-900/50 border border-white/10 rounded-xl flex items-center justify-center text-lg hover:border-primary transition-colors"
                                                    >
                                                        {newJournalMoodEmoji ? (
                                                            <EmojiGlyph emoji={newJournalMoodEmoji} size={18} />
                                                        ) : (
                                                            <span className="text-[10px] text-slate-300">{t('journalMoodPickEmoji', lang)}</span>
                                                        )}
                                                    </button>
                                                </div>
                                                <div className="flex items-end">
                                                    <button
                                                        onClick={handleAddJournalMood}
                                                        disabled={!newJournalMoodName.trim() || !newJournalMoodEmoji}
                                                        className="w-full bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        <Plus size={14} /> {t('journalMoodAdd', lang)}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-3">
                                                {journalMoods.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500">{t('journalMoodEmpty', lang)}</p>
                                                ) : (
                                                    journalMoods.map((mood) => (
                                                        <div key={mood.id} className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3 items-center p-3 rounded-xl bg-slate-900/40 border border-white/10">
                                                            <input
                                                                value={mood.label}
                                                                onChange={(e) => handleJournalMoodChange(mood.id, { label: e.target.value })}
                                                                className="w-full bg-transparent border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-primary"
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    setJournalEmojiPickerTarget(mood.id);
                                                                    setEmojiPickerTarget(null);
                                                                }}
                                                                className="w-full h-[36px] bg-slate-900/50 border border-white/10 rounded-xl flex items-center justify-center text-base hover:border-primary transition-colors"
                                                            >
                                                                {mood.emoji ? (
                                                                    <EmojiGlyph emoji={mood.emoji} size={16} />
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-300">{t('journalMoodPickEmoji', lang)}</span>
                                                                )}
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemoveJournalMood(mood.id)}
                                                                className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                                                                title={t('delete', lang)}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                        <Wallet size={16} className="text-emerald-400" /> {t('finance', lang)}
                                                    </label>
                                                    <p className="text-xs text-slate-300 mt-1">{t('financeCategoryTitle', lang)}</p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                                                <div>
                                                    <label className="text-[10px] text-slate-300 uppercase font-bold">{t('category', lang)}</label>
                                                    <input
                                                        value={newFinanceCategoryName}
                                                        onChange={(e) => setNewFinanceCategoryName(e.target.value)}
                                                        placeholder={t('financeCategoryPlaceholder', lang)}
                                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-white outline-none text-sm focus:border-primary"
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <button
                                                        onClick={handleAddFinanceCategory}
                                                        disabled={!newFinanceCategoryName.trim()}
                                                        className="w-full bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                                    >
                                                        <Plus size={14} /> {t('financeCategoryAdd', lang)}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-3">
                                                {financeCategories.length === 0 ? (
                                                    <p className="text-[10px] text-slate-500">{t('financeCategoryEmpty', lang)}</p>
                                                ) : (
                                                    financeCategories.map((cat) => (
                                                        <div key={cat} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-900/40 border border-white/10">
                                                            <span className="text-sm text-white truncate">{cat}</span>
                                                            <button
                                                                onClick={() => handleRemoveFinanceCategory(cat)}
                                                                className="px-3 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center justify-center"
                                                                title={t('delete', lang)}
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'modules' && (
                                    <div className="space-y-8 animate-fade-in">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">{t('modulesTitle', lang)}</h2>
                                            <p className="text-slate-300 text-sm">{t('modulesDesc', lang)}</p>
                                        </div>

                                        <div className="space-y-3">
                                            {Object.values(MODULE_REGISTRY).map((mod) => {
                                                const isEnabled = draftUser?.modulesConfig?.[mod.id] !== false;
                                                const Icon = mod.icon;
                                                return (
                                                    <div
                                                        key={mod.id}
                                                        className={`p-4 rounded-2xl border transition-all ${isEnabled ? 'bg-white/5 border-white/10' : 'bg-slate-900/50 border-white/5 opacity-60'}`}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isEnabled ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-slate-500'}`}>
                                                                    <Icon size={20} />
                                                                </div>
                                                                <div>
                                                                    <h4 className="text-sm font-bold text-white">{t(mod.labelKey, lang)}</h4>
                                                                    <p className="text-xs text-slate-400">{t(mod.descriptionKey, lang)}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => handleModuleToggle(mod.id, !isEnabled)}
                                                                className={`p-2 rounded-lg transition-all ${isEnabled ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                                            >
                                                                {isEnabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                            <p className="text-xs text-amber-200">
                                                <strong>{t('modulesNote', lang)}:</strong> {t('modulesNoteDesc', lang)}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'backup' && (
                                    <div className="space-y-8 animate-fade-in">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">{t('autoBackupTitle', lang)}</h2>
                                            <p className="text-slate-300 text-sm">{t('autoBackupDesc', lang)}</p>
                                        </div>

                                        {/* Enable Auto Backup */}
                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div>
                                                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                                                        <HardDrive size={16} className="text-cyan-400" /> {t('autoBackupEnable', lang)}
                                                    </label>
                                                    <p className="text-xs text-slate-300 mt-1">{t('autoBackupEnableDesc', lang)}</p>
                                                </div>
                                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                                    <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${draftUser?.backupSettings?.enabled ? 'bg-primary border-primary' : 'border-slate-600 bg-slate-900/50 hover:border-slate-500'}`}>
                                                        {draftUser?.backupSettings?.enabled && <CheckSquare size={14} className="text-white" />}
                                                    </div>
                                                    <input
                                                        type="checkbox"
                                                        className="hidden"
                                                        checked={resolvedBackupSettings.enabled === true}
                                                        onChange={(e) => handleDraftChange('backupSettings', {
                                                            ...resolvedBackupSettings,
                                                            enabled: e.target.checked
                                                        })}
                                                    />
                                                </label>
                                            </div>

                                            {resolvedBackupSettings.enabled && (
                                                <div className="space-y-4 animate-fade-in">
                                                    {/* Folder Selection */}
                                                    <div>
                                                        <label className="text-xs text-slate-300 mb-2 block">{t('backupFolder', lang)}</label>
                                                        <div className="flex gap-2">
                                                            <div className="flex-1 bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300 truncate">
                                                                {backupFolderPath || resolvedBackupSettings.folderPath || t('backupFolderNotSet', lang)}
                                                            </div>
                                                            <button
                                                                onClick={handleSelectBackupFolder}
                                                                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                                                            >
                                                                <FolderOpen size={16} /> {t('browse', lang)}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Backup Interval */}
                                                    <div>
                                                        <label className="text-xs text-slate-300 mb-2 block">{t('backupInterval', lang)}</label>
                                                        <div ref={backupIntervalRef} className="relative">
                                                            <button
                                                                type="button"
                                                                onClick={() => setIsBackupIntervalOpen((prev) => !prev)}
                                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary flex items-center justify-between gap-3"
                                                                aria-expanded={isBackupIntervalOpen}
                                                            >
                                                                <span>{backupService.getIntervalLabel(backupIntervalValue, lang)}</span>
                                                                <ChevronDown size={16} className={`text-slate-400 transition-transform ${isBackupIntervalOpen ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            {isBackupIntervalOpen && (
                                                                <div className="absolute z-20 mt-2 w-full rounded-xl bg-slate-950/95 border border-white/10 shadow-xl overflow-hidden">
                                                                    {backupIntervalOptions.map((option) => (
                                                                        <button
                                                                            key={option}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setIsBackupIntervalOpen(false);
                                                                                handleDraftChange('backupSettings', {
                                                                                    ...resolvedBackupSettings,
                                                                                    interval: option
                                                                                });
                                                                            }}
                                                                            className={`w-full text-left px-4 py-2 text-sm transition-colors ${option === backupIntervalValue
                                                                                ? 'bg-primary/20 text-white'
                                                                                : 'text-slate-200 hover:bg-white/5'
                                                                                }`}
                                                                        >
                                                                            {backupService.getIntervalLabel(option, lang)}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Retention */}
                                                    <div>
                                                        <div className="flex justify-between items-center mb-2">
                                                            <label className="text-xs text-slate-300">{t('backupRetention', lang)}</label>
                                                            <span className="text-xs text-slate-300 font-bold">
                                                                {resolvedBackupSettings.retentionValue || 10} {t('backupFiles', lang)}
                                                            </span>
                                                        </div>
                                                        <input
                                                            type="range"
                                                            min="3"
                                                            max="30"
                                                            step="1"
                                                            value={resolvedBackupSettings.retentionValue || 10}
                                                            onChange={(e) => handleDraftChange('backupSettings', {
                                                                ...resolvedBackupSettings,
                                                                retentionMode: 'count',
                                                                retentionValue: parseInt(e.target.value, 10)
                                                            })}
                                                            className="w-full accent-primary h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                                                        />
                                                        <div className="flex justify-between text-[10px] text-slate-500 mt-2">
                                                            <span>3</span>
                                                            <span>30</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Backup Status & Actions */}
                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                                                        <Clock size={16} className="text-emerald-400" /> {t('backupStatus', lang)}
                                                    </h4>
                                                    {lastBackupTime ? (
                                                        <p className="text-xs text-slate-300 mt-1">
                                                            {t('lastBackup', lang)}: {lastBackupTime.toLocaleString(lang)}
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-slate-400 mt-1">{t('noBackupYet', lang)}</p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={handleBackupNow}
                                                    disabled={backupStatus === 'running' || !resolvedBackupSettings.folderPath}
                                                    className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 ${backupStatus === 'running'
                                                        ? 'bg-yellow-500/20 text-yellow-300 cursor-wait'
                                                        : backupStatus === 'success'
                                                            ? 'bg-emerald-500/20 text-emerald-300'
                                                            : 'bg-primary hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed'
                                                        }`}
                                                >
                                                    {backupStatus === 'running' ? (
                                                        <><RefreshCw size={16} className="animate-spin" /> {t('backupRunning', lang)}</>
                                                    ) : backupStatus === 'success' ? (
                                                        <><CheckSquare size={16} /> {t('backupDone', lang)}</>
                                                    ) : (
                                                        <><Play size={16} /> {t('backupExportNow', lang)}</>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Backup History */}
                                            {backupHistory.length > 0 && (
                                                <div className="mt-4 pt-4 border-t border-white/10">
                                                    <h5 className="text-xs text-slate-400 uppercase tracking-wider mb-3">{t('backupHistory', lang)}</h5>
                                                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                                                        {backupHistory.slice(0, 5).map((backup, idx) => (
                                                            <div key={idx} className="flex items-center justify-between text-xs bg-slate-900/50 rounded-lg px-3 py-2">
                                                                <span className="text-slate-300 truncate">{backup.name}</span>
                                                                <span className="text-slate-500">{new Date(backup.mtime).toLocaleDateString(lang)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Manual Backup Link */}
                                        <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-white">{t('manualBackup', lang)}</h4>
                                                <p className="text-xs text-slate-300 mt-1">{t('manualBackupDesc', lang)}</p>
                                            </div>
                                            <button
                                                onClick={handleManualRestore}
                                                disabled={restoreBusy}
                                                className="bg-white/10 hover:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                                            >
                                                {restoreBusy ? t('loading', lang) : t('openBackupRestore', lang)}
                                            </button>
                                        </div>

                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                            <div className="flex items-start justify-between gap-4">
                                                <div>
                                                    <h4 className="text-sm font-bold text-white flex items-center gap-2"><Database size={16} className="text-emerald-400" /> {t('storageMigrationTitle', lang)}</h4>
                                                    <p className="text-xs text-slate-300 mt-1">{t('storageMigrationDesc', lang)}</p>
                                                </div>
                                                <span className="text-[10px] uppercase tracking-widest text-emerald-300 bg-emerald-500/10 px-2 py-1 rounded-full">{storageStatusLabel}</span>
                                            </div>
                                            <p className="text-xs text-slate-400 mt-3">{storageStatusDetail}</p>
                                        </div>
                                    </div>
                                )}

                                {settingsTab === 'system' && (
                                    <div className="space-y-8 animate-fade-in">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">{t('systemSettings', lang)}</h2>
                                            <p className="text-slate-300 text-sm">{t('systemSettingsDesc', lang)}</p>
                                        </div>

                                        <div className="p-6 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-2xl border border-primary/20">
                                            <div className="flex items-start justify-between mb-4">
                                                <div>
                                                    <label className="text-sm font-bold text-indigo-300 flex items-center gap-2 mb-1">
                                                        <Sparkles size={16} /> Gemini API Key
                                                    </label>
                                                    <p className="text-xs text-slate-300">{t('apiKeyDesc', lang)}</p>
                                                </div>
                                                <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-xs bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 px-3 py-1.5 rounded-lg transition-colors">
                                                    {t('getKey', lang)}
                                                </a>
                                            </div>
                                            <input
                                                type="password"
                                                value={draftUser.apiKey || ''}
                                                onChange={(e) => handleDraftChange('apiKey', e.target.value)}
                                                placeholder="AI Studio Key..."
                                                className="w-full bg-slate-900/50 border border-indigo-500/30 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 font-mono text-sm transition-all focus:ring-1 focus:ring-indigo-500/50"
                                            />
                                            <p className="text-xs text-slate-300 mt-2">{t('apiKeyFree', lang)}</p>
                                        </div>

                                    </div>
                                )}

                                {settingsTab === 'info' && (
                                    <div className="space-y-8 animate-fade-in">
                                        <div>
                                            <h2 className="text-2xl font-bold text-white mb-1">{t('aboutKatanOS', lang)}</h2>
                                            <p className="text-slate-300 text-sm">Version 1.0.9</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <button
                                                onClick={() => { setIsHowToOpen(true); setIsSettingsOpen(false); }}
                                                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group"
                                            >
                                                <Lightbulb size={20} className="text-yellow-300 mb-3 group-hover:scale-110 transition-transform" />
                                                <h4 className="font-bold text-white text-sm">{t('howToUse', lang)}</h4>
                                                <p className="text-xs text-slate-300 mt-1">{t('howToUseSubtitle', lang)}</p>
                                            </button>

                                            <button
                                                onClick={handleCheckUpdates}
                                                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group"
                                            >
                                                <RefreshCw size={20} className="text-cyan-400 mb-3 group-hover:rotate-180 transition-transform duration-500" />
                                                <h4 className="font-bold text-white text-sm">{t('checkUpdates', lang)}</h4>
                                                <p className="text-xs text-slate-300 mt-1">{t('updatesViaStore', lang)}</p>
                                            </button>

                                            <button
                                                onClick={() => requestExternalOpen(katanosWebUrl)}
                                                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group"
                                            >
                                                <Globe size={20} className="text-indigo-400 mb-3 group-hover:scale-110 transition-transform" />
                                                <h4 className="font-bold text-white text-sm">{t('openWebsite', lang)}</h4>
                                                <p className="text-xs text-slate-300 mt-1">katania.me</p>
                                            </button>

                                            <button
                                                onClick={() => requestExternalOpen(katanosChangelogUrl)}
                                                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group"
                                            >
                                                <Activity size={20} className="text-emerald-400 mb-3 group-hover:scale-110 transition-transform" />
                                                <h4 className="font-bold text-white text-sm">{t('openChangelog', lang)}</h4>
                                                <p className="text-xs text-slate-300 mt-1">v1.0.9</p>
                                            </button>

                                            <button
                                                onClick={copyEmailAddress}
                                                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group"
                                            >
                                                <Mail size={20} className="text-rose-400 mb-3 group-hover:scale-110 transition-transform" />
                                                <h4 className="font-bold text-white text-sm">{t('sendEmail', lang)}</h4>
                                                <p className="text-xs text-slate-300 mt-1">{emailCopied ? t('emailCopiedTitle', lang) : 'kevin@katania.me'}</p>
                                            </button>

                                            <button
                                                onClick={handleReportBug}
                                                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group"
                                            >
                                                <Bug size={20} className="text-orange-400 mb-3 group-hover:scale-110 transition-transform" />
                                                <h4 className="font-bold text-white text-sm">{t('reportBug', lang)}</h4>
                                                <p className="text-xs text-slate-300 mt-1">kevin@katania.me</p>
                                            </button>

                                            <button
                                                onClick={() => requestExternalOpen('https://discord.gg/TH49Tjb52H')}
                                                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="20"
                                                    height="20"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    className="text-indigo-500 mb-3 group-hover:scale-110 transition-transform"
                                                >
                                                    <path d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.09.09 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.09 16.09 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.2 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.53.31-1.07.57-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02zM8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12zm6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12z" />
                                                </svg>
                                                <h4 className="font-bold text-white text-sm">{t('openDiscord', lang)}</h4>
                                                <p className="text-xs text-slate-300 mt-1">{t('discordDesc', lang)}</p>
                                            </button>

                                            <button
                                                onClick={() => requestExternalOpen('https://ko-fi.com/katania91')}
                                                className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-all text-left group"
                                            >
                                                <Coffee size={20} className="text-yellow-400 mb-3 group-hover:scale-110 transition-transform" />
                                                <h4 className="font-bold text-white text-sm">{t('buyCoffee', lang)}</h4>
                                                <p className="text-xs text-slate-300 mt-1">ko-fi.com/katania91</p>
                                            </button>
                                        </div>

                                        {devModeActive && (
                                            <div className="p-6 bg-white/5 rounded-2xl border border-white/10">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-white">{t('devModeTitle', lang)}</h3>
                                                        <p className="text-xs text-slate-300 mt-1">{devModeDurationLabel}</p>
                                                    </div>
                                                    <span className="text-[10px] uppercase tracking-widest text-indigo-300 bg-indigo-500/10 px-2 py-1 rounded-full">{t('devModeBadge', lang)}</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                                                    <button
                                                        onClick={handleLoadDevInfo}
                                                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors"
                                                    >
                                                        {devInfoLoading ? t('processing', lang) : t('devModeShowInfo', lang)}
                                                    </button>
                                                    <button
                                                        onClick={handleCopyDevInfo}
                                                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors"
                                                    >
                                                        {t('devModeCopyInfo', lang)}
                                                    </button>
                                                    <button
                                                        onClick={handleOpenDevLogs}
                                                        className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors"
                                                    >
                                                        {t('devModeOpenLogs', lang)}
                                                    </button>
                                                </div>
                                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3">
                                                        <h4 className="text-xs uppercase tracking-widest text-slate-500 mb-2">{t('devModeSessionTitle', lang)}</h4>
                                                        <div className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap break-all">
                                                            {sessionInfoText}
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3">
                                                        <h4 className="text-xs uppercase tracking-widest text-slate-500 mb-2">{t('devModeSystemTitle', lang)}</h4>
                                                        {devInfo ? (
                                                            <div className="text-[11px] text-slate-300 font-mono whitespace-pre-wrap break-all">
                                                                {`appName: ${devInfo.appName || 'unknown'}\nappVersion: ${devInfo.appVersion || 'unknown'}\nisPackaged: ${typeof devInfo.isPackaged === 'boolean' ? String(devInfo.isPackaged) : 'unknown'}\nappPath: ${devInfo.appPath || 'unknown'}\nuserDataPath: ${devInfo.userDataPath || 'unknown'}\nkatanosDataPath: ${devInfo.katanosDataPath || 'unknown'}\nlogPath: ${devInfo.logPath || 'unknown'}\nlogDir: ${devInfo.logDir || 'unknown'}\nplatform: ${devInfo.platform || 'unknown'}\narch: ${devInfo.arch || 'unknown'}\nosVersion: ${devInfo.osVersion || 'unknown'}\nlocale: ${devInfo.locale || 'unknown'}\nelectron: ${devInfo.electronVersion || 'unknown'}\nchrome: ${devInfo.chromeVersion || 'unknown'}\nnode: ${devInfo.nodeVersion || 'unknown'}\nv8: ${devInfo.v8Version || 'unknown'}\nuptimeSec: ${typeof devInfo.uptimeSec === 'number' ? devInfo.uptimeSec.toFixed(0) : 'unknown'}\nstartedAt: ${devInfo.startedAt || 'unknown'}\ntotalMemory: ${typeof devInfo.totalMemory === 'number' ? devInfo.totalMemory : 'unknown'}\nfreeMemory: ${typeof devInfo.freeMemory === 'number' ? devInfo.freeMemory : 'unknown'}`}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-slate-500">{devInfoError || t('devModeSystemEmpty', lang)}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-6 bg-white/5 rounded-2xl border border-white/10 text-center">
                                            <div className="flex items-center justify-center gap-6 mb-4 text-xs font-medium text-slate-400">
                                                <button onClick={() => requestExternalOpen('https://katania.me/privacy')} className="hover:text-white transition-colors hover:underline">
                                                    {t('privacyPolicy', lang)}
                                                </button>
                                                <button onClick={() => requestExternalOpen('https://katania.me/terms')} className="hover:text-white transition-colors hover:underline">
                                                    {t('termsOfService', lang)}
                                                </button>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                &copy; {new Date().getFullYear()} Katania. {t('rightsReserved', lang)}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Mobile Save Button */}
                                <div className="md:hidden mt-8 pb-8">
                                    <button
                                        onClick={saveSettings}
                                        className="w-full bg-primary hover:bg-indigo-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                                    >
                                        <Save size={18} /> {t('saveChanges', lang)}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {(emojiPickerTarget || journalEmojiPickerTarget) && (
                <EmojiPicker
                    title={journalEmojiPickerTarget ? t('journalMoodEmojiPickerTitle', lang) : t('calendarCategoryEmojiPickerTitle', lang)}
                    searchPlaceholder={t('emojiSearchPlaceholder', lang)}
                    emptyLabel={t('emojiSearchEmpty', lang)}
                    recentEmptyLabel={t('emojiPickerRecentEmpty', lang)}
                    tabAllLabel={t('emojiPickerTabAll', lang)}
                    tabRecentLabel={t('emojiPickerTabRecent', lang)}
                    categoryLabels={emojiCategoryLabels}
                    onSelect={handleEmojiSelect}
                    onClose={() => {
                        setEmojiPickerTarget(null);
                        setJournalEmojiPickerTarget(null);
                    }}
                />
            )}

            <input
                type="file"
                ref={restoreFileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleRestoreFileChange}
            />

            {/* Floating Pomodoro Widget */}
            {activePage !== 'dashboard' && isTimerActive && (
                <div
                    draggable
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    style={{ left: widgetPos.x, top: widgetPos.y }}
                    className="fixed z-50 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-3 [@media(max-height:900px)]:px-3 [@media(max-height:900px)]:py-2 flex items-center gap-4 shadow-2xl transition-all duration-300 opacity-30 hover:opacity-100 hover:scale-105 group select-none cursor-move"
                >
                    {/* Back to Dashboard Button (Visible on Hover) */}
                    <button
                        onClick={() => onNavigate('dashboard')}
                        className="w-0 group-hover:w-8 h-8 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all duration-300 overflow-hidden hover:bg-white/10 rounded-lg"
                        title={t('dashboard', lang)}
                    >
                        <ArrowLeft size={16} />
                    </button>

                    <div className={`w-2 h-2 rounded-full ${isActive ? 'animate-pulse bg-emerald-400' : 'bg-slate-600'}`}></div>
                    <div className="flex flex-col">
                        <span className={`font-mono font-bold text-[clamp(0.9rem,2.2vmin,1.25rem)] tracking-widest leading-none ${isActive ? 'text-white' : 'text-slate-300'}`}>
                            {formatTime(timeLeft)}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                            {t(`pomo_${mode}`, lang)}
                        </span>
                    </div>
                    <div className="w-8 h-8 [@media(max-height:900px)]:w-7 [@media(max-height:900px)]:h-7 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                        <Timer size={16} className={isActive ? 'text-emerald-400' : 'text-slate-500'} />
                    </div>
                </div>
            )}

            {/* Unsaved Settings Confirmation Modal */}
            {showUnsavedConfirm && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
                        <div className="glass-panel p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 animate-scale-in">
                            <h3 className="text-lg font-bold text-white mb-2">{t('unsavedChangesTitle', lang)}</h3>
                            <p className="text-slate-300 text-sm mb-6">{t('unsavedChangesDesc', lang)}</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowUnsavedConfirm(false)}
                                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors"
                                >
                                    {t('cancel', lang)}
                                </button>
                                <button
                                    onClick={confirmCloseSettings}
                                    className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-sm hover:bg-red-500/20 transition-colors"
                                >
                                    {t('discardChanges', lang)}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}

            {isDeleteOpen && user && (
                <ModalPortal>
                    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
                        <div className="w-full max-w-md glass-panel rounded-3xl p-8 relative shadow-2xl overflow-hidden">
                            <div className="absolute top-0 right-0 w-28 h-28 bg-red-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
                            <div className="absolute bottom-0 left-0 w-28 h-28 bg-slate-500/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>

                            <div className="relative z-10 text-center">
                                <h3 className="text-2xl font-display font-bold text-white mb-2">{t('deleteProfileTitle', lang)}</h3>
                                <p className="text-slate-300 text-sm mb-4">{t('deleteProfileConfirmDesc', lang)}</p>
                                <p className="text-xs uppercase tracking-widest text-red-400 font-bold mb-6">{t('deleteProfileWarning', lang)}</p>

                                {deleteError && (
                                    <div className="mb-4 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
                                        {deleteError}
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <button
                                        onClick={() => setIsDeleteOpen(false)}
                                        disabled={isDeleteBusy}
                                        className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-bold hover:bg-white/10 transition-colors disabled:opacity-60"
                                    >
                                        {t('deleteProfileCancel', lang)}
                                    </button>
                                    <button
                                        onClick={handleDeleteProfile}
                                        disabled={isDeleteBusy}
                                        className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 font-bold hover:bg-red-500/30 transition-colors disabled:opacity-60"
                                    >
                                        {t('deleteProfileConfirm', lang)}
                                    </button>
                                </div>
                            </div>

                        </div>
                    </div>
                </ModalPortal>
            )}

            <SeasonalEffects effect={user.seasonalEffect || 'none'} />
        </div>
    );
};

export default Layout;

