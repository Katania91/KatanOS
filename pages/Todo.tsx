import React, { useState, useEffect, useRef } from 'react';
import { User, TodoItem, Checklist, ChecklistItem } from '../types';
import { db } from '../services/db';
import { useTranslation } from '../services/useTranslation';
import { X, Check, Trash2, LayoutGrid, Edit2, Plus, ListChecks, StickyNote } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface TodoProps {
    user: User;
}

type TabType = 'board' | 'checklist';

const COLORS = {
    yellow: 'bg-[#fde68a] text-[#78350f]',
    blue: 'bg-[#bfdbfe] text-[#1e3a8a]',
    green: 'bg-[#bbf7d0] text-[#14532d]',
    pink: 'bg-[#fbcfe8] text-[#831843]',
    purple: 'bg-[#ddd6fe] text-[#4c1d95]',
};

const CHECKLIST_COLORS = {
    yellow: { bg: 'bg-amber-500/20', border: 'border-amber-400/40', accent: 'text-amber-200', title: 'text-amber-100' },
    blue: { bg: 'bg-blue-500/20', border: 'border-blue-400/40', accent: 'text-blue-200', title: 'text-blue-100' },
    green: { bg: 'bg-emerald-500/20', border: 'border-emerald-400/40', accent: 'text-emerald-200', title: 'text-emerald-100' },
    pink: { bg: 'bg-pink-500/20', border: 'border-pink-400/40', accent: 'text-pink-200', title: 'text-pink-100' },
    purple: { bg: 'bg-violet-500/20', border: 'border-violet-400/40', accent: 'text-violet-200', title: 'text-violet-100' },
};

// Scrollbar colors matching each post-it
const SCROLL_COLORS: Record<keyof typeof COLORS, string> = {
    yellow: '#d97706',
    blue: '#2563eb',
    green: '#059669',
    pink: '#db2777',
    purple: '#7c3aed',
};

