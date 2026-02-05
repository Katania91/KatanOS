
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Bell, AlertTriangle, CheckCircle } from 'lucide-react';
import { db } from '../services/db';
import { useTranslation } from '../services/useTranslation';
import { User, Notification } from '../types';

interface NotificationSystemProps {
  user: User | null;
}

// Extended Notification type for internal use
interface ExtendedNotification extends Notification {
  autoClose?: boolean;
  duration?: number;
}

const NotificationItem: React.FC<{ 
  notif: ExtendedNotification; 
  onClose: (id: string) => void 
}> = ({ notif, onClose }) => {
  const [width, setWidth] = useState(100);

  useEffect(() => {
    if (notif.autoClose) {
      // Start animation slightly after mount to ensure transition triggers
      const animTimer = setTimeout(() => setWidth(0), 50);
      
      // Auto close timer
      const closeTimer = setTimeout(() => {
        onClose(notif.id);
      }, notif.duration || 10000);

      return () => {
        clearTimeout(animTimer);
        clearTimeout(closeTimer);
      };
    }
  }, [notif.autoClose, notif.duration, notif.id, onClose]);

  return (
    <div 
      className="pointer-events-auto w-80 glass-panel bg-[#1e293b]/95 rounded-2xl p-4 shadow-2xl backdrop-blur-xl border border-white/20 animate-slide-up relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300"
    >
      <div className="flex gap-3 items-start mb-1">
         <div className={`mt-1 p-2 rounded-xl shrink-0 ${
             notif.type === 'alert' ? 'bg-red-500/20 text-red-400' : 
             notif.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 
             'bg-indigo-500/20 text-indigo-400'
         }`}>
            {notif.type === 'alert' ? <AlertTriangle size={20} /> : 
             notif.type === 'success' ? <CheckCircle size={20} /> : 
             <Bell size={20} />}
         </div>
         <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-white truncate pr-4">{notif.title}</h4>
            <p className="text-xs text-slate-300 mt-1 leading-snug">{notif.message}</p>
         </div>
         <button 
            onClick={() => onClose(notif.id)}
            className="text-slate-300 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors absolute top-2 right-2"
            title="Chiudi notifica"
         >
            <X size={16} />
         </button>
      </div>
      
      {/* Progress Bar */}
      {notif.autoClose && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/10">
          <div 
            className="h-full bg-white/40 transition-all ease-linear"
            style={{ 
              width: `${width}%`, 
              transitionDuration: `${notif.duration || 10000}ms` 
            }}
          />
        </div>
      )}
    </div>
  );
};

export const NotificationSystem: React.FC<NotificationSystemProps> = ({ user }) => {
  const [notifications, setNotifications] = useState<ExtendedNotification[]>([]);
  const { t } = useTranslation();
  
  // Use session storage to persist notified event IDs across reloads in the same session
  const [notifiedEvents, setNotifiedEvents] = useState<Set<string>>(() => {
      try {
          const stored = sessionStorage.getItem('chronos_notified_events');
          return stored ? new Set(JSON.parse(stored)) : new Set();
      } catch (e) {
          return new Set();
      }
  });
  
  // Use Web Audio API for reliable offline sound generation
  const audioContextRef = useRef<AudioContext | null>(null);
  const userRef = useRef<User | null>(user);
  
  const lang = user?.language || 'it';

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    // Initialize Audio Context
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass();
      }
    } catch (e) {
      console.warn("Web Audio API not supported");
    }

    // Function to unlock audio context on user interaction
    const unlockAudio = () => {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
           // Remove listener once unlocked
           document.removeEventListener('click', unlockAudio);
           document.removeEventListener('keydown', unlockAudio);
        }).catch(e => console.error(e));
      }
    };

    document.addEventListener('click', unlockAudio);
    document.addEventListener('keydown', unlockAudio);

    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
      audioContextRef.current?.close();
    };
  }, []);

  const playSound = useCallback(() => {
      if (user?.soundEnabled === false) return;
      const ctx = audioContextRef.current;
      if (!ctx) return;

      // Create a pleasant "Glass Ping" sound using oscillator
      try {
          const oscillator = ctx.createOscillator();
          const gainNode = ctx.createGain();

          oscillator.connect(gainNode);
          gainNode.connect(ctx.destination);

          // Sine wave for clean tone
          oscillator.type = 'sine';
          
          // Frequency sweep: 880Hz (A5) -> 440Hz (A4) quickly
          const now = ctx.currentTime;
          oscillator.frequency.setValueAtTime(880, now);
          oscillator.frequency.exponentialRampToValueAtTime(500, now + 0.3);

          // Volume envelope: Attack -> Decay
          gainNode.gain.setValueAtTime(0, now);
          gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05); // Attack
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5); // Decay

          oscillator.start(now);
          oscillator.stop(now + 0.5);
      } catch (e) {
          console.warn("Failed to play notification sound", e);
      }
  }, []);

  // Function to add a visual notification
  const addNotification = useCallback((title: string, message: string, type: 'info' | 'alert' | 'success' = 'info', autoClose = true, duration = 10000, silent = false) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, title, message, type, autoClose, duration }]);
    if (!silent) playSound();
  }, [playSound]);

  useEffect(() => {
    const handleCustomNotification = (event: Event) => {
      const detail = (event as CustomEvent)?.detail as
        | { title?: string; message?: string; type?: 'info' | 'alert' | 'success'; duration?: number; silent?: boolean }
        | undefined;
      if (!detail?.title || !detail?.message) return;
      addNotification(detail.title, detail.message, detail.type || 'info', true, detail.duration, detail.silent);
    };

    window.addEventListener('katanos:notify', handleCustomNotification);
    return () => window.removeEventListener('katanos:notify', handleCustomNotification);
  }, [addNotification]);

  // Save notified events to session storage
  useEffect(() => {
      sessionStorage.setItem('chronos_notified_events', JSON.stringify(Array.from(notifiedEvents)));
  }, [notifiedEvents]);

  // Poll for upcoming events
  useEffect(() => {
    if (!user) return;

    const checkEvents = async () => {
      const events = await db.events.list(user.id);
      const now = new Date();
      const advanceMinutes = user.notificationAdvance || 30; // Use user setting or default to 30
      
      events.forEach(event => {
        const eventStart = new Date(event.start);
        const timeDiff = eventStart.getTime() - now.getTime();
        const minutesUntil = Math.floor(timeDiff / (1000 * 60));

        // Notify if event is between 0 and configured minutes away
        // and hasn't been notified yet in this session
        if (minutesUntil >= 0 && minutesUntil <= advanceMinutes && !notifiedEvents.has(event.id)) {
          
          let message = `${t('startsIn', lang)} ${minutesUntil} ${t('minutes', lang)}`;
          if (minutesUntil <= 1) message = t('startingNow', lang);
          
          addNotification(
            `${t('reminder', lang)}: ${event.title}`, 
            message,
            minutesUntil < 10 ? 'alert' : 'info',
            false
          );

          setNotifiedEvents(prev => {
              const next = new Set(prev);
              next.add(event.id);
              return next;
          });
        }
      });
    };

    // Initial check
    checkEvents();

    // Check every 30 seconds for better precision
    const interval = setInterval(checkEvents, 30000);

    return () => clearInterval(interval);
  }, [user, notifiedEvents, addNotification, lang]);

  const handleClose = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Render Logic - Bottom Right
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none items-end">
      {notifications.map(notif => (
        <NotificationItem 
          key={notif.id} 
          notif={notif} 
          onClose={handleClose} 
        />
      ))}
    </div>
  );
};
