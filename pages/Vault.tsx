
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Unlock, Key, AlertTriangle, Eye, EyeOff, Copy, Check, Plus, Trash2, Save, RefreshCw, FileText, CreditCard, LogOut, Info, X } from 'lucide-react';
import { db } from '../services/db';
import { createVault, unlockVault, saveVault, getMasterKey, recoverVault, resetVaultPassword } from '../services/vault';
import { EncryptedVault, VaultItem } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from '../services/useTranslation';
import ModalPortal from '../components/ModalPortal';
import Select from '../components/Select';
import RequiredInput from '../components/RequiredInput';

const Vault: React.FC = () => {
  const { t } = useTranslation();
  const [vault, setVault] = useState<EncryptedVault | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);

  // Setup State
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

  // Unlock State
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const unlockInputRef = useRef<HTMLInputElement>(null);

  // Recovery State
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Item Management
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'login' | 'note' | 'card'>('all');
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const storedVault = db.vault.get();
    if (storedVault) {
      setVault(storedVault);
    } else {
      setIsSetupMode(true);
    }
  }, []);

  // Auto-focus unlock input when entering locked state
  useEffect(() => {
    if (!isUnlocked && !isRecoveryMode && !isSetupMode && vault) {
      const timer = setTimeout(() => {
        unlockInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked, isRecoveryMode, isSetupMode, vault]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showInfo) setShowInfo(false);
        if (itemToDelete) setItemToDelete(null);
        if (editingItem) setEditingItem(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [showInfo, itemToDelete, editingItem]);

  const handleCreateVault = async () => {
    const user = db.auth.getCurrentUser();
    if (!user) return;

    if (setupPassword.length < 8) {
      setUnlockError(t('passwordMinLength'));
      return;
    }
    if (setupPassword !== setupConfirm) {
      setUnlockError(t('passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);
    try {
      const { vault: newVault, recoveryCode: code } = await createVault(user.id, setupPassword);
      db.vault.save(newVault);
      setVault(newVault);
      setRecoveryCode(code);
      setIsSetupMode(false);
      // Auto unlock
      const key = await getMasterKey(newVault, setupPassword);
      setMasterKey(key);
      setItems([]);
      setIsUnlocked(true);
    } catch (e) {
      setUnlockError(t('vaultCreationError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!vault) return;
    setIsLoading(true);
    setUnlockError('');
    try {
      const decryptedItems = await unlockVault(vault, unlockPassword);
      const key = await getMasterKey(vault, unlockPassword);
      setItems(decryptedItems);
      setMasterKey(key);
      setIsUnlocked(true);
      setUnlockPassword('');
    } catch (e) {
      setUnlockError(t('invalidPassword'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecovery = async () => {
    if (!vault) return;
    if (newPassword.length < 8) {
      setUnlockError(t('newPasswordMinLength'));
      return;
    }
    setIsLoading(true);
    try {
      // 1. Verify recovery code by trying to decrypt
      const recoveredItems = await recoverVault(vault, recoveryInput);

      // 2. Reset password (re-wrap master key)
      const newVault = await resetVaultPassword(vault, recoveryInput, newPassword);

      // 3. Save new vault
      db.vault.save(newVault);
      setVault(newVault);

      // 4. Unlock
      setItems(recoveredItems);
      const key = await getMasterKey(newVault, newPassword);
      setMasterKey(key);
      setIsUnlocked(true);
      setIsRecoveryMode(false);
      setRecoveryInput('');
      setNewPassword('');
    } catch (e) {
      setUnlockError(t('recoveryError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveItem = async (item: VaultItem) => {
    if (!vault || !masterKey) return;

    try {
      // Fix: Check if we are editing an existing item (has ID) or creating a new one (editingItem.id is empty)
      const isNewItem = !editingItem?.id;

      const updatedItems = isNewItem
        ? [...items, item]
        : items.map(i => i.id === item.id ? item : i);

      // Encrypt and Save to DB
      const updatedVault = await saveVault(updatedItems, masterKey, vault);
      db.vault.save(updatedVault);

      // Update State only after successful save
      setVault(updatedVault);
      setItems(updatedItems);
      setEditingItem(null);
    } catch (e) {
      console.error("Save failed", e);
      alert(t('saveError') + ": " + (e as Error).message);
    }
  };

  const handleDeleteItem = (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!vault || !masterKey || !itemToDelete) return;

    try {
      const updatedItems = items.filter(i => i.id !== itemToDelete);

      const updatedVault = await saveVault(updatedItems, masterKey, vault);
      db.vault.save(updatedVault);

      setVault(updatedVault);
      setItems(updatedItems);
      setItemToDelete(null);
      if (editingItem?.id === itemToDelete) {
        setEditingItem(null);
      }
    } catch (e) {
      console.error("Delete failed", e);
      alert(t('deleteError') + ": " + (e as Error).message);
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    setMasterKey(null);
    setItems([]);
  };

  if (recoveryCode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-900 text-white animate-in fade-in rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative">
        <button
          onClick={() => setShowInfo(true)}
          className="absolute top-6 right-6 text-slate-400 hover:text-blue-400 transition-colors z-20"
          title={t('vaultInfoTitle')}
        >
          <Info size={24} />
        </button>

        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-red-500/30 shadow-2xl">
          <div className="flex items-center justify-center mb-6 text-red-500">
            <AlertTriangle size={48} />
          </div>
          <h2 className="text-2xl font-bold text-center mb-4">{t('recoveryCode')}</h2>
          <p className="text-slate-300 text-center mb-6">
            {t('recoveryCodeWarning')}
            <br /><span className="text-red-400 font-bold">{t('recoveryCodeWarningBold')}</span>
          </p>

          <div className="bg-slate-950 p-4 rounded-lg border border-slate-700 flex items-center justify-between mb-6">
            <code className="text-xl font-mono text-yellow-400 tracking-wider">{recoveryCode}</code>
            <button
              onClick={async () => {
                if (!recoveryCode) return;
                try {
                  await navigator.clipboard.writeText(recoveryCode);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                } catch (e) {
                  const textArea = document.createElement("textarea");
                  textArea.value = recoveryCode;
                  document.body.appendChild(textArea);
                  textArea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textArea);
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }
              }}
              className="p-2 hover:bg-slate-800 rounded-md transition-colors"
              title={t('copy')}
            >
              {isCopied ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
            </button>
          </div>

          <button
            onClick={() => setRecoveryCode(null)}
            className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('savedCodeContinue')}
          </button>
        </div>

        {showInfo && <VaultInfoModal onClose={() => setShowInfo(false)} t={t} />}
      </div>
    );
  }

  if (isSetupMode) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800 relative">
        <button
          onClick={() => setShowInfo(true)}
          className="absolute top-6 right-6 text-slate-400 hover:text-blue-400 transition-colors z-20"
          title={t('vaultInfoTitle')}
        >
          <Info size={24} />
        </button>

        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-slate-700 shadow-2xl">
          <div className="flex items-center justify-center mb-6 text-blue-500">
            <Shield size={64} />
          </div>
          <h2 className="text-2xl font-bold text-center mb-2">{t('createVault')}</h2>
          <p className="text-slate-400 text-center mb-8">
            {t('vaultDescription')}
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('masterPassword')}</label>
              <input
                type="password"
                value={setupPassword}
                onChange={(e) => setSetupPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder={t('min8Chars')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('confirmPassword')}</label>
              <input
                type="password"
                value={setupConfirm}
                onChange={(e) => setSetupConfirm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {unlockError && <p className="text-red-400 text-sm">{unlockError}</p>}

            <button
              onClick={handleCreateVault}
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 mt-4"
            >
              {isLoading ? <RefreshCw className="animate-spin" /> : <Lock size={18} />}
              {t('createVaultButton')}
            </button>
          </div>
        </div>

        {showInfo && <VaultInfoModal onClose={() => setShowInfo(false)} t={t} />}
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-900 text-white relative overflow-hidden rounded-3xl shadow-2xl border border-slate-800">
        <button
          onClick={() => setShowInfo(true)}
          className="absolute top-6 right-6 text-slate-400 hover:text-blue-400 transition-colors z-20"
          title={t('vaultInfoTitle')}
        >
          <Info size={24} />
        </button>

        {/* Background Vault Door Effect */}
        <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full border-[40px] border-slate-400 border-dashed animate-spin-slow"></div>
        </div>

        <div className="relative max-w-md w-full bg-slate-800/90 backdrop-blur-xl p-8 rounded-2xl border border-slate-700 shadow-2xl z-10">
          <div className="flex items-center justify-center mb-8">
            <div className="w-24 h-24 bg-slate-950 rounded-full flex items-center justify-center border-4 border-slate-700 shadow-inner">
              <Lock size={40} className="text-slate-400" />
            </div>
          </div>

          {!isRecoveryMode ? (
            <>
              <h2 className="text-2xl font-bold text-center mb-6">{t('vaultLocked')}</h2>
              <div className="space-y-4">
                <input
                  ref={unlockInputRef}
                  type="password"
                  autoFocus
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                  disabled={isLoading}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-center text-white text-lg tracking-widest focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder={t('enterMasterPassword')}
                />

                {unlockError && <p className="text-red-400 text-sm text-center">{unlockError}</p>}

                <button
                  onClick={handleUnlock}
                  disabled={isLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? <RefreshCw className="animate-spin" /> : <Unlock size={18} />}
                  {t('unlock')}
                </button>

                <button
                  onClick={() => setIsRecoveryMode(true)}
                  className="w-full text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {t('forgotPassword')}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-center mb-2 text-red-400">{t('accountRecovery')}</h2>
              <p className="text-slate-400 text-center text-sm mb-6">{t('enterRecoveryCode')}</p>
              <div className="space-y-4">
                <input
                  type="text"
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none font-mono"
                  placeholder={t('recoveryCodePlaceholder')}
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder={t('newPassword')}
                />

                {unlockError && <p className="text-red-400 text-sm text-center">{unlockError}</p>}

                <div className="flex gap-2">
                  <button
                    onClick={() => setIsRecoveryMode(false)}
                    className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={handleRecovery}
                    disabled={isLoading}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isLoading ? <RefreshCw className="animate-spin" /> : <Shield size={18} />}
                    {t('recover')}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {showInfo && <VaultInfoModal onClose={() => setShowInfo(false)} t={t} />}
      </div>
    );
  }

  // UNLOCKED VIEW
  return (
    <div className="h-full flex flex-col bg-slate-900 text-white rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/80 backdrop-blur-sm rounded-t-3xl">
        <div className="flex items-center gap-3">
          <Shield className="text-blue-500" />
          <h1 className="text-xl font-bold">{t('vault')}</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-800 rounded-lg p-1">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${filterType === 'all' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t('all')}
            </button>
            <button
              onClick={() => setFilterType('login')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${filterType === 'login' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t('login')}
            </button>
            <button
              onClick={() => setFilterType('card')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${filterType === 'card' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t('cards')}
            </button>
            <button
              onClick={() => setFilterType('note')}
              className={`px-3 py-1 rounded-md text-sm transition-colors ${filterType === 'note' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {t('notes')}
            </button>
          </div>
          <button
            onClick={() => setEditingItem({ id: '', type: 'login', name: '', createdAt: '', updatedAt: '' })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <Plus size={16} /> {t('new')}
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="text-slate-400 hover:text-blue-400 transition-colors"
            title={t('vaultInfoTitle')}
          >
            <Info size={20} />
          </button>
          <button
            onClick={handleLock}
            className="text-slate-400 hover:text-red-400 transition-colors"
            title={t('lockVault')}
          >
            <LogOut size={20} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {editingItem ? (
          <ItemEditor
            item={editingItem}
            onSave={handleSaveItem}
            onCancel={() => setEditingItem(null)}
            onDelete={(id) => { handleDeleteItem(id); setEditingItem(null); }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.filter(i => filterType === 'all' || i.type === filterType).map(item => (
              <div
                key={item.id}
                onClick={() => setEditingItem(item)}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 rounded-xl p-4 cursor-pointer transition-all group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-slate-900 rounded-lg text-blue-400">
                    {item.type === 'login' && <Key size={20} />}
                    {item.type === 'card' && <CreditCard size={20} />}
                    {item.type === 'note' && <FileText size={20} />}
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(item.id); }}
                    className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="font-semibold text-lg mb-1">{item.name}</h3>
                <p className="text-slate-400 text-sm truncate">
                  {item.type === 'login' && item.username}
                  {item.type === 'card' && `•••• ${item.cardNumber?.slice(-4)}`}
                  {item.type === 'note' && t('secureNote')}
                </p>
              </div>
            ))}

            {items.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
                <Shield size={48} className="mb-4 opacity-20" />
                <p>{t('vaultEmpty')}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
            <div className="glass-panel p-6 rounded-2xl shadow-2xl max-w-sm w-full animate-scale-in">
              <h3 className="text-xl font-bold mb-4 text-white">{t('confirmDelete')}</h3>
              <p className="text-slate-300 mb-6">{t('deleteItemWarning')}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setItemToDelete(null)}
                  className="px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  {t('delete')}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Info Modal */}
      {showInfo && <VaultInfoModal onClose={() => setShowInfo(false)} t={t} />}
    </div>
  );
};
const ItemEditor: React.FC<{ item: Partial<VaultItem>, onSave: (item: VaultItem) => void, onCancel: () => void, onDelete?: (id: string) => void }> = ({ item, onSave, onCancel, onDelete }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Partial<VaultItem>>({
    type: 'login',
    ...item
  });
  const [showPass, setShowPass] = useState(false);
  const [showCvv, setShowCvv] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [nameError, setNameError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);

    onSave({
      ...formData,
      id: formData.id || uuidv4(),
      createdAt: formData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as VaultItem);
  };

  return (
    <div className="max-w-2xl mx-auto bg-slate-800 rounded-xl border border-slate-700 p-6">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        {formData.id ? t('editItem') : t('newItem')}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">{t('type')}</label>
            <Select
              value={formData.type || 'login'}
              onChange={(val) => setFormData({ ...formData, type: val as VaultItem['type'] })}
              options={[
                { value: 'login', label: t('login') },
                { value: 'card', label: t('creditCard') },
                { value: 'note', label: t('secureNote') },
              ]}
            />
          </div>
          <RequiredInput
            value={formData.name || ''}
            onChange={(value) => setFormData({ ...formData, name: value })}
            error={nameError}
            onErrorClear={() => setNameError(false)}
            label={t('name')}
            labelClassName="text-sm font-medium text-slate-400 mb-1"
            inputClassName="w-full bg-slate-950 rounded-lg px-3 py-2 outline-none transition-colors"
            normalBorderClassName="border border-slate-700 focus:border-blue-500"
            placeholder={t('namePlaceholder')}
          />
        </div>

        {formData.type === 'login' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('usernameEmail')}</label>
              <input
                type="text"
                value={formData.username || ''}
                onChange={e => setFormData({ ...formData, username: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('password')}</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={formData.password || ''}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('url')}</label>
              <input
                type="url"
                value={formData.url || ''}
                onChange={e => setFormData({ ...formData, url: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                placeholder="https://..."
              />
            </div>
          </>
        )}

        {formData.type === 'card' && (
          <>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('cardNumber')}</label>
              <input
                type="text"
                value={formData.cardNumber || ''}
                onChange={e => setFormData({ ...formData, cardNumber: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 font-mono"
                placeholder="0000 0000 0000 0000"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{t('expiry')}</label>
                <input
                  type="text"
                  value={formData.cardExpiry || ''}
                  onChange={e => setFormData({ ...formData, cardExpiry: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500"
                  placeholder="MM/YY"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{t('cvv')}</label>
                <div className="relative">
                  <input
                    type={showCvv ? "text" : "password"}
                    value={formData.cardCvv || ''}
                    onChange={e => setFormData({ ...formData, cardCvv: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 pr-10"
                    placeholder="123"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCvv(!showCvv)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showCvv ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{t('pin')}</label>
                <div className="relative">
                  <input
                    type={showPin ? "text" : "password"}
                    value={formData.cardPin || ''}
                    onChange={e => setFormData({ ...formData, cardPin: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 pr-10"
                    placeholder="****"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPin ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">{t('notes')}</label>
          <textarea
            value={formData.notes || ''}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 min-h-[100px]"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700 mt-6">
          {formData.id && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(formData.id!)}
              className="mr-auto px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 size={18} /> {t('delete')}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Save size={18} /> {t('save')}
          </button>
        </div>
      </form>
    </div>
  );
};

const VaultInfoModal: React.FC<{ onClose: () => void, t: (key: string) => string }> = ({ onClose, t }) => (
  <ModalPortal>
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="glass-panel p-8 rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-300 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6 text-blue-400">
          <Shield size={32} />
          <h3 className="text-2xl font-bold text-white">{t('vaultInfoTitle')}</h3>
        </div>

        <div className="space-y-4 text-slate-300 leading-relaxed">
          <p className="font-medium text-white">{t('vaultInfoDesc')}</p>
          <p>{t('vaultInfoP1')}</p>
          <p>{t('vaultInfoP2')}</p>
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex gap-3 items-start">
            <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-red-200">{t('vaultInfoP3')}</p>
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
          >
            {t('vaultInfoClose')}
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
);

export default Vault;