const Todo: React.FC<TodoProps> = ({ user }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<TabType>('board');

    // Board state
    const [todos, setTodos] = useState<TodoItem[]>([]);
    const [newText, setNewText] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [isCompact, setIsCompact] = useState(false);

    // Checklist state
    const [checklists, setChecklists] = useState<Checklist[]>([]);
    const [newChecklistTitle, setNewChecklistTitle] = useState('');
    const [newItemTexts, setNewItemTexts] = useState<Record<string, string>>({});

    const lang = user.language || 'it';

    useEffect(() => {
        loadTodos();
        loadChecklists();
    }, [user]);

    // Handle window resize
    useEffect(() => {
        const updateCompact = () => setIsCompact(window.innerWidth < 768);

        const updateContainerSize = () => {
            updateCompact();
            if (containerRef.current && window.innerWidth >= 768) {
                setContainerSize({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight
                });
            }
        };

        updateCompact();
        setTimeout(updateContainerSize, 100);

        window.addEventListener('resize', updateContainerSize);
        return () => window.removeEventListener('resize', updateContainerSize);
    }, []);

    // ========== Board Functions ==========
    const getVisualPosition = (todo: TodoItem) => {
        const cardWidth = 256;
        const cardHeight = 256;
        const padding = 20;

        const maxX = Math.max(padding, containerSize.width - cardWidth - padding);
        const maxY = Math.max(padding, containerSize.height - cardHeight - padding);

        return {
            x: Math.max(padding, Math.min(todo.x ?? 50, maxX)),
            y: Math.max(padding, Math.min(todo.y ?? 50, maxY))
        };
    };

    const loadTodos = async () => {
        const data = await db.todos.list(user.id);
        setTodos(data);
    };

    const addNote = async (color: keyof typeof COLORS) => {
        if (!newText.trim()) return;

        const x = Math.floor(Math.random() * 200) + 50;
        const y = Math.floor(Math.random() * 200) + 50;
        const rotation = Math.random() * 6 - 3;

        await db.todos.add({
            userId: user.id,
            text: newText,
            isCompleted: false,
            color: color,
            createdAt: new Date().toISOString(),
            x,
            y,
            rotation
        });
        setNewText('');
        loadTodos();
    };

    const toggleComplete = async (id: string) => {
        const updated = todos.map(t => t.id === id ? { ...t, isCompleted: !t.isCompleted } : t);
        setTodos(updated);
        await db.todos.save(updated);
    };

    const deleteTodo = async (id: string) => {
        await db.todos.delete(id);
        loadTodos();
    };

    const clearCompleted = async () => {
        const active = todos.filter(t => !t.isCompleted);

        if (active.length === todos.length) {
            window.dispatchEvent(new CustomEvent('katanos:notify', {
                detail: {
                    title: t('todo', lang),
                    message: t('noCompleted', lang),
                    type: 'info'
                }
            }));
            return;
        }

        setTodos(active);
        await db.todos.save(active);
    };

    const autoArrange = async () => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.clientWidth;
        const cardWidth = 280;
        const cols = Math.max(1, Math.floor(containerWidth / cardWidth));

        const updated = todos.map((t, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            return {
                ...t,
                x: col * cardWidth + 50,
                y: row * 280 + 50,
                rotation: Math.random() * 4 - 2
            };
        });
        setTodos(updated);
        await db.todos.save(updated);
    };

    const startEditing = (todo: TodoItem) => {
        setEditingId(todo.id);
        setEditText(todo.text);
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const updated = todos.map(t => t.id === editingId ? { ...t, text: editText } : t);
        setTodos(updated);
        setEditingId(null);
        await db.todos.save(updated);
    };

    const bringToFront = (id: string) => {
        const item = todos.find(t => t.id === id);
        if (!item) return;
        const others = todos.filter(t => t.id !== id);
        setTodos([...others, item]);
    };

    const handleDragStart = (e: React.DragEvent, id: string) => {
        if (editingId || isCompact) return;

        bringToFront(id);
        setDraggingId(id);

        const rect = (e.currentTarget as Element).getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        if (!draggingId || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const containerWidth = containerRef.current.scrollWidth;
        const containerHeight = containerRef.current.scrollHeight;

        const cardWidth = 256;
        const cardHeight = 256;
        const padding = 20;

        let newX = e.clientX - containerRect.left - dragOffset.x;
        let newY = e.clientY - containerRect.top - dragOffset.y;

        newX = Math.max(padding, Math.min(newX, containerWidth - cardWidth - padding));
        newY = Math.max(padding, Math.min(newY, containerHeight - cardHeight - padding));

        const updated = todos.map(t => t.id === draggingId ? { ...t, x: newX, y: newY } : t);
        setTodos(updated);
        setDraggingId(null);

        await db.todos.save(updated);
    };

    const renderTodoContent = (text: string) => {
        const lines = text.split('\n');
        return (
            <div className="space-y-1">
                {lines.map((line, index) => {
                    const trimmed = line.trim();
                    if (!trimmed) {
                        return <div key={`line-${index}`} className="h-3" />;
                    }
                    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
                    if (orderedMatch) {
                        return (
                            <div key={`line-${index}`} className="flex gap-2">
                                <span className="font-semibold">{orderedMatch[1]}.</span>
                                <span className="flex-1 break-words">{orderedMatch[2]}</span>
                            </div>
                        );
                    }
                    const bulletMatch = trimmed.match(/^[-•]\s*(.*)/);
                    if (bulletMatch) {
                        return (
                            <div key={`line-${index}`} className="flex gap-2">
                                <span className="font-semibold">-</span>
                                <span className="flex-1 break-words">{bulletMatch[1]}</span>
                            </div>
                        );
                    }
                    return (
                        <div key={`line-${index}`} className="break-words">
                            {line}
                        </div>
                    );
                })}
            </div>
        );
    };

    // ========== Checklist Functions ==========
    const loadChecklists = async () => {
        const data = await db.checklists.list(user.id);
        setChecklists(data);
    };

    const addChecklist = async () => {
        if (!newChecklistTitle.trim()) return;

        const colorKeys = Object.keys(COLORS) as Array<keyof typeof COLORS>;
        const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)];
        const now = new Date().toISOString();

        await db.checklists.add({
            userId: user.id,
            title: newChecklistTitle.trim(),
            items: [],
            color: randomColor,
            createdAt: now,
            updatedAt: now
        });
        setNewChecklistTitle('');
        loadChecklists();
    };

    const deleteChecklist = async (id: string) => {
        await db.checklists.delete(id);
        loadChecklists();
    };

    const addItemToChecklist = async (checklistId: string) => {
        const text = newItemTexts[checklistId]?.trim();
        if (!text) return;

        const checklist = checklists.find(c => c.id === checklistId);
        if (!checklist) return;

        const newItem: ChecklistItem = {
            id: uuidv4(),
            text,
            isChecked: false,
            order: checklist.items.length
        };

        const updatedItems = [...checklist.items, newItem];
        await db.checklists.update(checklistId, {
            items: updatedItems,
            updatedAt: new Date().toISOString()
        });

        setNewItemTexts(prev => ({ ...prev, [checklistId]: '' }));
        loadChecklists();
    };

    const toggleItemCheck = async (checklistId: string, itemId: string) => {
        const checklist = checklists.find(c => c.id === checklistId);
        if (!checklist) return;

        const updatedItems = checklist.items.map(item =>
            item.id === itemId ? { ...item, isChecked: !item.isChecked } : item
        );

        await db.checklists.update(checklistId, {
            items: updatedItems,
            updatedAt: new Date().toISOString()
        });
        loadChecklists();
    };

    const deleteItem = async (checklistId: string, itemId: string) => {
        const checklist = checklists.find(c => c.id === checklistId);
        if (!checklist) return;

        const updatedItems = checklist.items.filter(item => item.id !== itemId);

        await db.checklists.update(checklistId, {
            items: updatedItems,
            updatedAt: new Date().toISOString()
        });
        loadChecklists();
    };

    // ========== Render ==========
    return (
        <div className="min-h-0 md:h-full md:overflow-hidden flex flex-col">
            {/* Header with Tabs */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('board')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'board'
                            ? 'bg-indigo-500/30 text-white border border-indigo-500/50'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                            }`}
                    >
                        <StickyNote size={16} />
                        {t('tabBoard', lang)}
                    </button>
                    <button
                        onClick={() => setActiveTab('checklist')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'checklist'
                            ? 'bg-indigo-500/30 text-white border border-indigo-500/50'
                            : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                            }`}
                    >
                        <ListChecks size={16} />
                        {t('tabChecklist', lang)}
                    </button>
                </div>

                {/* Board actions (only visible on board tab) */}
                {activeTab === 'board' && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={autoArrange}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold transition-colors border border-white/10"
                        >
                            <LayoutGrid size={16} /> {t('arrange', lang)}
                        </button>
                        <button
                            onClick={clearCompleted}
                            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/20 hover:text-red-200 rounded-xl text-sm font-bold transition-colors border border-white/10"
                        >
                            <Trash2 size={16} /> {t('clearCompleted', lang)}
                        </button>
                    </div>
                )}
            </div>

            {/* Board Tab Content */}
            {activeTab === 'board' && (
                <>
                    {/* Input Area */}
                    <div className="glass-panel p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center gap-4 max-w-2xl z-50 relative mb-6 mx-auto w-full shadow-2xl border border-white/10">
                        <textarea
                            value={newText}
                            onChange={e => setNewText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    addNote('yellow');
                                }
                            }}
                            placeholder={t('writeNote', lang)}
                            rows={2}
                            className="w-full sm:flex-1 bg-transparent border-none outline-none text-white placeholder:text-slate-300 text-lg leading-relaxed resize-none"
                        />
                        <div className="flex flex-wrap gap-2 sm:justify-start justify-center">
                            {(Object.keys(COLORS) as Array<keyof typeof COLORS>).map(color => (
                                <button
                                    key={color}
                                    onClick={() => addNote(color)}
                                    className={`w-8 h-8 rounded-full border-2 border-white/20 hover:scale-110 transition-transform shadow-lg ${COLORS[color].split(' ')[0]}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div className="w-full md:flex-1 min-h-[420px] md:min-h-0 bg-slate-900/30 rounded-3xl border border-white/5 shadow-inner overflow-auto custom-scrollbar">
                        <div
                            ref={containerRef}
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            className={`relative min-h-[420px] ${isCompact ? 'flex flex-col gap-4 p-4' : 'h-full min-w-[720px] cursor-crosshair'}`}
                        >
                            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]"></div>

                            {todos.length === 0 && (
                                <div className="absolute inset-0 flex items-center justify-center text-slate-500 pointer-events-none">
                                    <p className="text-xl font-handwriting opacity-50 rotate-[-5deg]">{t('emptyBoard', lang)}</p>
                                </div>
                            )}

                            {todos.map(todo => {
                                const isDragging = draggingId === todo.id;
                                const isEditing = editingId === todo.id;
                                const visualPos = getVisualPosition(todo);
                                const itemStyle = isCompact
                                    ? { transform: 'rotate(0deg)' }
                                    : {
                                        left: visualPos.x,
                                        top: visualPos.y,
                                        transform: `rotate(${todo.rotation || 0}deg) ${isDragging ? 'scale(1.1)' : 'scale(1)'}`,
                                        zIndex: isDragging || isEditing ? 100 : 10,
                                        opacity: isDragging ? 0.5 : 1
                                    };

                                return (
                                    <div
                                        key={todo.id}
                                        draggable={!isEditing && !isCompact}
                                        onDragStart={(e) => handleDragStart(e, todo.id)}
                                        onMouseDown={() => { if (!isCompact) bringToFront(todo.id); }}
                                        onDoubleClick={() => startEditing(todo)}
                                        className={`relative w-full min-h-[200px] md:absolute md:w-64 md:h-64 transition-all duration-200 ease-out ${!isEditing && !isCompact ? 'cursor-move hover:scale-[1.02]' : ''}`}
                                        style={itemStyle}
                                    >
                                        {/* Pin */}
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-red-500 shadow-lg border border-red-700 z-20 pointer-events-none">
                                            <div className="absolute top-1 left-1 w-1 h-1 bg-white/50 rounded-full"></div>
                                        </div>

                                        {/* Paper */}
                                        <div
                                            className={`group w-full h-full p-5 shadow-xl flex flex-col hover:shadow-2xl transition-shadow ${COLORS[todo.color]}`}
                                            style={{
                                                clipPath: 'polygon(0% 0%, 100% 0%, 100% 85%, 85% 100%, 0% 100%)',
                                            }}
                                        >
                                            {isEditing ? (
                                                <textarea
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    onBlur={saveEdit}
                                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); } }}
                                                    autoFocus
                                                    className="w-full flex-1 bg-transparent border-none outline-none resize-none font-handwriting text-xl leading-snug text-inherit pr-1"
                                                    style={{
                                                        scrollbarWidth: 'thin',
                                                        scrollbarColor: `${SCROLL_COLORS[todo.color]}40 transparent`,
                                                    }}
                                                />
                                            ) : (
                                                <div
                                                    className={`font-handwriting text-xl leading-snug break-words flex-1 overflow-y-auto pr-1 scrollbar-on-hover ${todo.isCompleted ? 'line-through opacity-50' : ''}`}
                                                    style={{
                                                        '--scrollbar-thumb': `${SCROLL_COLORS[todo.color]}80`,
                                                    } as React.CSSProperties}
                                                >
                                                    {renderTodoContent(todo.text)}
                                                </div>
                                            )}

                                            <div className="flex justify-between items-center mt-2 border-t border-black/10 pt-2">
                                                <button
                                                    onClick={() => toggleComplete(todo.id)}
                                                    className="p-1.5 hover:bg-black/10 rounded-full cursor-pointer transition-colors"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    title={t('markDone', lang)}
                                                >
                                                    <Check size={18} className={todo.isCompleted ? 'text-green-800 font-bold' : 'opacity-40'} />
                                                </button>

                                                {!isEditing && (
                                                    <button
                                                        onClick={() => startEditing(todo)}
                                                        className="p-1.5 hover:bg-black/10 rounded-full cursor-pointer transition-colors opacity-40 hover:opacity-100"
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        title={t('edit', lang)}
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => deleteTodo(todo.id)}
                                                    className="p-1.5 hover:bg-black/10 rounded-full text-red-800/60 hover:text-red-900 cursor-pointer transition-colors"
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    title={t('delete', lang)}
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Folded Corner */}
                                        <div
                                            className="absolute bottom-0 right-0 w-[15%] h-[15%] bg-black/10 pointer-events-none"
                                            style={{
                                                clipPath: 'polygon(0 0, 0 100%, 100% 0)',
                                                background: 'linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%)'
                                            }}
                                        ></div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Checklist Tab Content */}
            {activeTab === 'checklist' && (
                <div className="flex-1 overflow-auto custom-scrollbar">
                    {/* New Checklist Input */}
                    <div className="glass-panel p-4 rounded-2xl flex items-center gap-4 max-w-md mb-6 shadow-xl border border-white/10">
                        <input
                            type="text"
                            value={newChecklistTitle}
                            onChange={e => setNewChecklistTitle(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addChecklist();
                                }
                            }}
                            placeholder={t('checklistTitlePlaceholder', lang)}
                            className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-slate-400 text-lg"
                        />
                        <button
                            onClick={addChecklist}
                            className="p-2 bg-indigo-500/30 hover:bg-indigo-500/50 rounded-xl transition-colors"
                            aria-label={t('newChecklist', lang)}
                        >
                            <Plus size={20} className="text-indigo-200" />
                        </button>
                    </div>

                    {/* Checklists Grid */}
                    {checklists.length === 0 ? (
                        <div className="flex items-center justify-center h-64 text-slate-400">
                            <p className="text-lg">{t('noChecklists', lang)}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {checklists.map(checklist => {
                                const colors = CHECKLIST_COLORS[checklist.color];
                                const checkedCount = checklist.items.filter(i => i.isChecked).length;
                                const totalCount = checklist.items.length;

                                return (
                                    <div
                                        key={checklist.id}
                                        className={`${colors.bg} ${colors.border} border rounded-2xl p-4 shadow-lg`}
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className={`font-bold text-lg ${colors.title}`}>{checklist.title}</h3>
                                            <div className="flex items-center gap-2">
                                                {totalCount > 0 && (
                                                    <span className="text-xs text-slate-300 font-medium">
                                                        {checkedCount}/{totalCount} {t('checkedItems', lang)}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => deleteChecklist(checklist.id)}
                                                    className="p-1 hover:bg-red-500/20 rounded-lg transition-colors text-red-400/60 hover:text-red-400"
                                                    title={t('deleteChecklist', lang)}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Items */}
                                        <div className="space-y-2 mb-3 max-h-64 overflow-auto custom-scrollbar">
                                            {checklist.items.length === 0 ? (
                                                <p className="text-slate-400 text-sm italic">{t('emptyChecklist', lang)}</p>
                                            ) : (
                                                checklist.items.map(item => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center gap-2 group"
                                                    >
                                                        <button
                                                            onClick={() => toggleItemCheck(checklist.id, item.id)}
                                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${item.isChecked
                                                                ? 'bg-emerald-500 border-emerald-500'
                                                                : 'border-slate-400 hover:border-slate-300 bg-white/5'
                                                                }`}
                                                            aria-label={item.isChecked ? 'Deseleziona' : 'Seleziona'}
                                                        >
                                                            {item.isChecked && <Check size={12} className="text-white" />}
                                                        </button>
                                                        <span className={`flex-1 text-sm ${item.isChecked ? 'line-through text-slate-500' : 'text-white'}`}>
                                                            {item.text}
                                                        </span>
                                                        <button
                                                            onClick={() => deleteItem(checklist.id, item.id)}
                                                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all text-red-400/80 hover:text-red-300"
                                                            aria-label={t('delete', lang)}
                                                        >
                                                            <X size={12} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Add Item Input */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                                            <input
                                                type="text"
                                                value={newItemTexts[checklist.id] || ''}
                                                onChange={e => setNewItemTexts(prev => ({ ...prev, [checklist.id]: e.target.value }))}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        addItemToChecklist(checklist.id);
                                                    }
                                                }}
                                                placeholder={t('itemPlaceholder', lang)}
                                                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-slate-400 text-sm"
                                                aria-label={t('itemPlaceholder', lang)}
                                            />
                                            <button
                                                onClick={() => addItemToChecklist(checklist.id)}
                                                className="px-3 py-1 text-sm bg-white/15 hover:bg-white/25 rounded-lg transition-colors font-medium text-white"
                                            >
                                                {t('addItem', lang)}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Todo;
