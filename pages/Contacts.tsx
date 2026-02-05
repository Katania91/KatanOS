import React, { useState, useEffect, useMemo } from 'react';
import { User, Contact } from '../types';
import { db } from '../services/db';
import { buildAvatarDataUri } from '../services/avatar';
import { useTranslation } from '../services/useTranslation';
import ModalPortal from '../components/ModalPortal';
import DatePicker from '../components/DatePicker';
import RequiredInput from '../components/RequiredInput';
import {
    Phone, Mail, Star, Plus, Search, Check,
    Calendar, MapPin, Linkedin, Instagram, Twitter, Globe,
    Tag, Clock, Edit2, Trash2, X, User as UserIcon,
    MessageSquare, ExternalLink, Camera, Upload
} from 'lucide-react';

interface ContactsProps {
    user: User;
    initialSelectedId?: string | null;
}

const Contacts: React.FC<ContactsProps> = ({ user, initialSelectedId }) => {
    const { t } = useTranslation();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [search, setSearch] = useState('');
    const [selectedContactId, setSelectedContactId] = useState<string | null>(initialSelectedId || null);
    const [isEditing, setIsEditing] = useState(false);
    const [filterTag, setFilterTag] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState<Partial<Contact>>({});
    const [newTag, setNewTag] = useState('');
    const [nameError, setNameError] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Feedback State
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    const lang = user.language || 'it';

    const resolveAvatar = (name: string, avatar?: string) => {
        if (avatar) {
            const trimmed = avatar.trim();
            if (trimmed && !trimmed.startsWith('http') && !trimmed.includes('ui-avatars.com')) {
                return trimmed;
            }
        }
        return buildAvatarDataUri(name);
    };

    useEffect(() => {
        loadContacts();
    }, [user]);

    useEffect(() => {
        if (initialSelectedId) {
            setSelectedContactId(initialSelectedId);
        }
    }, [initialSelectedId]);

    useEffect(() => {
        const handleEscape = (event: Event) => {
            if (!deleteConfirmId) return;
            setDeleteConfirmId(null);
            const custom = event as CustomEvent<{ handled?: boolean }>;
            if (custom.detail) {
                custom.detail.handled = true;
            }
        };
        window.addEventListener('katanos:escape', handleEscape);
        return () => window.removeEventListener('katanos:escape', handleEscape);
    }, [deleteConfirmId]);

    const loadContacts = async () => {
        const data = await db.contacts.list(user.id);
        setContacts(data.sort((a, b) => a.name.localeCompare(b.name)));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name?.trim()) {
            setNameError(true);
            return;
        }
        setNameError(false);

        const contactData = {
            ...formData,
            userId: user.id,
            avatar: resolveAvatar(formData.name, formData.avatar),
            updatedAt: new Date().toISOString()
        } as Contact;

        if (contactData.id) {
            await db.contacts.update(contactData.id, contactData);
        } else {
            await db.contacts.add({
                ...contactData,
                isFavorite: false,
                createdAt: new Date().toISOString()
            });
        }

        setIsEditing(false);
        setFormData({});
        loadContacts();
        if (contactData.id) setSelectedContactId(contactData.id);
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDelete = async () => {
        if (deleteConfirmId) {
            await db.contacts.delete(deleteConfirmId);
            if (selectedContactId === deleteConfirmId) {
                setSelectedContactId(null);
                setIsEditing(false);
            }
            loadContacts();
            setDeleteConfirmId(null);
        }
    };

    const toggleFavorite = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        await db.contacts.toggleFavorite(id);
        loadContacts();
    };

    const openSocialLink = (url: string) => {
        if (!url) return;
        const finalUrl = url.startsWith('http') ? url : `https://${url}`;
        (window as any).katanos.openExternal(finalUrl);
    };

    const startNewContact = () => {
        setFormData({ tags: [], socials: {} });
        setSelectedContactId(null);
        setIsEditing(true);
    };

    const startEdit = (contact: Contact) => {
        setFormData({ ...contact });
        setIsEditing(true);
    };

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData({ ...formData, avatar: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && newTag.trim()) {
            e.preventDefault();
            const currentTags = formData.tags || [];
            if (!currentTags.includes(newTag.trim())) {
                setFormData({ ...formData, tags: [...currentTags, newTag.trim()] });
            }
            setNewTag('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        const currentTags = formData.tags || [];
        setFormData({ ...formData, tags: currentTags.filter(t => t !== tagToRemove) });
    };

    const copyText = async (value: string, id: string) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedId(id);
            setTimeout(() => setCopiedId(null), 2000);
        } catch (e) {
            console.error('Copy failed', e);
        }
    };

    const getDaysUntilBirthday = (dateStr?: string) => {
        if (!dateStr) return null;
        const today = new Date();
        const birthDate = new Date(dateStr);
        const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

        if (nextBirthday < today) {
            nextBirthday.setFullYear(today.getFullYear() + 1);
        }

        const diffTime = Math.abs(nextBirthday.getTime() - today.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    };

    const filteredContacts = useMemo(() => {
        return contacts.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) ||
                c.email?.toLowerCase().includes(search.toLowerCase()) ||
                c.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
            const matchesTag = filterTag ? c.tags?.includes(filterTag) : true;
            return matchesSearch && matchesTag;
        });
    }, [contacts, search, filterTag]);

    const selectedContact = contacts.find(c => c.id === selectedContactId);
    const allTags = Array.from(new Set(contacts.flatMap(c => c.tags || [])));

    return (
        <div className="flex flex-col md:flex-row gap-6 min-h-0 md:h-full md:overflow-hidden">
            {/* Left Sidebar: List */}
            <div className={`flex-col w-full md:w-1/3 lg:w-1/4 min-w-[300px] flex ${selectedContactId && !isEditing ? 'hidden md:flex' : 'flex'}`}>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-display font-bold">{t('contacts', lang)}</h2>
                    <button onClick={startNewContact} className="bg-primary hover:bg-indigo-600 text-white p-2 rounded-xl shadow-lg shadow-primary/25 transition-all">
                        <Plus size={24} />
                    </button>
                </div>

                <div className="relative mb-4">
                    <Search className="absolute left-4 top-3 text-slate-300" size={20} />
                    <input
                        type="text"
                        placeholder={t('searchContacts', lang)}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all"
                    />
                </div>

                {/* Tag Filter */}
                {allTags.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-2 custom-scrollbar">
                        <button
                            onClick={() => setFilterTag(null)}
                            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${!filterTag ? 'bg-white text-slate-900' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                        >
                            {t('allTags', lang)}
                        </button>
                        {allTags.map(tag => (
                            <button
                                key={tag}
                                onClick={() => setFilterTag(tag === filterTag ? null : tag)}
                                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-colors ${tag === filterTag ? 'bg-primary text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'}`}
                            >
                                #{tag}
                            </button>
                        ))}
                    </div>
                )}

                <div className="flex-1 md:overflow-y-auto custom-scrollbar space-y-2 pr-2">
                    {filteredContacts.map(contact => (
                        <div
                            key={contact.id}
                            onClick={() => { setSelectedContactId(contact.id); setIsEditing(false); }}
                            className={`p-3 rounded-2xl flex items-center gap-3 cursor-pointer transition-all border ${selectedContactId === contact.id ? 'bg-white/10 border-primary/50' : 'bg-glass border-transparent hover:bg-white/5'}`}
                        >
                            <img src={resolveAvatar(contact.name, contact.avatar)} alt={contact.name} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                            <div className="flex-1 min-w-0">
                                <h4 className={`font-bold truncate ${selectedContactId === contact.id ? 'text-white' : 'text-slate-200'}`}>{contact.name}</h4>
                                <p className="text-xs text-slate-300 truncate">{contact.email || contact.phone}</p>
                            </div>
                            <button
                                onClick={(e) => toggleFavorite(e, contact.id)}
                                className={`transition-colors p-1.5 rounded-lg hover:bg-white/10 ${contact.isFavorite ? 'text-yellow-400' : 'text-slate-500 hover:text-yellow-400'}`}
                            >
                                <Star size={16} fill={contact.isFavorite ? "currentColor" : "none"} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Panel: Details or Form */}
            <div className={`flex-1 bg-glass rounded-3xl border border-white/5 p-6 md:p-8 md:overflow-y-auto custom-scrollbar ${!selectedContactId && !isEditing ? 'hidden md:flex items-center justify-center' : 'flex flex-col'}`}>

                {!selectedContactId && !isEditing ? (
                    <div className="text-center text-slate-300">
                        <UserIcon size={64} className="mx-auto mb-4 opacity-20" />
                        <p>{t('contactDetails', lang)}</p>
                    </div>
                ) : isEditing ? (
                    // EDIT FORM
                    <form onSubmit={handleSave} className="space-y-6 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-bold text-white">{formData.id ? t('editContact', lang) : t('newContact', lang)}</h3>
                            <button type="button" onClick={() => setIsEditing(false)} className="text-slate-300 hover:text-white">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                {/* Avatar Upload */}
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="relative group">
                                        <img
                                            src={resolveAvatar(formData.name || 'New Contact', formData.avatar)}
                                            alt="Avatar"
                                            className="w-20 h-20 rounded-full object-cover border-2 border-white/10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full shadow-lg hover:bg-indigo-500 transition-colors"
                                        >
                                            <Camera size={14} />
                                        </button>
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-sm text-primary hover:text-white transition-colors flex items-center gap-2 font-medium"
                                        >
                                            <Upload size={14} /> {t('uploadPhoto', lang)}
                                        </button>
                                        <p className="text-xs text-slate-300 mt-1">JPG, PNG or GIF</p>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleAvatarUpload}
                                        />
                                    </div>
                                </div>

                                <RequiredInput
                                    value={formData.name || ''}
                                    onChange={(value) => setFormData({ ...formData, name: value })}
                                    error={nameError}
                                    onErrorClear={() => setNameError(false)}
                                    label={t('name', lang)}
                                    labelClassName="text-xs text-slate-300 ml-1 uppercase font-bold tracking-wider"
                                    className="space-y-1"
                                    inputClassName="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none transition-all focus:border-primary"
                                />
                                <div>
                                    <label className="text-xs text-slate-300 ml-1 uppercase font-bold tracking-wider">{t('phone', lang)}</label>
                                    <input type="tel" value={formData.phone || ''} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-300 ml-1 uppercase font-bold tracking-wider">{t('email', lang)}</label>
                                    <input type="email" value={formData.email || ''} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all" />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-300 ml-1 uppercase font-bold tracking-wider">{t('address', lang)}</label>
                                    <input type="text" value={formData.address || ''} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-slate-300 ml-1 uppercase font-bold tracking-wider">{t('birthday', lang)}</label>
                                    <DatePicker
                                        value={formData.birthday || ''}
                                        onChange={(value) => setFormData({ ...formData, birthday: value })}
                                        lang={lang}
                                        inputClassName="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-slate-300 ml-1 uppercase font-bold tracking-wider">{t('tags', lang)}</label>
                                    <div className="bg-black/20 border border-white/10 rounded-xl px-4 py-3 min-h-[50px] flex flex-wrap gap-2 items-center">
                                        {formData.tags?.map(tag => (
                                            <span key={tag} className="bg-primary/20 text-primary px-2 py-1 rounded-lg text-sm flex items-center gap-1">
                                                #{tag}
                                                <button type="button" onClick={() => removeTag(tag)} className="hover:text-white"><X size={12} /></button>
                                            </span>
                                        ))}
                                        <input
                                            type="text"
                                            value={newTag}
                                            onChange={e => setNewTag(e.target.value)}
                                            onKeyDown={handleAddTag}
                                            placeholder={t('addTag', lang) + "..."}
                                            className="bg-transparent outline-none text-white text-sm flex-1 min-w-[80px]"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-slate-300 ml-1 uppercase font-bold tracking-wider">{t('socials', lang)}</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="relative">
                                            <Linkedin size={16} className="absolute left-3 top-3 text-slate-300" />
                                            <input placeholder="LinkedIn" value={formData.socials?.linkedin || ''} onChange={e => setFormData({ ...formData, socials: { ...formData.socials, linkedin: e.target.value } })} className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all" />
                                        </div>
                                        <div className="relative">
                                            <Twitter size={16} className="absolute left-3 top-3 text-slate-300" />
                                            <input placeholder="Twitter/X" value={formData.socials?.twitter || ''} onChange={e => setFormData({ ...formData, socials: { ...formData.socials, twitter: e.target.value } })} className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all" />
                                        </div>
                                        <div className="relative">
                                            <Instagram size={16} className="absolute left-3 top-3 text-slate-300" />
                                            <input placeholder="Instagram" value={formData.socials?.instagram || ''} onChange={e => setFormData({ ...formData, socials: { ...formData.socials, instagram: e.target.value } })} className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all" />
                                        </div>
                                        <div className="relative">
                                            <Globe size={16} className="absolute left-3 top-3 text-slate-300" />
                                            <input placeholder={t('website', lang)} value={formData.socials?.website || ''} onChange={e => setFormData({ ...formData, socials: { ...formData.socials, website: e.target.value } })} className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl pl-10 pr-3 py-2 text-sm text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-300 ml-1 uppercase font-bold tracking-wider">{t('notes', lang)}</label>
                            <textarea rows={4} value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all resize-none"></textarea>
                        </div>

                        <div className="flex justify-end gap-4 pt-4">
                            <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-2 rounded-xl text-slate-300 hover:bg-white/5 transition-colors">{t('cancel', lang)}</button>
                            <button type="submit" className="bg-primary hover:bg-indigo-600 text-white font-bold px-8 py-2 rounded-xl shadow-lg shadow-primary/25 transition-all">{t('save', lang)}</button>
                        </div>
                    </form>
                ) : selectedContact ? (
                    // VIEW DETAILS
                    <div className="space-y-8 animate-fade-in h-full flex flex-col">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-6">
                                <img src={resolveAvatar(selectedContact.name, selectedContact.avatar)} alt={selectedContact.name} className="w-24 h-24 rounded-full object-cover border-4 border-white/10 shadow-2xl" />
                                <div>
                                    <h2 className="text-3xl font-bold text-white">{selectedContact.name}</h2>
                                    <div className="flex gap-2 mt-2">
                                        {selectedContact.tags?.map(tag => (
                                            <span key={tag} className="bg-white/10 text-slate-300 px-2 py-0.5 rounded-md text-xs border border-white/5">#{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startEdit(selectedContact)} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors" title={t('edit', lang)}>
                                    <Edit2 size={20} />
                                </button>
                                <button onClick={() => handleDelete(selectedContact.id)} className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors" title={t('delete', lang)}>
                                    <Trash2 size={20} />
                                </button>
                                <button onClick={() => setSelectedContactId(null)} className="md:hidden p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Contact Info */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">{t('contactDetails', lang)}</h4>

                                <div className="flex items-center gap-4 group cursor-pointer" onClick={() => copyText(selectedContact.phone, 'phone')}>
                                    <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                        <Phone size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-slate-300">{t('phone', lang)}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-medium">{selectedContact.phone || '-'}</p>
                                            {copiedId === 'phone' && <Check size={14} className="text-emerald-400" />}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 group cursor-pointer" onClick={() => copyText(selectedContact.email, 'email')}>
                                    <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center text-pink-400 group-hover:bg-pink-500 group-hover:text-white transition-all">
                                        <Mail size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-slate-300">{t('email', lang)}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-medium">{selectedContact.email || '-'}</p>
                                            {copiedId === 'email' && <Check size={14} className="text-emerald-400" />}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 group">
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                        <MapPin size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-slate-300">{t('address', lang)}</p>
                                        <p className="text-white font-medium">{selectedContact.address || '-'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 group">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                                        <Calendar size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs text-slate-300">{t('birthday', lang)}</p>
                                        <div className="flex items-center gap-2">
                                            <p className="text-white font-medium">{selectedContact.birthday ? new Date(selectedContact.birthday).toLocaleDateString() : '-'}</p>
                                            {selectedContact.birthday && (
                                                <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">
                                                    {getDaysUntilBirthday(selectedContact.birthday) === 0 ? t('happyBirthday', lang) : `${getDaysUntilBirthday(selectedContact.birthday)} ${t('days', lang)}`}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Socials & Notes */}
                            <div className="space-y-6">
                                <div>
                                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">{t('socials', lang)}</h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {selectedContact.socials?.linkedin && (
                                            <div onClick={() => openSocialLink(selectedContact.socials!.linkedin)} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-[#0077b5] hover:text-white transition-all group cursor-pointer">
                                                <Linkedin size={18} className="text-[#0077b5] group-hover:text-white" />
                                                <span className="text-sm truncate">LinkedIn</span>
                                                <ExternalLink size={12} className="ml-auto opacity-50" />
                                            </div>
                                        )}
                                        {selectedContact.socials?.twitter && (
                                            <div onClick={() => openSocialLink(selectedContact.socials!.twitter)} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-black hover:text-white transition-all group cursor-pointer">
                                                <Twitter size={18} className="text-sky-400 group-hover:text-white" />
                                                <span className="text-sm truncate">Twitter</span>
                                                <ExternalLink size={12} className="ml-auto opacity-50" />
                                            </div>
                                        )}
                                        {selectedContact.socials?.instagram && (
                                            <div onClick={() => openSocialLink(selectedContact.socials!.instagram)} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-pink-600 hover:text-white transition-all group cursor-pointer">
                                                <Instagram size={18} className="text-pink-500 group-hover:text-white" />
                                                <span className="text-sm truncate">Instagram</span>
                                                <ExternalLink size={12} className="ml-auto opacity-50" />
                                            </div>
                                        )}
                                        {selectedContact.socials?.website && (
                                            <div onClick={() => openSocialLink(selectedContact.socials!.website)} className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-indigo-600 hover:text-white transition-all group cursor-pointer">
                                                <Globe size={18} className="text-indigo-400 group-hover:text-white" />
                                                <span className="text-sm truncate">{t('website', lang)}</span>
                                                <ExternalLink size={12} className="ml-auto opacity-50" />
                                            </div>
                                        )}
                                        {!selectedContact.socials?.linkedin && !selectedContact.socials?.twitter && !selectedContact.socials?.instagram && !selectedContact.socials?.website && (
                                            <p className="text-slate-300 text-sm col-span-2 italic">{t('noSocials', lang)}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 border-b border-white/5 pb-2">{t('notes', lang)}</h4>
                                    <div className="bg-yellow-100/5 border border-yellow-200/10 p-4 rounded-xl text-slate-300 text-sm leading-relaxed min-h-[100px]">
                                        {selectedContact.notes || <span className="text-slate-500 italic">{t('noNotes', lang)}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center text-xs text-slate-300">
                            <div className="flex items-center gap-2">
                                <Clock size={14} />
                                <span>{t('lastInteraction', lang)}: {selectedContact.lastInteraction ? new Date(selectedContact.lastInteraction).toLocaleDateString() : t('never', lang)}</span>
                            </div>
                            <button
                                onClick={async () => {
                                    const updated = { ...selectedContact, lastInteraction: new Date().toISOString() };
                                    await db.contacts.update(selectedContact.id, updated);
                                    loadContacts();
                                    setSelectedContactId(selectedContact.id); // Refresh view
                                }}
                                className="text-primary hover:text-white transition-colors flex items-center gap-1"
                            >
                                <MessageSquare size={14} />
                                {t('markContacted', lang)}
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <ModalPortal>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[70] animate-fade-in">
                        <div className="glass-panel p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4">
                            <h3 className="text-xl font-bold text-white mb-2">{t('confirmDelete', lang)}</h3>
                            <p className="text-slate-300 mb-6">{t('deleteItemWarning', lang)}</p>
                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-4 py-2 rounded-xl text-slate-300 hover:bg-white/5 transition-colors"
                                >
                                    {t('cancel', lang)}
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors"
                                >
                                    {t('delete', lang)}
                                </button>
                            </div>
                        </div>
                    </div>
                </ModalPortal>
            )}
        </div>
    );
};

export default Contacts;
