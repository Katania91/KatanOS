
import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowRight, Calendar, CheckSquare, Wallet, Users, Gamepad2, Activity, BookOpen, Plus, Library, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../services/useTranslation';
import { User, Contact } from '../types';
import { db } from '../services/db';
import ModalPortal from './ModalPortal';

interface CommandPaletteProps {
    user: User;
    onNavigate: (page: string) => void;
    onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ user, onNavigate, onClose }) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const lang = user.language || 'it';
    const { t } = useTranslation();

    useEffect(() => {
        const loadContacts = async () => {
            const c = await db.contacts.list(user.id);
            setContacts(c);
        };
        loadContacts();
        inputRef.current?.focus();
    }, [user.id]);

    const navigationItems = [
        { id: 'dashboard', label: t('dashboard', lang), icon: ArrowRight, type: 'nav' },
        { id: 'agenda', label: t('agenda', lang), icon: Calendar, type: 'nav' },
        { id: 'contacts', label: t('contacts', lang), icon: Users, type: 'nav' },
        { id: 'todo', label: t('todo', lang), icon: CheckSquare, type: 'nav' },
        { id: 'journal', label: t('journal', lang), icon: BookOpen, type: 'nav' },
        { id: 'habits', label: t('habits', lang), icon: Activity, type: 'nav' },
        { id: 'finance', label: t('finance', lang), icon: Wallet, type: 'nav' },
        { id: 'bookshelf', label: t('bookshelf', lang), icon: Library, type: 'nav' },
        { id: 'vault', label: t('vault', lang), icon: Lock, type: 'nav' },
        { id: 'games', label: t('games', lang), icon: Gamepad2, type: 'nav' },
        { id: 'add_todo', label: t('cmd_add_todo', lang), icon: Plus, type: 'action' },
    ];

    const filteredContacts = contacts
        .filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
        .map(c => ({ id: c.id, label: c.name, icon: Users, type: 'contact', meta: c }));

    const filteredItems = [
        ...navigationItems.filter(item => item.label.toLowerCase().includes(query.toLowerCase())),
        ...(query.length > 1 ? filteredContacts : [])
    ];

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            executeItem(filteredItems[selectedIndex]);
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    const executeItem = async (item: any) => {
        if (!item) return;
        
        if (item.type === 'nav') {
            onNavigate(item.id);
        } else if (item.type === 'action') {
            if (item.id === 'add_todo') {
                // Quick add todo via prompt for MVP simplicity
                // Ideally this would open the Todo page with focus or a modal
                onNavigate('todo'); 
            }
        } else if (item.type === 'contact') {
            // Navigate to contacts page
            onNavigate('contacts');
        }
        onClose();
    };

    return (
        <ModalPortal>
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-md animate-fade-in" onClick={onClose}>
              <div className="w-full max-w-2xl glass-panel rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center px-4 py-4 border-b border-[var(--glass-border)] gap-3">
                    <Search className="text-slate-300" size={20} />
                    <input 
                        ref={inputRef}
                        type="text" 
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder={t('cmd_placeholder', lang)}
                        className="flex-1 bg-transparent text-lg text-slate-100 placeholder:text-slate-400 outline-none border-none"
                    />
                    <div className="flex gap-1">
                        <span className="text-[10px] bg-white/10 px-2 py-1 rounded text-slate-300">ESC</span>
                      </div>
                  </div>
                
                <div className="max-h-[60vh] overflow-y-auto p-2 custom-scrollbar">
                    {filteredItems.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">No results found.</div>
                    ) : (
                        filteredItems.map((item, idx) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={`${item.type}-${item.id}`}
                                    onClick={() => executeItem(item)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left ${
                                        idx === selectedIndex 
                                            ? 'bg-primary/90 text-white shadow-lg shadow-primary/20 scale-[1.01]' 
                                            : 'text-slate-300 hover:bg-white/5'
                                    }`}
                                >
                                    <Icon size={18} className={idx === selectedIndex ? 'text-white' : 'text-slate-400'} />
                                    <div className="flex-1">
                                        <span className="font-medium text-sm">{item.label}</span>
                                        {item.type === 'contact' && <span className="ml-2 text-xs opacity-70">Contact</span>}
                                    </div>
                                    {idx === selectedIndex && <ArrowRight size={16} className="animate-pulse" />}
                                </button>
                            );
                        })
                    )}
                </div>
                
                <div className="px-4 py-2 bg-black/20 border-t border-[var(--glass-border)] flex justify-between text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    <span>K-Command</span>
                    <span>Navigate with arrows</span>
                </div>
            </div>
        </div>
        </ModalPortal>
    );
};

export default CommandPalette;
