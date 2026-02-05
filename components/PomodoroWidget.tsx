import React from 'react';
import { Play, Pause, RotateCcw, Timer, SkipForward } from 'lucide-react';
import { useTranslation } from '../services/useTranslation';
import { usePomodoro, Mode } from '../services/PomodoroContext';

interface PomodoroWidgetProps {
  lang: string;
  soundEnabled?: boolean;
}

const MODES: Record<Mode, { labelKey: string; color: string; accent: string }> = {
  focus: { labelKey: 'pomo_focus', color: 'text-white', accent: 'rgba(99, 102, 241, 1)' },
  short: { labelKey: 'pomo_short', color: 'text-emerald-400', accent: 'rgba(16, 185, 129, 1)' },
  long: { labelKey: 'pomo_long', color: 'text-blue-400', accent: 'rgba(59, 130, 246, 1)' },
};

const SESSION_TARGET = 4;

const PomodoroWidget: React.FC<PomodoroWidgetProps> = ({ lang, soundEnabled }) => {
  const { t } = useTranslation();
  const {
    mode,
    timeLeft,
    isActive,
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
    setSoundEnabled
  } = usePomodoro();

  React.useEffect(() => {
    if (soundEnabled !== undefined) {
        setSoundEnabled(soundEnabled);
    }
  }, [soundEnabled, setSoundEnabled]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalSeconds = durations[mode] * 60;
  const progress = totalSeconds > 0 ? Math.min(100, ((totalSeconds - timeLeft) / totalSeconds) * 100) : 0;
  
  const getNextMode = (currentMode: Mode, sessionCount: number) => {
    if (currentMode === 'focus') {
      const nextCount = sessionCount + 1;
      const nextMode = nextCount % SESSION_TARGET === 0 ? 'long' : 'short';
      return nextMode;
    }
    return 'focus' as Mode;
  };
  
  const nextMode = getNextMode(mode, focusSessions);
  const sessionProgress = focusSessions % SESSION_TARGET || (focusSessions > 0 ? SESSION_TARGET : 0);

  return (
    <div className="glass-panel p-6 rounded-3xl flex flex-col justify-between h-full min-h-[380px] [@media(max-height:900px)]:min-h-[320px] [@media(max-height:760px)]:min-h-[280px] xl:min-h-0 relative overflow-hidden transition-all hover:shadow-primary/5 [@media(max-height:900px)]:p-4 [@media(max-height:760px)]:p-3 [@media(max-height:500px)]:p-2">
      {/* Background Pulse Effect when Active */}
      <div className={`absolute inset-0 bg-indigo-500/5 transition-opacity duration-1000 ${isActive ? 'animate-pulse opacity-100' : 'opacity-0'}`}></div>

      {/* Header / Tabs */}
      <div className="flex flex-wrap justify-between items-center gap-2 z-10 shrink-0">
        <div className="flex bg-black/20 p-1 rounded-xl">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`px-3 py-1.5 [@media(max-height:820px)]:px-2 [@media(max-height:820px)]:py-1 rounded-lg text-[clamp(0.6rem,1.2vmin,0.75rem)] [@media(max-height:820px)]:text-[clamp(0.55rem,1.1vmin,0.7rem)] font-bold transition-all ${
                mode === m ? 'bg-white/10 text-white shadow' : 'text-slate-500 hover:text-white'
              }`}
            >
              {t(MODES[m].labelKey, lang)}
            </button>
          ))}
        </div>
        <div className="flex items-center">
            <span className="text-slate-300 text-[clamp(0.6rem,1.1vmin,0.75rem)] font-bold uppercase tracking-wider mr-2 hidden md:block">{t('pomodoro_title', lang)}</span>
            <Timer size={16} className="text-slate-500" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 z-10 text-[clamp(0.55rem,1.1vmin,0.65rem)] uppercase tracking-wider text-slate-500 mt-2 [@media(max-height:820px)]:mt-1 shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-300">{t('pomo_session', lang)} {sessionProgress}/{SESSION_TARGET}</span>
          <span className="hidden sm:inline [@media(max-height:820px)]:hidden">{t('pomo_next', lang)}: <span className="text-slate-300">{t(MODES[nextMode].labelKey, lang)}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoStart(!autoStart)}
            className={`px-2 py-1 rounded-full border text-[clamp(0.55rem,1.1vmin,0.65rem)] font-bold transition-colors ${
              autoStart ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-slate-300 border-white/10'
            }`}
          >
            {t('pomo_auto', lang)}
          </button>
          <button
            onClick={() => setSoundOn(!soundOn)}
            className={`px-2 py-1 rounded-full border text-[clamp(0.55rem,1.1vmin,0.65rem)] font-bold transition-colors ${
              soundOn ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-slate-300 border-white/10'
            }`}
          >
            {t('pomo_sound', lang)}
          </button>
        </div>
      </div>

      {/* Main Timer Display */}
      <div className="flex-1 flex flex-col items-center justify-center z-10 relative min-h-0 py-2">
        {/* Circular Timer (Visible only on extra large screens) */}
        <div className="relative w-full max-w-[180px] aspect-square hidden min-[2000px]:flex items-center justify-center shrink-0">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: `conic-gradient(${MODES[mode].accent} ${progress}%, rgba(255,255,255,0.08) ${progress}%)` }}
          ></div>
          <div className="absolute inset-2 rounded-full bg-slate-900/80 border border-white/10 flex flex-col items-center justify-center">
            <div className={`text-[clamp(1.8rem,4vmin,3.6rem)] font-display font-bold tracking-tighter tabular-nums transition-colors duration-500 ${MODES[mode].color} ${isActive ? 'scale-105' : 'scale-100'} transition-transform`}>
              {formatTime(timeLeft)}
            </div>
            <p className="text-slate-500 text-[clamp(0.5rem,1vmin,0.7rem)] mt-1 uppercase tracking-widest font-bold">
              {isActive ? t('pomo_running', lang) : t('pomo_paused', lang)}
            </p>
          </div>
        </div>

        {/* Text-Only Timer (Visible on most screens to prevent layout issues) */}
        <div className="flex min-[2000px]:hidden flex-col items-center justify-center py-2 relative z-20">
            <div className={`text-[clamp(2.4rem,7vmin,3.8rem)] [@media(max-height:820px)]:text-[clamp(2.1rem,6vmin,3.2rem)] font-display font-bold tracking-tighter tabular-nums transition-colors duration-500 ${MODES[mode].color} ${isActive ? 'scale-105' : 'scale-100'} transition-transform drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]`}>
              {formatTime(timeLeft)}
            </div>
            <p className="text-slate-500 text-[clamp(0.55rem,1.2vmin,0.7rem)] mt-1 uppercase tracking-[0.3em] font-bold">
              {isActive ? t('pomo_running', lang) : t('pomo_paused', lang)}
            </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 z-10 mb-2 shrink-0">
         <button 
            onClick={toggleTimer}
            className="w-[clamp(40px,8vmin,56px)] h-[clamp(40px,8vmin,56px)] rounded-full bg-white text-black flex items-center justify-center hover:scale-110 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all active:scale-95"
            title={isActive ? t('pomo_pause', lang) : t('pomo_start', lang)}
         >
             {isActive ? <Pause fill="black" /> : <Play fill="black" className="ml-1" />}
         </button>

         <button
            onClick={() => advanceMode(autoStart ? true : isActive, false)}
            className="w-[clamp(28px,6vmin,36px)] h-[clamp(28px,6vmin,36px)] rounded-full bg-white/5 text-slate-300 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
            title={t('pomo_skip', lang)}
         >
            <SkipForward size={18} />
         </button>

         <button 
            onClick={resetTimer}
            className="w-[clamp(28px,6vmin,36px)] h-[clamp(28px,6vmin,36px)] rounded-full bg-white/5 text-slate-300 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all"
            title={t('pomo_reset', lang)}
         >
             <RotateCcw size={18} />
         </button>
      </div>

      <div className="z-10 mt-2 shrink-0 [@media(max-height:820px)]:hidden">
        <p className="text-[clamp(0.55rem,1.1vmin,0.65rem)] uppercase tracking-widest text-slate-500 font-bold mb-2">{t('pomo_durations', lang)}</p>
        <div className="grid grid-cols-3 gap-2 text-[clamp(0.55rem,1.1vmin,0.65rem)]">
          {(Object.keys(MODES) as Mode[]).map((m) => (
            <div key={m} className="bg-white/5 rounded-xl border border-white/10 px-2 py-2 flex flex-col gap-2">
              <span className="text-slate-300 font-bold">{t(MODES[m].labelKey, lang)}</span>
              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={() => adjustDuration(m, -1)}
                  className="w-[clamp(20px,4vmin,24px)] h-[clamp(20px,4vmin,24px)] rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  -
                </button>
                <span className="text-slate-200 font-mono">{durations[m]}m</span>
                <button
                  onClick={() => adjustDuration(m, 1)}
                  className="w-[clamp(20px,4vmin,24px)] h-[clamp(20px,4vmin,24px)] rounded-lg bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/5">
          <div 
            className="h-full transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%`, backgroundColor: MODES[mode].accent }}
          ></div>
      </div>
    </div>
  );
};

export default PomodoroWidget;
