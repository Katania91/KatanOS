import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import emojiData from '../assets/emoji-data.json';
import EmojiGlyph from './EmojiGlyph';
import ModalPortal from './ModalPortal';

type EmojiDataEntry = {
  unified: string;
  short_name: string;
  short_names?: string[];
  category: string;
  sort_order?: number;
  keywords?: string[];
  skin_variations?: Array<{
    unified: string;
    sheet_x?: number;
    sheet_y?: number;
  }>;
};

type EmojiItem = {
  emoji: string;
  label: string;
  search: string;
  order: number;
};

type EmojiGroup = {
  id: string;
  label: string;
  items: EmojiItem[];
};

const RECENT_STORAGE_KEY = 'katanos_emoji_recent';
const MAX_RECENTS = 48;
const EMOJI_RENDER_SIZE = 28;
const CATEGORY_ICON_SIZE = 18;

const CATEGORY_ORDER = [
  'Smileys & Emotion',
  'People & Body',
  'Animals & Nature',
  'Food & Drink',
  'Travel & Places',
  'Activities',
  'Objects',
  'Symbols',
  'Flags',
];

const CATEGORY_LABELS: Record<string, string> = {
  'Smileys & Emotion': 'Smileys',
  'People & Body': 'People',
  'Animals & Nature': 'Nature',
  'Food & Drink': 'Food',
  'Travel & Places': 'Travel',
  'Activities': 'Activities',
  'Objects': 'Objects',
  'Symbols': 'Symbols',
  'Flags': 'Flags',
};
const CATEGORY_ICON_CODEPOINTS: Record<string, number[]> = {
  'Smileys & Emotion': [0x1f600],
  'People & Body': [0x1f466],
  'Animals & Nature': [0x1f436],
  'Food & Drink': [0x1f354],
  'Travel & Places': [0x1f697],
  'Activities': [0x1f3c0],
  'Objects': [0x1f4a1],
  'Symbols': [0x1f522],
  'Flags': [0x1f3f3, 0xfe0f],
};

const readRecentEmojis = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => typeof item === 'string').slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
};

const getCategoryIcon = (category: string) => {
  const codepoints = CATEGORY_ICON_CODEPOINTS[category];
  if (!codepoints) return String.fromCodePoint(0x1f4cc);
  return String.fromCodePoint(...codepoints);
};

const unifiedToEmoji = (unified: string) => {
  const codepoints = unified.split('-').map((code) => parseInt(code, 16));
  return String.fromCodePoint(...codepoints);
};

const normalizeSearch = (items: string[]) =>
  items
    .filter(Boolean)
    .map((item) => item.replace(/_/g, ' ').toLowerCase())
    .join(' ');

const buildEmojiData = (data: EmojiDataEntry[]) => {
  const groups = new Map<string, EmojiItem[]>();
  const index = new Map<string, EmojiItem>();

  data.forEach((entry, entryIndex) => {
    if (!entry.unified || !entry.category) return;
    const baseOrder = typeof entry.sort_order === 'number' ? entry.sort_order : entryIndex;
    const label = entry.short_name.replace(/_/g, ' ');
    const searchParts = [
      entry.short_name,
      ...(entry.short_names || []),
      ...(entry.keywords || []),
    ];
    const search = normalizeSearch(searchParts);
    const baseItem: EmojiItem = {
      emoji: unifiedToEmoji(entry.unified),
      label,
      search,
      order: baseOrder,
    };

    if (!groups.has(entry.category)) {
      groups.set(entry.category, []);
    }
    groups.get(entry.category)?.push(baseItem);
    if (!index.has(baseItem.emoji)) {
      index.set(baseItem.emoji, baseItem);
    }

    if (entry.skin_variations && entry.skin_variations.length) {
      entry.skin_variations.forEach((variation, variationIndex) => {
        if (!variation?.unified) return;
        const variationItem: EmojiItem = {
          emoji: unifiedToEmoji(variation.unified),
          label,
          search,
          order: baseOrder + (variationIndex + 1) / 10,
        };
        groups.get(entry.category)?.push(variationItem);
        if (!index.has(variationItem.emoji)) {
          index.set(variationItem.emoji, variationItem);
        }
      });
    }
  });

  const orderedGroups: EmojiGroup[] = [];
  const seen = new Set<string>();

  CATEGORY_ORDER.forEach((category) => {
    const items = groups.get(category);
    if (!items || items.length === 0) return;
    items.sort((a, b) => a.order - b.order);
    orderedGroups.push({
      id: category,
      label: CATEGORY_LABELS[category] || category,
      items,
    });
    seen.add(category);
  });

  Array.from(groups.entries()).forEach(([category, items]) => {
    if (seen.has(category) || items.length === 0) return;
    items.sort((a, b) => a.order - b.order);
    orderedGroups.push({
      id: category,
      label: CATEGORY_LABELS[category] || category,
      items,
    });
  });

  return { groups: orderedGroups, index };
};

