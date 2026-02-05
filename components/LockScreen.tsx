import React, { useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import { User } from '../types';
import { useTranslation } from '../services/useTranslation';
import appLogo from '../assets/icon.webp';
import { buildAvatarDataUri } from '../services/avatar';
import ModalPortal from './ModalPortal';

interface LockScreenProps {
  user: User;
  lang: string;
  isOpen: boolean;
  onUnlock: (pin: string) => Promise<boolean>;
  onLogout: () => void;
}

const MAX_PIN_LENGTH = 8;

const normalizePin = (value: string) => value.replace(/\D/g, '').slice(0, MAX_PIN_LENGTH);

const LockScreen: React.FC<LockScreenProps> = ({ user, lang, isOpen, onUnlock, onLogout }) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const avatarSrc = user.avatar || buildAvatarDataUri(user.username);

  if (!isOpen) return null;

  const handleDigit = (digit: string) => {
    if (isBusy) return;
    if (pin.length >= MAX_PIN_LENGTH) return;
    setPin((prev) => normalizePin(prev + digit));
    setError('');
  };

  const handleClear = () => {
    if (isBusy) return;
    setPin('');
    setError('');
  };

  const handleBackspace = () => {
    if (isBusy) return;
    setPin((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleSubmit = async () => {
    if (isBusy) return;
    if (!pin) return;
    setIsBusy(true);
    const ok = await onUnlock(pin);
    setIsBusy(false);
    if (!ok) {
      setPin('');
      setError(t('lockPinInvalid', lang));
      return;
    }
    setPin('');
    setError('');
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[90] flex items-center justify-center app-overlay backdrop-blur-xl">
        <div className="relative z-10 w-full max-w-md p-8 glass-panel rounded-3xl border border-white/10 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl overflow-hidden shadow-lg shadow-primary/30 mb-4">
            <img src={appLogo} alt="KatanOS" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white">{t('lockTitle', lang)}</h2>
          <p className="text-xs text-slate-300 mt-2">{t('lockSubtitle', lang)}</p>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shadow-lg">
            <img src={avatarSrc} alt={user.username} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">{user.username}</p>
            <p className="text-[10px] text-slate-300 uppercase tracking-widest">{t('lockPrompt', lang)}</p>
          </div>
        </div>

        <input
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          onChange={(e) => setPin(normalizePin(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder="••••"
          className="w-full bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 text-center text-lg tracking-[0.4em] text-white outline-none focus:border-primary"
        />

        {error && (
          <div className="mt-3 bg-red-500/10 border border-red-500/20 p-2 rounded-lg text-xs text-red-400 text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mt-6">
          {['1','2','3','4','5','6','7','8','9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(digit)}
              className="py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-bold hover:bg-white/10 transition-colors disabled:opacity-50"
              disabled={isBusy}
            >
              {digit}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            disabled={isBusy}
          >
            <Trash2 size={14} /> {t('lockClear', lang)}
          </button>
          <button
            onClick={() => handleDigit('0')}
            className="py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-bold hover:bg-white/10 transition-colors disabled:opacity-50"
            disabled={isBusy}
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="py-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/10 transition-colors disabled:opacity-50"
            disabled={isBusy}
          >
            {t('lockBackspace', lang)}
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => void handleSubmit()}
            className="flex-1 bg-gradient-to-r from-primary to-secondary text-white font-bold py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-60"
            disabled={isBusy || pin.length === 0}
          >
            {t('lockUnlock', lang)}
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-3 rounded-xl bg-red-500/10 text-red-300 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-2 text-sm font-bold"
            disabled={isBusy}
          >
            <LogOut size={16} /> {t('logout', lang)}
          </button>
        </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default LockScreen;
