import React, { useEffect, useState } from 'react';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';
import { useTranslation } from '../services/useTranslation';

interface WindowControlsProps {
  lang: string;
  className?: string;
}

const WindowControls: React.FC<WindowControlsProps> = ({ lang, className }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { t } = useTranslation();

  const syncFullscreenState = async () => {
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

  const toggleFullscreen = async () => {
    if (isFullscreen) {
      if (window.katanos?.setFullScreen) {
        await window.katanos.setFullScreen(false);
        setIsFullscreen(false);
        return;
      }
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
      return;
    }

    if (window.katanos?.setFullScreen) {
      const status = await window.katanos.setFullScreen(true);
      setIsFullscreen(status);
      return;
    }
    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    }
  };

  useEffect(() => {
    let pollId: number | null = null;
    let isMounted = true;

    const handleDomFullscreenChange = () => {
      if (!isMounted) return;
      setIsFullscreen(!!document.fullscreenElement);
    };

    void syncFullscreenState();
    document.addEventListener('fullscreenchange', handleDomFullscreenChange);

    if (window.katanos?.isFullScreen) {
      pollId = window.setInterval(() => {
        void syncFullscreenState();
      }, 1000);
    }

    return () => {
      isMounted = false;
      document.removeEventListener('fullscreenchange', handleDomFullscreenChange);
      if (pollId) window.clearInterval(pollId);
    };
  }, []);

  const handleMinimize = () => {
    if (window.katanos?.minimize) {
      void window.katanos.minimize();
    }
  };

  const handleClose = () => {
    window.dispatchEvent(new CustomEvent('katanos:openExitPrompt'));
  };

  return (
    <div className={`window-no-drag flex items-center gap-2 ${className || ''}`.trim()}>
      <button
        onClick={handleMinimize}
        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        title={t('minimizeWindow', lang)}
        aria-label={t('minimizeWindow', lang)}
      >
        <Minus size={14} />
      </button>
      <button
        onClick={toggleFullscreen}
        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
        title={isFullscreen ? t('exitFullscreen', lang) : t('enterFullscreen', lang)}
        aria-label={isFullscreen ? t('exitFullscreen', lang) : t('enterFullscreen', lang)}
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>
      <button
        onClick={handleClose}
        className="p-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 hover:text-red-100 hover:bg-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.35)] transition-colors"
        title={t('exitPromptTitle', lang)}
        aria-label={t('exitPromptTitle', lang)}
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default WindowControls;
