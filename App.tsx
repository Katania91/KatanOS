import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import { HashRouter as Router } from 'react-router-dom';
import Layout from './components/Layout';
import { User } from './types';
import { db } from './services/db';
import { NotificationSystem } from './components/NotificationSystem';
import { useTranslation } from './services/useTranslation';
import { PomodoroProvider } from './services/PomodoroContext';
import LockScreen from './components/LockScreen';
import ModalPortal from './components/ModalPortal';
import { DEFAULT_THEME_ID } from './services/themes';
import { getLastLoginTheme, setLastLoginTheme } from './services/localSettings';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Agenda = lazy(() => import('./pages/Agenda'));
const Todo = lazy(() => import('./pages/Todo'));
const Finance = lazy(() => import('./pages/Finance'));
const Contacts = lazy(() => import('./pages/Contacts'));
const Games = lazy(() => import('./pages/Games'));
const Habits = lazy(() => import('./pages/Habits'));
const Journal = lazy(() => import('./pages/Journal'));
const Bookshelf = lazy(() => import('./pages/Bookshelf'));
const Vault = lazy(() => import('./pages/Vault'));

function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [targetContactId, setTargetContactId] = useState<string | null>(null);
  const [targetEventId, setTargetEventId] = useState<string | null>(null);
  const [isExitPromptOpen, setIsExitPromptOpen] = useState(false);
  const [isExitBusy, setIsExitBusy] = useState(false);
  const [devModeUntil, setDevModeUntil] = useState<number | null>(null);
  const [glitchActive, setGlitchActive] = useState(false);
  const [katanaActive, setKatanaActive] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [shouldLockOnLoad, setShouldLockOnLoad] = useState(false);
  const userRef = useRef<User | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const devModeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const konamiIndexRef = useRef(0);
  const konamiLockRef = useRef(false);
  const lockTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      await db.init();
      if (!isMounted) return;
      const currentUser = db.auth.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setShouldLockOnLoad(true);
      }
      // Signal to Electron that the UI is ready to be shown
      window.katanos?.signalReady?.();
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const themeId = user?.theme || getLastLoginTheme() || DEFAULT_THEME_ID;
    document.documentElement.dataset.theme = themeId;
  }, [user?.theme]);

  useEffect(() => {
    if (!user) {
      setIsLocked(false);
      setShouldLockOnLoad(false);
      return;
    }
    if (!shouldLockOnLoad) return;
    const lockEnabled = user.lockEnabled && !!user.lockPin;
    if (lockEnabled) {
      setIsLocked(true);
    }
    setShouldLockOnLoad(false);
  }, [user, shouldLockOnLoad]);

  useEffect(() => {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    audioContextRef.current = new AudioContextClass();
    const unlockAudio = () => {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
      }
    };
    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!devModeUntil) return;
    if (devModeTimeoutRef.current) {
      clearTimeout(devModeTimeoutRef.current);
    }
    const remainingMs = Math.max(0, devModeUntil - Date.now());
    devModeTimeoutRef.current = setTimeout(() => {
      setDevModeUntil(null);
      const lang = userRef.current?.language || 'it';
      window.dispatchEvent(new CustomEvent('katanos:notify', {
        detail: {
          title: t('devModeExpiredTitle', lang),
          message: t('devModeExpiredMessage', lang),
          type: 'info',
          duration: 6000,
        },
      }));
    }, remainingMs);
    return () => {
      if (devModeTimeoutRef.current) {
        clearTimeout(devModeTimeoutRef.current);
      }
    };
  }, [devModeUntil]);

  useEffect(() => {
    const handleKatana = () => {
      setKatanaActive(true);
      window.setTimeout(() => setKatanaActive(false), 700);
      if (userRef.current?.soundEnabled === false) return;
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
      }
      const duration = 0.08;
      const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        const fade = 1 - i / data.length;
        data[i] = (Math.random() * 2 - 1) * fade;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(700, ctx.currentTime);
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      source.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(ctx.currentTime);
      source.stop(ctx.currentTime + duration);
    };
    window.addEventListener('katanos:katana', handleKatana);
    return () => window.removeEventListener('katanos:katana', handleKatana);
  }, []);

  useEffect(() => {
    const KONAMI_SEQUENCE = [
      'arrowup',
      'arrowup',
      'arrowdown',
      'arrowdown',
      'arrowleft',
      'arrowright',
      'arrowleft',
      'arrowright',
      'b',
      'a',
    ];

    const playKonamiSound = () => {
      if (userRef.current?.soundEnabled === false) return;
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => { });
      }
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'square';
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.setValueAtTime(880, now);
      oscillator.frequency.setValueAtTime(660, now + 0.08);
      oscillator.frequency.setValueAtTime(990, now + 0.16);
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    };

    const triggerKonami = () => {
      if (konamiLockRef.current) return;
      konamiLockRef.current = true;
      window.setTimeout(() => {
        konamiLockRef.current = false;
      }, 1500);
      setGlitchActive(true);
      window.setTimeout(() => setGlitchActive(false), 1200);
      playKonamiSound();
      const durationMs = 3 * 60 * 1000;
      setDevModeUntil(Date.now() + durationMs);
      const lang = userRef.current?.language || 'it';
      window.dispatchEvent(new CustomEvent('katanos:notify', {
        detail: {
          title: t('devModeEnabledTitle', lang),
          message: t('devModeEnabledMessage', lang).replace('{minutes}', '3'),
          type: 'success',
          duration: 6000,
        },
      }));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const expected = KONAMI_SEQUENCE[konamiIndexRef.current];
      if (key === expected) {
        konamiIndexRef.current += 1;
        if (konamiIndexRef.current >= KONAMI_SEQUENCE.length) {
          konamiIndexRef.current = 0;
          triggerKonami();
        }
        return;
      }
      konamiIndexRef.current = key === KONAMI_SEQUENCE[0] ? 1 : 0;
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!window.katanos?.setRichPresence) return;
    const lang = user?.language || 'it';
    const pageLabels: Record<string, string> = {
      dashboard: t('dashboard', lang),
      agenda: t('agenda', lang),
      todo: t('todo', lang),
      finance: t('finance', lang),
      contacts: t('contacts', lang),
      games: t('games', lang),
      habits: t('habits', lang),
      journal: t('journal', lang),
      bookshelf: t('bookshelf', lang),
      vault: t('vault', lang),
    };
    const pageActions: Record<string, string> = {
      dashboard: t('presence_dashboard', lang),
      agenda: t('presence_agenda', lang),
      todo: t('presence_todo', lang),
      finance: t('presence_finance', lang),
      contacts: t('presence_contacts', lang),
      games: t('presence_games', lang),
      habits: t('presence_habits', lang),
      journal: t('presence_journal', lang),
      bookshelf: t('presence_bookshelf', lang),
      vault: t('presence_vault', lang),
    };

    if (!user) {
      void window.katanos.setRichPresence({
        details: 'Login',
        state: '',
      });
      return;
    }

    const details = pageLabels[activePage] || t('dashboard', lang);
    const state = pageActions[activePage] || t('presence_dashboard', lang);
    void window.katanos.setRichPresence({ details, state });
  }, [activePage, user]);

  useEffect(() => {
    if (!window.katanos?.onRequestClose) return;
    const unsubscribe = window.katanos.onRequestClose(() => {
      const currentUser = userRef.current;
      if (!currentUser) {
        void window.katanos?.confirmClose?.();
        return;
      }
      setIsExitPromptOpen(true);
    });
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    const handleOpenExitPrompt = () => {
      const currentUser = userRef.current;
      if (!currentUser) {
        void window.katanos?.confirmClose?.();
        return;
      }
      setIsExitPromptOpen(true);
    };
    window.addEventListener('katanos:openExitPrompt', handleOpenExitPrompt);
    return () => window.removeEventListener('katanos:openExitPrompt', handleOpenExitPrompt);
  }, []);

  useEffect(() => {
    const handleEscape = (event: Event) => {
      if (!isExitPromptOpen) return;
      setIsExitPromptOpen(false);
      const custom = event as CustomEvent<{ handled?: boolean }>;
      if (custom.detail) {
        custom.detail.handled = true;
      }
    };
    window.addEventListener('katanos:escape', handleEscape);
    return () => window.removeEventListener('katanos:escape', handleEscape);
  }, [isExitPromptOpen]);

  const handleLogin = (user: User) => {
    setUser(user);
    if (user.theme) {
      setLastLoginTheme(user.theme);
    }
    setActivePage('dashboard');
    setIsLocked(false);
    setShouldLockOnLoad(false);
  };

  const handleLogout = () => {
    db.auth.logout();
    setUser(null);
    setIsLocked(false);
    setShouldLockOnLoad(false);
  };

  const handleUserUpdate = (updatedUser: User) => {
    setUser(updatedUser);
    if (updatedUser.theme) {
      setLastLoginTheme(updatedUser.theme);
    }
  };

  useEffect(() => {
    if (!user || !user.lockEnabled || !user.lockPin) {
      if (lockTimerRef.current) {
        window.clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
      setIsLocked(false);
      return;
    }
    if (isLocked) {
      if (lockTimerRef.current) {
        window.clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
      return;
    }
    const timeoutMinutes = Number.isFinite(user.lockTimeoutMinutes) && user.lockTimeoutMinutes
      ? user.lockTimeoutMinutes
      : 5;
    const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;

    const resetTimer = () => {
      if (lockTimerRef.current) {
        window.clearTimeout(lockTimerRef.current);
      }
      lockTimerRef.current = window.setTimeout(() => {
        setIsLocked(true);
      }, timeoutMs);
    };

    const handleActivity = () => {
      if (isLocked) return;
      resetTimer();
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'wheel',
    ];

    events.forEach((event) => window.addEventListener(event, handleActivity));
    resetTimer();

    return () => {
      if (lockTimerRef.current) {
        window.clearTimeout(lockTimerRef.current);
        lockTimerRef.current = null;
      }
      events.forEach((event) => window.removeEventListener(event, handleActivity));
    };
  }, [user, isLocked]);

  const handleUnlock = async (pin: string) => {
    if (!user?.lockPin) return false;
    const ok = await db.auth.verifyLockPin(user.lockPin, pin);
    if (ok) {
      setIsLocked(false);
    }
    return ok;
  };

  const isDevModeActive = devModeUntil !== null;

  const handleExitCancel = () => {
    if (isExitBusy) return;
    setIsExitPromptOpen(false);
  };

  const handleExitConfirm = async (mode: 'stay' | 'logout') => {
    if (isExitBusy) return;
    setIsExitBusy(true);
    const currentUser = userRef.current;
    if (currentUser) {
      db.autosave(currentUser.id);
    }
    if (mode === 'logout') {
      db.auth.logout();
      setUser(null);
    }
    try {
      if (window.katanos?.confirmClose) {
        await window.katanos.confirmClose();
        return;
      }
      window.close();
    } finally {
      setIsExitBusy(false);
      setIsExitPromptOpen(false);
    }
  };

  const renderPage = () => {
    if (!user) return <Login onLogin={handleLogin} />;

    switch (activePage) {
      case 'dashboard': return <Dashboard user={user} onViewContact={(id) => { setTargetContactId(id); setActivePage('contacts'); }} onViewEvent={(id) => { setTargetEventId(id); setActivePage('agenda'); }} onNavigate={setActivePage} />;
      case 'agenda': return <Agenda user={user} initialEventId={targetEventId} />;
      case 'todo': return <Todo user={user} />;
      case 'finance': return <Finance user={user} />;
      case 'contacts': return <Contacts user={user} initialSelectedId={targetContactId} />;
      case 'habits': return <Habits user={user} />;
      case 'journal': return <Journal user={user} />;
      case 'bookshelf': return <Bookshelf user={user} />;
      case 'vault': return <Vault />;
      case 'games': return <Games user={user} />;
      default: return <Dashboard user={user} onViewContact={(id) => { setTargetContactId(id); setActivePage('contacts'); }} onViewEvent={(id) => { setTargetEventId(id); setActivePage('agenda'); }} onNavigate={setActivePage} />;
    }
  };

  const appLang = user?.language || 'it';

  return (
    <PomodoroProvider>
      <Router>
        <NotificationSystem user={user} />
        {user && (
          <LockScreen
            user={user}
            lang={user.language || 'it'}
            isOpen={isLocked}
            onUnlock={handleUnlock}
            onLogout={handleLogout}
          />
        )}
        <Layout
          user={user}
          activePage={activePage}
          onNavigate={setActivePage}
          onLogout={handleLogout}
          onUserUpdate={handleUserUpdate}
          devModeActive={isDevModeActive}
          devModeEndsAt={devModeUntil}
        >
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-slate-300 text-sm">
                {t('loading', appLang)}
              </div>
            }
          >
            {renderPage()}
          </Suspense>
        </Layout>
        {isDevModeActive && (
          <div className="konami-terminal-persistent">
            <div className="konami-terminal-label">DEV MODE</div>
          </div>
        )}
        {glitchActive && <div className="konami-terminal-flash" />}
        {katanaActive && (
          <div className="katana-overlay">
            <div className="katana-cut" />
          </div>
        )}

        {isExitPromptOpen && (
          <ModalPortal>
            <div className='fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in'>
              <div className='w-full max-w-md glass-panel border border-white/10 rounded-3xl p-8 relative shadow-2xl overflow-hidden'>
                <div className='absolute top-0 right-0 w-28 h-28 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none'></div>
                <div className='absolute bottom-0 left-0 w-28 h-28 bg-slate-500/10 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none'></div>

                <div className='relative z-10 text-center'>
                  <h3 className='text-2xl font-display font-bold text-white mb-2'>
                    {t('exitPromptTitle', user?.language || 'it')}
                  </h3>
                  <p className='text-slate-300 text-sm mb-6'>
                    {t('exitPromptDesc', user?.language || 'it')}
                  </p>

                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                    <button
                      onClick={() => handleExitConfirm('stay')}
                      disabled={isExitBusy}
                      className='px-4 py-3 rounded-xl bg-primary/20 border border-primary/30 text-white font-bold hover:bg-primary/30 transition-colors disabled:opacity-60'
                    >
                      {t('exitStayLoggedIn', user?.language || 'it')}
                    </button>
                    <button
                      onClick={() => handleExitConfirm('logout')}
                      disabled={isExitBusy}
                      className='px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 font-bold hover:bg-white/10 transition-colors disabled:opacity-60'
                    >
                      {t('exitLogout', user?.language || 'it')}
                    </button>
                  </div>

                  <button
                    onClick={handleExitCancel}
                    disabled={isExitBusy}
                    className='mt-4 text-xs uppercase tracking-wider text-slate-300 hover:text-white transition-colors disabled:opacity-60'
                  >
                    {t('exitCancel', user?.language || 'it')}
                  </button>
                </div>
              </div>
            </div>
          </ModalPortal>
        )}
      </Router>
    </PomodoroProvider>
  );
}

export default App;