const { groups: EMOJI_GROUPS, index: EMOJI_INDEX } = buildEmojiData(emojiData as EmojiDataEntry[]);

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  title?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  recentEmptyLabel?: string;
  tabAllLabel?: string;
  tabRecentLabel?: string;
  categoryLabels?: Record<string, string>;
}

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onSelect,
  onClose,
  title = 'Emoji',
  searchPlaceholder = 'Cerca emoji...',
  emptyLabel = 'Nessun risultato.',
  recentEmptyLabel,
  tabAllLabel = 'All',
  tabRecentLabel = 'Recent',
  categoryLabels,
}) => {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'recent'>('all');
  const [activeCategory, setActiveCategory] = useState(EMOJI_GROUPS[0]?.id || '');
  const [recentEmojis, setRecentEmojis] = useState<string[]>(() => readRecentEmojis());
  const trimmedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(recentEmojis));
    } catch {
      // Ignore persistence errors.
    }
  }, [recentEmojis]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (!EMOJI_GROUPS.length) return;
    if (!EMOJI_GROUPS.find((group) => group.id === activeCategory)) {
      setActiveCategory(EMOJI_GROUPS[0].id);
    }
  }, [activeCategory]);

  const filteredGroups = useMemo(() => {
    if (!trimmedQuery) return EMOJI_GROUPS;
    return EMOJI_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.search.includes(trimmedQuery)),
    })).filter((group) => group.items.length > 0);
  }, [trimmedQuery]);

  const recentItems = useMemo(() => {
    const baseItems = recentEmojis.map((emoji, index) => {
      const item = EMOJI_INDEX.get(emoji);
      return (
        item || {
          emoji,
          label: emoji,
          search: '',
          order: index,
        }
      );
    });
    if (!trimmedQuery) return baseItems;
    return baseItems.filter((item) =>
      item.search.includes(trimmedQuery) || item.label.toLowerCase().includes(trimmedQuery)
    );
  }, [recentEmojis, trimmedQuery]);

  const categoryTabs = useMemo(
    () =>
      EMOJI_GROUPS.map((group) => ({
        id: group.id,
        label: categoryLabels?.[group.id] || CATEGORY_LABELS[group.id] || group.label,
        icon: getCategoryIcon(group.id),
      })),
    [categoryLabels]
  );

  const activeGroup = useMemo(() => {
    if (!EMOJI_GROUPS.length) return null;
    return EMOJI_GROUPS.find((group) => group.id === activeCategory) || EMOJI_GROUPS[0];
  }, [activeCategory]);

  const handleSelect = (emoji: string) => {
    const base = readRecentEmojis();
    const next = [emoji, ...base.filter((item) => item !== emoji)].slice(0, MAX_RECENTS);
    setRecentEmojis(next);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore persistence errors.
      }
    }
    onSelect(emoji);
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
        <div className="w-full max-w-xl glass-panel border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-sm font-bold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/5"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4 border-b border-white/10 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${activeTab === 'all'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                {tabAllLabel}
              </button>
              <button
                onClick={() => setActiveTab('recent')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${activeTab === 'recent'
                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                    : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
              >
                {tabRecentLabel}
              </button>
            </div>
            {activeTab === 'all' && !trimmedQuery && (
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                {categoryTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCategory(tab.id)}
                    className={`p-2 rounded-lg transition-colors ${activeCategory === tab.id
                        ? 'bg-white/10 text-white'
                        : 'text-slate-300 hover:text-white hover:bg-white/5'
                      }`}
                    title={tab.label}
                  >
                    <EmojiGlyph emoji={tab.icon} size={CATEGORY_ICON_SIZE} />
                  </button>
                ))}
              </div>
            )}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-[360px] overflow-y-auto custom-scrollbar p-5 space-y-5">
            {activeTab === 'recent' ? (
              recentItems.length > 0 ? (
                <div className="grid grid-cols-8 gap-2">
                  {recentItems.map((item) => (
                    <button
                      key={`recent-${item.emoji}`}
                      onClick={() => handleSelect(item.emoji)}
                      className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-lg flex items-center justify-center transition-colors"
                      title={item.label}
                    >
                      <EmojiGlyph emoji={item.emoji} size={EMOJI_RENDER_SIZE} title={item.label} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500">
                  {trimmedQuery ? emptyLabel : recentEmptyLabel || emptyLabel}
                </div>
              )
            ) : (
              <>
                {trimmedQuery ? (
                  <>
                    {filteredGroups.map((group) => (
                      <div key={group.id}>
                        <div className="text-[10px] uppercase tracking-widest text-slate-300 font-bold mb-2">
                          {categoryLabels?.[group.id] || CATEGORY_LABELS[group.id] || group.label}
                        </div>
                        <div className="grid grid-cols-8 gap-2">
                          {group.items.map((item) => (
                            <button
                              key={`${group.id}-${item.emoji}`}
                              onClick={() => handleSelect(item.emoji)}
                              className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-lg flex items-center justify-center transition-colors"
                              title={item.label}
                            >
                              <EmojiGlyph emoji={item.emoji} size={EMOJI_RENDER_SIZE} title={item.label} />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {filteredGroups.length === 0 && (
                      <div className="text-xs text-slate-500">{emptyLabel}</div>
                    )}
                  </>
                ) : activeGroup ? (
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-300 font-bold mb-2">
                      {categoryLabels?.[activeGroup.id] ||
                        CATEGORY_LABELS[activeGroup.id] ||
                        activeGroup.label}
                    </div>
                    <div className="grid grid-cols-8 gap-2">
                      {activeGroup.items.map((item) => (
                        <button
                          key={`${activeGroup.id}-${item.emoji}`}
                          onClick={() => handleSelect(item.emoji)}
                          className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-lg flex items-center justify-center transition-colors"
                          title={item.label}
                        >
                          <EmojiGlyph emoji={item.emoji} size={EMOJI_RENDER_SIZE} title={item.label} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-500">{emptyLabel}</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};

export default EmojiPicker;
