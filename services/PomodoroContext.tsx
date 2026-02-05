import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { db } from './db';

export type Mode = 'focus' | 'short' | 'long';

interface PomodoroContextType {
  mode: Mode;
  timeLeft: number;
  isActive: boolean;
  progress: number;
  durations: { focus: number; short: number; long: number };
  focusSessions: number;
  autoStart: boolean;
  soundOn: boolean;
  toggleTimer: () => void;
  resetTimer: () => void;
  switchMode: (m: Mode) => void;
  advanceMode: (shouldStart: boolean, countFocus?: boolean) => void;
  adjustDuration: (target: Mode, delta: number) => void;
  setAutoStart: React.Dispatch<React.SetStateAction<boolean>>;
  setSoundOn: React.Dispatch<React.SetStateAction<boolean>>;
  setSoundEnabled: (enabled: boolean) => void;
  formatTime: (seconds: number) => string;
  MODES: Record<Mode, { labelKey: string; color: string; accent: string }>;
  SESSION_TARGET: number;
  getNextMode: (currentMode: Mode, sessionCount: number, countFocus: boolean) => { nextMode: Mode; nextCount: number };
}

const PomodoroContext = createContext<PomodoroContextType | undefined>(undefined);

const DEFAULT_DURATIONS = { focus: 25, short: 5, long: 15 };
const SESSION_TARGET = 4;

export const MODES: Record<Mode, { labelKey: string; color: string; accent: string }> = {
  focus: { labelKey: 'pomo_focus', color: 'text-white', accent: 'rgba(99, 102, 241, 1)' },
  short: { labelKey: 'pomo_short', color: 'text-emerald-400', accent: 'rgba(16, 185, 129, 1)' },
  long: { labelKey: 'pomo_long', color: 'text-blue-400', accent: 'rgba(59, 130, 246, 1)' },
};

export const PomodoroProvider: React.FC<{ children: ReactNode; userSoundEnabled?: boolean }> = ({ children, userSoundEnabled }) => {
  const [mode, setMode] = useState<Mode>('focus');
  const [durations, setDurations] = useState(DEFAULT_DURATIONS);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATIONS.focus * 60);
  const [isActive, setIsActive] = useState(false);
  const [focusSessions, setFocusSessions] = useState(0);
  const [autoStart, setAutoStart] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const storageKeyRef = useRef('');
  const audioRef = useRef<AudioContext | null>(null);
  const prevModeRef = useRef(mode);
  const prevDurationsRef = useRef(durations);

  useEffect(() => {
    const userId = (() => {
      try {
        return db.auth.getCurrentUser()?.id || 'guest';
      } catch (e) {
        return 'guest';
      }
    })();
    storageKeyRef.current = `katanos_pomodoro_${userId}`;
    try {
      const raw = localStorage.getItem(storageKeyRef.current);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.durations) {
        setDurations({
          focus: Math.max(1, Number(saved.durations.focus) || DEFAULT_DURATIONS.focus),
          short: Math.max(1, Number(saved.durations.short) || DEFAULT_DURATIONS.short),
          long: Math.max(1, Number(saved.durations.long) || DEFAULT_DURATIONS.long),
        });
      }
      if (typeof saved?.focusSessions === 'number') {
        setFocusSessions(Math.max(0, saved.focusSessions));
      }
      if (typeof saved?.autoStart === 'boolean') {
        setAutoStart(saved.autoStart);
      }
      if (typeof saved?.soundOn === 'boolean') {
        setSoundOn(saved.soundOn);
      }
    } catch (e) {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    if (!storageKeyRef.current) return;
    try {
      localStorage.setItem(
        storageKeyRef.current,
        JSON.stringify({ durations, focusSessions, autoStart, soundOn })
      );
    } catch (e) {
      // ignore storage errors
    }
  }, [durations, focusSessions, autoStart, soundOn]);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      setTimeLeft((time) => Math.max(0, time - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    // Handle Mode Changes
    if (prevModeRef.current !== mode) {
      setTimeLeft(durations[mode] * 60);
      setIsActive(false);
      prevModeRef.current = mode;
    } 
    // Handle Duration Changes
    else if (prevDurationsRef.current !== durations) {
        const oldTotal = prevDurationsRef.current[mode] * 60;
        const newTotal = durations[mode] * 60;
        
        // If the timer was at the full duration of the old setting (not started), update to new duration
        if (timeLeft === oldTotal) {
            setTimeLeft(newTotal);
        } else {
            // Otherwise just clamp it to ensure we don't exceed the new max
            setTimeLeft(t => Math.min(t, newTotal));
        }
        prevDurationsRef.current = durations;
    }
  }, [durations, mode, timeLeft]);

  const playBeep = () => {
    if (!soundOn || userSoundEnabled === false) return;
    try {
      const AudioContextRef = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextRef) return;
      if (!audioRef.current) {
        audioRef.current = new AudioContextRef();
      }
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.6);
    } catch (e) {
      // ignore audio errors
    }
  };

  const getNextMode = (currentMode: Mode, sessionCount: number, countFocus: boolean) => {
    if (currentMode === 'focus') {
      const nextCount = countFocus ? sessionCount + 1 : sessionCount;
      const nextMode = nextCount % SESSION_TARGET === 0 ? 'long' : 'short';
      return { nextMode, nextCount };
    }
    return { nextMode: 'focus' as Mode, nextCount: sessionCount };
  };

  const advanceMode = (shouldStart: boolean, countFocus = true) => {
    const { nextMode, nextCount } = getNextMode(mode, focusSessions, countFocus);
    setFocusSessions(nextCount);
    setMode(nextMode);
    setTimeLeft(durations[nextMode] * 60);
    setIsActive(shouldStart);
  };

  useEffect(() => {
    if (timeLeft !== 0) return;
    if (isActive) {
      setIsActive(false);
    }
    playBeep();
    advanceMode(autoStart, true);
  }, [timeLeft, autoStart, isActive]);

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setTimeLeft(durations[newMode] * 60);
    setIsActive(false);
  };

  const toggleTimer = () => {
    if (timeLeft === 0) {
      setTimeLeft(durations[mode] * 60);
    }
    setIsActive((prev) => !prev);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(durations[mode] * 60);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const adjustDuration = (target: Mode, delta: number) => {
    setDurations((prev) => {
      const nextValue = Math.max(1, Math.min(90, prev[target] + delta));
      return { ...prev, [target]: nextValue };
    });
  };

  const totalSeconds = durations[mode] * 60;
  const progress = totalSeconds > 0 ? Math.min(100, ((totalSeconds - timeLeft) / totalSeconds) * 100) : 0;

  return (
    <PomodoroContext.Provider value={{
      mode,
      timeLeft,
      isActive,
      progress,
      durations,
      focusSessions,
      autoStart,
      soundOn,
      toggleTimer,
      resetTimer,
      switchMode,
      advanceMode,
      adjustDuration,
      setAutoStart,
      setSoundOn,
      setSoundEnabled: setSoundOn,
      formatTime,
      MODES,
      SESSION_TARGET,
      getNextMode
    }}>
      {children}
    </PomodoroContext.Provider>
  );
};

export const usePomodoro = () => {
  const context = useContext(PomodoroContext);
  if (context === undefined) {
    throw new Error('usePomodoro must be used within a PomodoroProvider');
  }
  return context;
};
