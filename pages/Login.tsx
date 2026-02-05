import React, { useState } from 'react';
import { User } from '../types';
import { db } from '../services/db';
import { useTranslation } from '../services/useTranslation';
import { getLastLoginLanguage, setLastLoginLanguage, getLoginBackground } from '../services/localSettings';
import { UserPlus, Lock, User as UserIcon, LogIn, Languages, X, Globe } from 'lucide-react';
import appLogo from '../assets/icon.webp';
import loginBackground from '../assets/login-bg.webp';
import WindowControls from '../components/WindowControls';
import ModalPortal from '../components/ModalPortal';
import Select from '../components/Select';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { t } = useTranslation();
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [secretQuestionId, setSecretQuestionId] = useState('');
  const [secretAnswer, setSecretAnswer] = useState('');
  const [error, setError] = useState('');
  const [usernameError, setUsernameError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [confirmPasswordError, setConfirmPasswordError] = useState(false);
  const [secretQuestionError, setSecretQuestionError] = useState(false);
  const [secretAnswerError, setSecretAnswerError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState('');
  const [resetQuestionId, setResetQuestionId] = useState('');
  const [resetAnswer, setResetAnswer] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetUsernameError, setResetUsernameError] = useState(false);
  const [resetAnswerError, setResetAnswerError] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState(false);
  const [resetConfirmError, setResetConfirmError] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // State for language selection on Login screen
  const [selectedLang, setSelectedLang] = useState(() => getLastLoginLanguage());

  const customBg = getLoginBackground();
  const bgImage = customBg || loginBackground;

  const inputClass = (hasError: boolean, extra: string) =>
    `w-full bg-slate-900/50 text-white rounded-xl outline-none transition-all focus:ring-2 ${extra} ${
      hasError
        ? 'border-2 border-red-500 focus:border-red-500 focus:ring-red-500/30'
        : 'border border-slate-700 focus:ring-primary focus:border-transparent group-hover:border-slate-600'
    }`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isUsernameMissing = !username.trim();
    const isPasswordMissing = !password.trim();
    setUsernameError(isUsernameMissing);
    setPasswordError(isPasswordMissing);
    if (isUsernameMissing || isPasswordMissing) {
      setError(t('loginError', selectedLang));
      return;
    }
    if (isRegistering) {
      const isConfirmMissing = !confirmPassword.trim();
      const isConfirmMismatch = password !== confirmPassword;
      const isQuestionMissing = !secretQuestionId;
      const isAnswerMissing = !secretAnswer.trim();
      setConfirmPasswordError(isConfirmMissing || isConfirmMismatch);
      setSecretQuestionError(isQuestionMissing);
      setSecretAnswerError(isAnswerMissing);
      if (isConfirmMissing || isConfirmMismatch) {
        setError(t('passwordMismatch', selectedLang));
        return;
      }
      if (isQuestionMissing) {
        setError(t('secretQuestionRequired', selectedLang));
        return;
      }
      if (isAnswerMissing) {
        setError(t('secretAnswerRequired', selectedLang));
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      let result;
      if (isRegistering) {
        // Pass the selected language to registration
        result = await db.auth.register(username, password, selectedLang, secretQuestionId, secretAnswer);
      } else {
        result = await db.auth.login(username, password);
      }

      if (result.error) {
        setError(result.error);
      } else if (result.user) {
        onLogin(result.user);
      }
    } catch (err) {
      setError(t('authError', selectedLang));
    } finally {
      setLoading(false);
    }
  };

  const availableLangs = [
    { code: 'it', label: 'IT' },
    { code: 'en', label: 'EN' },
    { code: 'fr', label: 'FR' },
    { code: 'es', label: 'ES' },
    { code: 'de', label: 'DE' }
  ];

  const showWindowBar = !isFullscreen;

  React.useEffect(() => {
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

  React.useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!isResetOpen) return;
      setIsResetOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isResetOpen]);

  const secretQuestions = [
    { id: 'q1', label: t('secret_q1', selectedLang) },
    { id: 'q2', label: t('secret_q2', selectedLang) },
    { id: 'q3', label: t('secret_q3', selectedLang) },
    { id: 'q4', label: t('secret_q4', selectedLang) }
  ];

  const openReset = () => {
    setIsResetOpen(true);
    setResetUsername('');
    setResetQuestionId('');
    setResetAnswer('');
    setResetPassword('');
    setResetConfirm('');
    setResetError('');
    setResetSuccess('');
    setResetUsernameError(false);
    setResetAnswerError(false);
    setResetPasswordError(false);
    setResetConfirmError(false);
  };

  const handleLoadQuestion = async () => {
    const isResetUsernameMissing = !resetUsername.trim();
    setResetUsernameError(isResetUsernameMissing);
    if (isResetUsernameMissing) {
      setResetError(t('loginError', selectedLang));
      return;
    }
    setResetLoading(true);
    setResetError('');
    setResetSuccess('');
    setResetQuestionId('');
    try {
      const result = await db.auth.getSecurityQuestion(resetUsername);
      if (result.error === 'not_found') {
        setResetError(t('resetUserNotFound', selectedLang));
      } else if (result.error === 'missing_question') {
        setResetError(t('resetQuestionMissing', selectedLang));
      } else if (result.questionId) {
        setResetQuestionId(result.questionId);
      }
    } catch (err) {
      setResetError(t('authError', selectedLang));
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const isResetUsernameMissing = !resetUsername.trim();
    const isResetAnswerMissing = !resetAnswer.trim();
    const isResetPasswordMissing = !resetPassword.trim();
    const isResetConfirmMissing = !resetConfirm.trim();
    setResetUsernameError(isResetUsernameMissing);
    setResetAnswerError(isResetAnswerMissing);
    setResetPasswordError(isResetPasswordMissing);
    setResetConfirmError(isResetConfirmMissing);
    if (isResetUsernameMissing) {
      setResetError(t('loginError', selectedLang));
      return;
    }
    if (!resetQuestionId) {
      setResetError(t('resetQuestionMissing', selectedLang));
      return;
    }
    if (isResetAnswerMissing) {
      setResetError(t('secretAnswerRequired', selectedLang));
      return;
    }
    if (isResetPasswordMissing || isResetConfirmMissing) {
      setResetError(t('loginError', selectedLang));
      return;
    }
    if (resetPassword !== resetConfirm) {
      setResetPasswordError(true);
      setResetConfirmError(true);
      setResetError(t('passwordMismatch', selectedLang));
      return;
    }
    setResetLoading(true);
    setResetError('');
    setResetSuccess('');
    try {
      const result = await db.auth.resetPassword(resetUsername, resetAnswer, resetPassword);
      if (result.error === 'not_found') {
        setResetError(t('resetUserNotFound', selectedLang));
      } else if (result.error === 'missing_question') {
        setResetError(t('resetQuestionMissing', selectedLang));
      } else if (result.error === 'invalid_answer') {
        setResetError(t('resetAnswerInvalid', selectedLang));
      } else {
        setResetSuccess(t('resetSuccess', selectedLang));
        setResetAnswer('');
        setResetPassword('');
        setResetConfirm('');
      }
    } catch (err) {
      setResetError(t('authError', selectedLang));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center overflow-hidden relative">
      <div
        className="absolute inset-0 bg-cover bg-center grayscale"
        style={{ backgroundImage: `url(${bgImage})` }}
      ></div>
      <div className="absolute inset-0 opacity-80" style={{ background: 'var(--app-background)' }}></div>

      {showWindowBar && (
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 window-drag bg-slate-900/80 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-2 text-slate-200">
            <div className="w-5 h-5 rounded-md bg-slate-900/70 border border-white/10 overflow-hidden shadow-sm">
              <img src={appLogo} alt={t('appName', selectedLang)} className="w-full h-full object-contain" />
            </div>
            <span className="text-xs font-semibold tracking-wide">{t('appName', selectedLang)}</span>
          </div>
          <div className="window-no-drag flex items-center gap-3">
            <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-2xl animate-fade-in hover:bg-black/60 transition-colors">
              <Languages size={14} className="text-primary ml-2 mr-1" />
              {availableLangs.map(l => (
                <button
                  key={l.code}
                  onClick={() => {
                    setSelectedLang(l.code);
                    setLastLoginLanguage(l.code);
                  }}
                  className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-300 ${selectedLang === l.code ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <WindowControls lang={selectedLang} />
          </div>
        </div>
      )}
      {isFullscreen && (
        <div className="fixed top-3 right-3 z-50 window-no-drag flex items-center gap-3">
          <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/10 shadow-2xl animate-fade-in hover:bg-black/60 transition-colors">
            <Languages size={14} className="text-primary ml-2 mr-1" />
            {availableLangs.map(l => (
              <button
                key={l.code}
                onClick={() => {
                  setSelectedLang(l.code);
                  setLastLoginLanguage(l.code);
                }}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all duration-300 ${selectedLang === l.code ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <WindowControls
            lang={selectedLang}
            className="bg-slate-900/80 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-xl"
          />
        </div>
      )}

      <div className="relative z-10 w-full max-w-md p-6 md:p-8 mx-4 glass-panel rounded-3xl border border-white/10 shadow-2xl transition-all duration-500 animate-slide-up max-h-[85vh] overflow-y-auto custom-scrollbar">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-primary/20">
              <img src={appLogo} alt={t('appName', selectedLang)} className="w-full h-full object-contain" />
            </div>
            <h1 className="font-display font-bold text-5xl text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary drop-shadow-sm tracking-tight">{t('appName', selectedLang)}</h1>
          </div>
          <p className="text-slate-300 text-sm tracking-widest uppercase">{t('loginSubtitle', selectedLang)}</p>
        </div>

        <div className="flex gap-2 mb-8 bg-slate-900/50 p-1.5 rounded-2xl border border-white/5">
          <button
            onClick={() => {
              setIsRegistering(false);
              setError('');
              setConfirmPassword('');
              setSecretQuestionId('');
              setSecretAnswer('');
              setUsernameError(false);
              setPasswordError(false);
              setConfirmPasswordError(false);
              setSecretQuestionError(false);
              setSecretAnswerError(false);
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${!isRegistering ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/10' : 'text-slate-300 hover:text-white'}`}
          >
            {t('loginTitle', selectedLang)}
          </button>
          <button
            onClick={() => {
              setIsRegistering(true);
              setError('');
              setUsernameError(false);
              setPasswordError(false);
              setConfirmPasswordError(false);
              setSecretQuestionError(false);
              setSecretAnswerError(false);
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${isRegistering ? 'bg-primary/20 text-primary shadow-lg ring-1 ring-primary/20' : 'text-slate-300 hover:text-white'}`}
          >
            {t('register', selectedLang)}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-widest ml-1 drop-shadow-sm">
              {t('username', selectedLang)} <span className="text-red-400">*</span>
            </label>
            <div className="relative group">
              <input
                type="text"
                value={username}
                onChange={(e) => {
                  const value = e.target.value;
                  setUsername(value);
                  if (usernameError && value.trim()) setUsernameError(false);
                }}
                className={inputClass(usernameError, 'pl-11 pr-4 py-3.5')}
                placeholder={t('username', selectedLang)}
              />
              <UserIcon className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-primary transition-colors" size={18} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-widest ml-1 drop-shadow-sm">
              {t('password', selectedLang)} <span className="text-red-400">*</span>
            </label>
            <div className="relative group">
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  const value = e.target.value;
                  setPassword(value);
                  if (passwordError && value.trim()) setPasswordError(false);
                  if (confirmPasswordError && confirmPassword.trim() && value === confirmPassword) {
                    setConfirmPasswordError(false);
                  }
                }}
                className={inputClass(passwordError, 'pl-11 pr-4 py-3.5')}
                placeholder="******"
              />
              <Lock className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-primary transition-colors" size={18} />
            </div>
          </div>

          {isRegistering && (
            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-widest ml-1 drop-shadow-sm">
                {t('passwordConfirm', selectedLang)} <span className="text-red-400">*</span>
              </label>
              <div className="relative group">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    const value = e.target.value;
                    setConfirmPassword(value);
                    if (confirmPasswordError && value.trim() && value === password) {
                      setConfirmPasswordError(false);
                    }
                  }}
                  className={inputClass(confirmPasswordError, 'pl-11 pr-4 py-3.5')}
                  placeholder="******"
                />
                <Lock className="absolute left-4 top-3.5 text-slate-500 group-focus-within:text-primary transition-colors" size={18} />
              </div>
            </div>
          )}

          {isRegistering && (
            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-widest ml-1 drop-shadow-sm">
                {t('secretQuestion', selectedLang)} <span className="text-red-400">*</span>
              </label>
              <div className="relative group">
                <Select
                  value={secretQuestionId}
                  onChange={(value) => {
                    setSecretQuestionId(value);
                    if (secretQuestionError && value) setSecretQuestionError(false);
                  }}
                  options={[
                    { value: '', label: t('secretQuestionPlaceholder', selectedLang) },
                    ...secretQuestions.map(q => ({ value: q.id, label: q.label }))
                  ]}
                  buttonClassName={secretQuestionError ? 'border-2 border-red-500 hover:border-red-400' : ''}
                />
              </div>
            </div>
          )}

          {isRegistering && (
            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-widest ml-1 drop-shadow-sm">
                {t('secretAnswer', selectedLang)} <span className="text-red-400">*</span>
              </label>
              <div className="relative group">
                <input
                  type="text"
                  value={secretAnswer}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSecretAnswer(value);
                    if (secretAnswerError && value.trim()) setSecretAnswerError(false);
                  }}
                  className={inputClass(secretAnswerError, 'px-4 py-3.5')}
                  placeholder={t('secretAnswer', selectedLang)}
                />
              </div>
            </div>
          )}

          {!isRegistering && (
            <div className="flex justify-end items-center">
              <button
                type="button"
                onClick={openReset}
                className="text-xs text-slate-300 hover:text-white transition-colors drop-shadow-sm"
              >
                {t('forgotPassword', selectedLang)}
              </button>
            </div>
          )}


          {error && (
            <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3 animate-fade-in">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
              <p className="text-red-400 text-xs font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold py-4 rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 mt-6 shadow-xl shadow-primary/20 active:scale-95"
          >
            {loading ? t('processing', selectedLang) : (isRegistering ? t('createProfile', selectedLang) : t('enter', selectedLang))}
            {!loading && (isRegistering ? <UserPlus size={18} /> : <LogIn size={18} />)}
          </button>
        </form>

        <div className="mt-8 flex justify-center">
          <p className="text-center text-[10px] text-slate-100 max-w-xs leading-relaxed drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-medium px-4 py-2">
            {t('localDataInfo', selectedLang)}
          </p>
        </div>
      </div>

      {isResetOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
            <div className="w-full max-w-md glass-panel rounded-3xl p-6 relative shadow-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
              <button
                onClick={() => setIsResetOpen(false)}
                className="absolute top-4 right-4 text-slate-300 hover:text-white"
              >
                <X size={18} />
              </button>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-white">{t('resetPasswordTitle', selectedLang)}</h3>
                <p className="text-xs text-slate-300 mt-2">{t('resetPasswordHint', selectedLang)}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-widest ml-1">
                    {t('username', selectedLang)} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={resetUsername}
                    onChange={(e) => {
                      const value = e.target.value;
                      setResetUsername(value);
                      setResetQuestionId('');
                      setResetError('');
                      setResetSuccess('');
                      if (resetUsernameError && value.trim()) setResetUsernameError(false);
                    }}
                    className={inputClass(resetUsernameError, 'px-4 py-3')}
                    placeholder={t('username', selectedLang)}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleLoadQuestion}
                  disabled={resetLoading}
                  className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors text-sm font-bold"
                >
                  {resetLoading ? t('processing', selectedLang) : t('resetFindQuestion', selectedLang)}
                </button>

                {resetQuestionId && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-slate-300">
                    <span className="text-slate-300 uppercase tracking-widest text-[9px] block mb-1">{t('secretQuestion', selectedLang)}</span>
                    <p className="font-semibold">{secretQuestions.find(q => q.id === resetQuestionId)?.label}</p>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-widest ml-1">
                    {t('secretAnswer', selectedLang)} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={resetAnswer}
                    onChange={(e) => {
                      const value = e.target.value;
                      setResetAnswer(value);
                      if (resetAnswerError && value.trim()) setResetAnswerError(false);
                    }}
                    className={inputClass(resetAnswerError, 'px-4 py-3')}
                    placeholder={t('secretAnswer', selectedLang)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-widest ml-1">
                    {t('newPassword', selectedLang)} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => {
                      const value = e.target.value;
                      setResetPassword(value);
                      if (resetPasswordError && value.trim()) setResetPasswordError(false);
                      if (resetConfirmError && resetConfirm.trim() && value === resetConfirm) {
                        setResetConfirmError(false);
                      }
                    }}
                    className={inputClass(resetPasswordError, 'px-4 py-3')}
                    placeholder="******"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-300 mb-2 uppercase tracking-widest ml-1">
                    {t('passwordConfirm', selectedLang)} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="password"
                    value={resetConfirm}
                    onChange={(e) => {
                      const value = e.target.value;
                      setResetConfirm(value);
                      if (resetConfirmError && value.trim() && value === resetPassword) {
                        setResetConfirmError(false);
                      }
                    }}
                    className={inputClass(resetConfirmError, 'px-4 py-3')}
                    placeholder="******"
                  />
                </div>

                {resetError && (
                  <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-xl flex items-center gap-3 animate-fade-in">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                    <p className="text-red-400 text-xs font-medium">{resetError}</p>
                  </div>
                )}

                {resetSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex items-center gap-3 animate-fade-in">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    <p className="text-emerald-300 text-xs font-medium">{resetSuccess}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white font-bold py-3 rounded-xl transition-all shadow-xl shadow-primary/20"
                >
                  {resetLoading ? t('processing', selectedLang) : t('resetAction', selectedLang)}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Footer Copyright */}
      <div className="absolute bottom-6 right-6 flex flex-col items-end gap-1 z-20 opacity-90 hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-2 text-slate-200 text-xs drop-shadow-sm">
          <span>&copy; {new Date().getFullYear()}</span>
          <a
            href="https://katania.me/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors font-bold flex items-center gap-1"
          >
            Katania <Globe size={12} />
          </a>
        </div>
        <p className="text-[10px] text-slate-300 font-mono tracking-widest drop-shadow-sm">v1.0.9</p>
      </div>
    </div>
  );
};

export default Login;

