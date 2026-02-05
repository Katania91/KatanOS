import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar as CalIcon,
  ChevronDown,
  Filter,
  Lightbulb,
  Link2,
  List,
  ListOrdered,
  Plus,
  Quote,
  Save,
  Search,
  SmilePlus,
  Sparkles,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Bold,
  Italic,
  Flag,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Palette,
  Highlighter,
  Eraser,
} from 'lucide-react';
import { User, JournalEntry } from '../types';
import { db } from '../services/db';
import { getTranslationValue } from '../services/translations';
import { useTranslation } from '../services/useTranslation';
import { analyzeJournalEntry } from '../services/gemini';
import { resolveSecretValue } from '../services/secrets';
import EmojiPicker from '../components/EmojiPicker';
import EmojiGlyph from '../components/EmojiGlyph';
import ColorPicker from '../components/ColorPicker';
import ModalPortal from '../components/ModalPortal';
import emojiData from '../assets/emoji-data.json';
import {
  emojiSheet,
  EMOJI_SHEET_CELL_SIZE,
  EMOJI_SHEET_HEIGHT,
  EMOJI_SHEET_WIDTH,
  getEmojiSprite,
} from '../services/emojiSprite';

interface JournalProps {
  user: User;
}

type EmojiDataEntry = {
  unified: string;
  skin_variations?: Array<{ unified: string }>;
};

const DEFAULT_MOODS: { id: string; emoji: string }[] = [
  { id: 'happy', emoji: '😊' },
  { id: 'energetic', emoji: '⚡' },
  { id: 'neutral', emoji: '😐' },
  { id: 'stressed', emoji: '😫' },
  { id: 'sad', emoji: '😔' },
];

const FONT_OPTIONS = [
  { id: 'inter', label: 'Inter', value: 'Inter' },
  { id: 'outfit', label: 'Outfit', value: 'Outfit' },
  { id: 'press-start', label: 'Press Start 2P', value: '"Press Start 2P"' },
  { id: 'serif', label: 'Serif', value: 'serif' },
  { id: 'mono', label: 'Mono', value: 'monospace' },
];

const FONT_SIZE_OPTIONS = [
  { id: '1', label: '12', value: '1' },
  { id: '2', label: '14', value: '2' },
  { id: '3', label: '16', value: '3' },
  { id: '4', label: '18', value: '4' },
  { id: '5', label: '22', value: '5' },
  { id: '6', label: '26', value: '6' },
  { id: '7', label: '32', value: '7' },
];

const unifiedToEmoji = (unified: string) => {
  const codepoints = unified.split('-').map((code) => parseInt(code, 16));
  return String.fromCodePoint(...codepoints);
};

const buildEmojiList = (data: EmojiDataEntry[]) => {
  const set = new Set<string>();
  data.forEach((entry) => {
    if (entry.unified) set.add(unifiedToEmoji(entry.unified));
    entry.skin_variations?.forEach((variation) => {
      if (variation.unified) set.add(unifiedToEmoji(variation.unified));
    });
  });
  return Array.from(set);
};

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const EMOJI_LIST = buildEmojiList(emojiData as EmojiDataEntry[]);
const EMOJI_PATTERN = EMOJI_LIST.map(escapeRegex)
  .sort((a, b) => b.length - a.length)
  .join('|');
const EMOJI_REGEX = EMOJI_PATTERN ? new RegExp(EMOJI_PATTERN, 'g') : null;

const sanitizePlainText = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const isProbablyHtml = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const toEditorHtml = (value: string) => {
  if (!value) return '';
  if (isProbablyHtml(value)) return value;
  return sanitizePlainText(value).replace(/\n/g, '<br />');
};

const createEmojiSpanHtml = (emoji: string, size = 20) => {
  const sprite = getEmojiSprite(emoji);
  if (!sprite) {
    return sanitizePlainText(emoji);
  }
  const scale = size / EMOJI_SHEET_CELL_SIZE;
  const backgroundSize = `${EMOJI_SHEET_WIDTH * scale}px ${EMOJI_SHEET_HEIGHT * scale}px`;
  const backgroundPosition = `${-sprite.sheetX * EMOJI_SHEET_CELL_SIZE * scale}px ${-sprite.sheetY * EMOJI_SHEET_CELL_SIZE * scale
    }px`;
  return `<span class="journal-emoji" contenteditable="false" data-emoji="${sanitizePlainText(
    emoji
  )}" style="width:${size}px;height:${size}px;background-image:url(${emojiSheet});background-size:${backgroundSize};background-position:${backgroundPosition};"></span>`;
};

const normalizeJournalHtml = (value: string) => {
  const html = toEditorHtml(value);
  if (!EMOJI_REGEX) return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  doc.querySelectorAll('img, .journal-media').forEach((node) => node.remove());
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (node.nodeValue) textNodes.push(node);
  }

  textNodes.forEach((node) => {
    const text = node.nodeValue || '';
    EMOJI_REGEX.lastIndex = 0;
    if (!EMOJI_REGEX.test(text)) return;
    EMOJI_REGEX.lastIndex = 0;
    const fragment = doc.createDocumentFragment();
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EMOJI_REGEX.exec(text)) !== null) {
      const matchIndex = match.index;
      if (matchIndex > lastIndex) {
        fragment.appendChild(doc.createTextNode(text.slice(lastIndex, matchIndex)));
      }
      const span = doc.createElement('span');
      const emoji = match[0];
      span.setAttribute('class', 'journal-emoji');
      span.setAttribute('contenteditable', 'false');
      span.setAttribute('data-emoji', emoji);
      const sprite = getEmojiSprite(emoji);
      if (sprite) {
        const size = 20;
        const scale = size / EMOJI_SHEET_CELL_SIZE;
        span.style.width = `${size}px`;
        span.style.height = `${size}px`;
        span.style.backgroundImage = `url(${emojiSheet})`;
        span.style.backgroundSize = `${EMOJI_SHEET_WIDTH * scale}px ${EMOJI_SHEET_HEIGHT * scale}px`;
        span.style.backgroundPosition = `${-sprite.sheetX * EMOJI_SHEET_CELL_SIZE * scale}px ${-sprite.sheetY * EMOJI_SHEET_CELL_SIZE * scale
          }px`;
      } else {
        span.textContent = emoji;
      }
      fragment.appendChild(span);
      fragment.appendChild(doc.createTextNode(' '));
      lastIndex = matchIndex + emoji.length;
    }
    if (lastIndex < text.length) {
      fragment.appendChild(doc.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode?.replaceChild(fragment, node);
  });

  return doc.body.innerHTML;
};

const extractPlainText = (value: string, includeEmoji: boolean) => {
  if (!value) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(toEditorHtml(value), 'text/html');
  const emojiNodes = doc.querySelectorAll('span[data-emoji]');
  emojiNodes.forEach((node) => {
    const emoji = node.getAttribute('data-emoji') || '';
    if (includeEmoji) {
      node.replaceWith(doc.createTextNode(emoji));
    } else {
      node.remove();
    }
  });
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
};

const Journal: React.FC<JournalProps> = ({ user }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [content, setContent] = useState('');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [isMoodOpen, setIsMoodOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMoodFilters, setActiveMoodFilters] = useState<Set<string>>(new Set());
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [textColor, setTextColor] = useState('#e2e8f0');
  const [highlightColor, setHighlightColor] = useState('#facc15');
  const [formatState, setFormatState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    list: false,
    listOrdered: false,
    quote: false,
    code: false,
    codeBlock: false,
    align: 'left' as 'left' | 'center' | 'right' | 'justify' | null,
    block: 'p',
    fontSize: '3',
  });

  const editorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const lastEntryIdRef = useRef<string | null>(null);

  const lang = user.language || 'it';
  const prompts =
    getTranslationValue<string[]>('journalPrompts', lang) ||
    getTranslationValue<string[]>('journalPrompts', 'en') ||
    [];
  const moodOptions = useMemo(() => {
    const custom = (user.journalMoods || []).map((mood) => ({
      ...mood,
      isCustom: true,
    }));
    return [
      ...DEFAULT_MOODS.map((mood) => ({ ...mood, isCustom: false })),
      ...custom,
    ];
  }, [user.journalMoods]);
  const moodIdSet = useMemo(() => new Set(moodOptions.map((mood) => mood.id)), [moodOptions]);
  const resolveMoodLabel = (id: string) => {
    const custom = user.journalMoods?.find((mood) => mood.id === id);
    if (custom?.label) return custom.label;
    return moodIdSet.has(id) ? t(`mood_${id}`, lang) : t('mood_neutral', lang);
  };
  const resolveMoodEmoji = (id: string) => {
    const found = moodOptions.find((mood) => mood.id === id);
    const fallback = DEFAULT_MOODS.find((mood) => mood.id === 'neutral') || DEFAULT_MOODS[0];
    return found?.emoji || fallback?.emoji || '';
  };

  useEffect(() => {
    loadEntries();
  }, [user]);

  useEffect(() => {
    if (!selectedEntry || !isDirty) return;
    const timer = window.setTimeout(() => {
      void handleSave(true);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [content, isDirty, selectedEntry]);

  useEffect(() => {
    const handleSelectionChange = () => {
      updateFormatState();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  useEffect(() => {
    if (!selectedEntry || !editorRef.current) return;
    if (lastEntryIdRef.current === selectedEntry.id) return;
    editorRef.current.innerHTML = content;
    lastEntryIdRef.current = selectedEntry.id;
  }, [selectedEntry?.id, content]);

  useEffect(() => {
    const handleEscape = (event: Event) => {
      let handled = false;
      if (isLinkOpen) {
        setIsLinkOpen(false);
        handled = true;
      } else if (isEmojiOpen) {
        setIsEmojiOpen(false);
        handled = true;
      } else if (isMoodOpen) {
        setIsMoodOpen(false);
        handled = true;
      }
      if (handled) {
        const custom = event as CustomEvent<{ handled?: boolean }>;
        if (custom.detail) {
          custom.detail.handled = true;
        }
      }
    };
    window.addEventListener('katanos:escape', handleEscape);
    return () => window.removeEventListener('katanos:escape', handleEscape);
  }, [isLinkOpen, isEmojiOpen, isMoodOpen]);

  useEffect(() => {
    if (entries.length === 0) return;
    const invalid = entries.filter((entry) => entry.mood && !moodIdSet.has(entry.mood));
    if (invalid.length === 0) return;
    const nextEntries = entries.map((entry) =>
      entry.mood && !moodIdSet.has(entry.mood) ? { ...entry, mood: 'neutral' } : entry
    );
    setEntries(nextEntries);
    if (selectedEntry?.mood && !moodIdSet.has(selectedEntry.mood)) {
      setSelectedEntry({ ...selectedEntry, mood: 'neutral' });
    }
    Promise.all(
      invalid.map((entry) => db.journal.save({ ...entry, mood: 'neutral' }))
    ).catch(() => { });
  }, [entries, moodIdSet, selectedEntry]);

  const loadEntries = async () => {
    const data = await db.journal.list(user.id);
    const cleaned = data.map((entry) => {
      const normalized = normalizeJournalHtml(entry.content || '');
      const nextMood = entry.mood && !moodIdSet.has(entry.mood) ? 'neutral' : entry.mood;
      if (normalized !== entry.content || nextMood !== entry.mood) {
        return {
          ...entry,
          content: normalized,
          mood: nextMood,
          __needsSave: true,
        } as JournalEntry & { __needsSave?: boolean };
      }
      return entry;
    });
    const toSave = cleaned.filter((entry) => (entry as JournalEntry & { __needsSave?: boolean }).__needsSave);
    if (toSave.length > 0) {
      await Promise.all(
        toSave.map((entry) => {
          const { __needsSave, ...payload } = entry as JournalEntry & { __needsSave?: boolean };
          return db.journal.save(payload);
        })
      );
    }
    const sorted = cleaned
      .map((entry) => {
        const { __needsSave, ...payload } = entry as JournalEntry & { __needsSave?: boolean };
        return payload;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setEntries(sorted);
    if (!selectedEntry && sorted.length > 0) {
      selectEntry(sorted[0]);
    } else if (selectedEntry) {
      const updated = sorted.find((entry) => entry.id === selectedEntry.id);
      if (updated) selectEntry(updated);
    }
  };

  const updateEntryState = (updated: JournalEntry) => {
    setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
    setSelectedEntry(updated);
  };

  const selectEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    const raw = toEditorHtml(entry.content || '');
    const normalized = normalizeJournalHtml(raw);
    setContent(normalized);
    setIsDirty(normalized !== raw);
    setIsMoodOpen(false);
    if (editorRef.current) {
      editorRef.current.innerHTML = normalized;
    }
    updateFormatState();
  };

  const handleNew = async () => {
    const newEntry = await db.journal.add({
      userId: user.id,
      date: new Date().toISOString(),
      content: '',
      mood: 'neutral',
    });
    setEntries((prev) => [newEntry, ...prev]);
    selectEntry(newEntry);
  };

  const handleSave = async (silent = false) => {
    if (!selectedEntry) return;
    const normalized = normalizeJournalHtml(content);
    const updated = { ...selectedEntry, content: normalized };
    await db.journal.save(updated);
    updateEntryState(updated);
    setContent(normalized);
    setIsDirty(false);
    if (!silent && editorRef.current) {
      editorRef.current.innerHTML = normalized;
    }
  };

  const handleMoodChange = async (mood: string) => {
    if (!selectedEntry) return;
    const updated = { ...selectedEntry, mood };
    updateEntryState(updated);
    await db.journal.save(updated);
    setIsMoodOpen(false);
  };

  const handleDelete = async (id: string) => {
    await db.journal.delete(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
    setSelectedEntry(null);
    setContent('');
  };

  const handleAnalyze = async () => {
    if (!selectedEntry) return;
    const plainText = extractPlainText(content, true);
    if (!plainText.trim()) return;
    const apiKey = await resolveSecretValue(user.apiKey);
    if (!apiKey) return;

    setIsAnalysing(true);
    const result = await analyzeJournalEntry(apiKey, lang, plainText);
    const updated = {
      ...selectedEntry,
      content,
      mood: result.mood,
      aiReflection: result.reflection,
    };
    await db.journal.save(updated);
    updateEntryState(updated);
    setIsAnalysing(false);
  };

  const handleInspire = () => {
    if (!prompts.length) return;
    const random = prompts[Math.floor(Math.random() * prompts.length)];
    insertTextAtCaret(random);
  };

  const handleReport = () => {
    if (!selectedEntry?.aiReflection) return;
    const subject = encodeURIComponent(t('reportAiSubject', lang));
    const body = encodeURIComponent(
      t('reportAiBody', lang)
        .replace('{content}', selectedEntry.aiReflection.substring(0, 500))
        .replace('{userId}', user?.id || 'unknown')
    );
    const mailto = `mailto:kevin@katania.me?subject=${subject}&body=${body}`;
    if (window.katanos?.openExternal) {
      window.katanos.openExternal(mailto);
    } else {
      window.open(mailto);
    }
  };

  const saveSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    selectionRef.current = selection.getRangeAt(0);
  };

  const restoreSelection = () => {
    const selection = window.getSelection();
    if (!selection || !selectionRef.current) return;
    selection.removeAllRanges();
    selection.addRange(selectionRef.current);
  };

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const isSelectionInsideEditor = () => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode || !editorRef.current) return false;
    return editorRef.current.contains(selection.anchorNode);
  };

  const isSelectionInTag = (tagName: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.anchorNode) return false;
    const node =
      selection.anchorNode.nodeType === Node.ELEMENT_NODE
        ? (selection.anchorNode as Element)
        : selection.anchorNode.parentElement;
    if (!node) return false;
    return !!node.closest(tagName.toLowerCase());
  };

  const unwrapClosestTag = (tagName: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const container =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? (range.commonAncestorContainer as Element)
        : range.commonAncestorContainer.parentElement;
    const target = container?.closest(tagName.toLowerCase());
    if (!target) return;
    const parent = target.parentNode;
    if (!parent) return;
    while (target.firstChild) {
      parent.insertBefore(target.firstChild, target);
    }
    parent.removeChild(target);
  };

  const updateFormatState = () => {
    if (!isSelectionInsideEditor()) return;
    let align: 'left' | 'center' | 'right' | 'justify' | null = null;
    if (document.queryCommandState('justifyCenter')) {
      align = 'center';
    } else if (document.queryCommandState('justifyRight')) {
      align = 'right';
    } else if (document.queryCommandState('justifyFull')) {
      align = 'justify';
    } else if (document.queryCommandState('justifyLeft')) {
      align = 'left';
    }
    const block = (document.queryCommandValue('formatBlock') || '').toString().toLowerCase();
    const fontSize = (document.queryCommandValue('fontSize') || '').toString();
    setFormatState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      list: document.queryCommandState('insertUnorderedList'),
      listOrdered: document.queryCommandState('insertOrderedList'),
      quote: isSelectionInTag('blockquote'),
      code: isSelectionInTag('code'),
      codeBlock: isSelectionInTag('pre'),
      align,
      block: block || 'p',
      fontSize: fontSize || '3',
    });
  };

  const syncContentFromEditor = () => {
    if (!editorRef.current) return;
    setContent(editorRef.current.innerHTML);
    setIsDirty(true);
    updateFormatState();
  };

  const insertHtmlAtCaret = (html: string) => {
    focusEditor();
    restoreSelection();
    document.execCommand('insertHTML', false, html);
    syncContentFromEditor();
  };

  const insertTextAtCaret = (text: string) => {
    focusEditor();
    restoreSelection();
    document.execCommand('insertText', false, text);
    syncContentFromEditor();
  };

  const applyCommand = (command: string, value?: string) => {
    focusEditor();
    restoreSelection();
    if (!isSelectionInsideEditor()) return;
    if (
      [
        'bold',
        'italic',
        'underline',
        'strikeThrough',
        'fontName',
        'fontSize',
        'foreColor',
        'hiliteColor',
      ].includes(command)
    ) {
      document.execCommand('styleWithCSS', false, 'true');
    }
    document.execCommand(command, false, value);
    syncContentFromEditor();
  };

  const applyBlockFormat = (block: string) => {
    focusEditor();
    restoreSelection();
    if (!isSelectionInsideEditor()) return;
    const tag = block.toLowerCase();
    const value = tag === 'p' ? 'p' : `<${tag}>`;
    document.execCommand('formatBlock', false, value);
    syncContentFromEditor();
  };

  const applyAlign = (command: 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'justifyFull') => {
    if (!isSelectionInsideEditor()) return;
    applyCommand(command);
  };

  const toggleInlineCode = () => {
    focusEditor();
    restoreSelection();
    if (!isSelectionInsideEditor()) return;
    if (isSelectionInTag('code')) {
      unwrapClosestTag('code');
      syncContentFromEditor();
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      document.execCommand('insertHTML', false, '<code>&#8203;</code>');
    } else {
      const fragment = range.cloneContents();
      const wrapper = document.createElement('div');
      wrapper.appendChild(fragment);
      wrapper.querySelectorAll('code').forEach((node) => {
        node.replaceWith(document.createTextNode(node.textContent || ''));
      });
      document.execCommand('insertHTML', false, `<code>${wrapper.innerHTML}</code>`);
    }
    syncContentFromEditor();
  };

  const toggleCodeBlock = () => {
    focusEditor();
    restoreSelection();
    const isInCodeBlock = isSelectionInTag('pre');
    document.execCommand('formatBlock', false, isInCodeBlock ? 'p' : 'pre');
    syncContentFromEditor();
  };

  const clearFormatting = () => {
    focusEditor();
    restoreSelection();
    if (!isSelectionInsideEditor()) return;
    document.execCommand('removeFormat');
    document.execCommand('hiliteColor', false, 'transparent');
    document.execCommand('backColor', false, 'transparent');
    document.execCommand('foreColor', false, 'inherit');
    document.execCommand('formatBlock', false, 'p');
    syncContentFromEditor();
  };

  const toggleQuote = () => {
    focusEditor();
    restoreSelection();
    const isInQuote = isSelectionInTag('blockquote');
    document.execCommand('formatBlock', false, isInQuote ? 'p' : 'blockquote');
    syncContentFromEditor();
  };

  const handleToolbarMouseDown = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    if (tagName === 'select') {
      saveSelection();
      return;
    }
    if (tagName === 'input') {
      const input = target as HTMLInputElement;
      if (input.type === 'color') {
        saveSelection();
        return;
      }
    }
    event.preventDefault();
    focusEditor();
    saveSelection();
  };

  const handleEmojiSelect = (emoji: string) => {
    insertHtmlAtCaret(`${createEmojiSpanHtml(emoji)}&#8203;`);
    // Don't close picker - let user close it manually
  };

  const handleLinkInsert = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const label = linkText.trim() || url;
    insertHtmlAtCaret(
      `<a href="${sanitizePlainText(url)}" target="_blank" rel="noopener noreferrer">${sanitizePlainText(
        label
      )}</a>`
    );
    setLinkUrl('');
    setLinkText('');
    setIsLinkOpen(false);
  };

  const handleOpenLink = () => {
    saveSelection();
    const selectionText = window.getSelection()?.toString() || '';
    setLinkText(selectionText);
    setIsLinkOpen(true);
  };

  const handleOpenEmoji = () => {
    saveSelection();
    setIsEmojiOpen(true);
  };

  const handleEditorKeyUp = () => {
    saveSelection();
    updateFormatState();
  };

  const handleEditorMouseUp = () => {
    saveSelection();
    updateFormatState();
  };

  const handleEditorMouseDown = () => {
    saveSelection();
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const plainText = extractPlainText(entry.content || '', false).toLowerCase();
      const matchesSearch = plainText.includes(searchTerm.toLowerCase());
      const matchesMood = activeMoodFilters.size === 0 || (entry.mood && activeMoodFilters.has(entry.mood));
      return matchesSearch && matchesMood;
    });
  }, [entries, searchTerm, activeMoodFilters]);

  const plainContent = useMemo(() => extractPlainText(content, true), [content]);
  const emojiCount = useMemo(() => {
    if (!content) return 0;
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');
    return doc.querySelectorAll('span[data-emoji]').length;
  }, [content]);
  const normalizedBlock = formatState.block.replace(/[<>]/g, '');
  const blockValue = ['p', 'h1', 'h2', 'h3'].includes(normalizedBlock) ? normalizedBlock : 'p';
  const fontSizeValue = FONT_SIZE_OPTIONS.some((opt) => opt.value === formatState.fontSize)
    ? formatState.fontSize
    : '3';
  const wordCount = useMemo(() => {
    if (!plainContent) return 0;
    return plainContent.split(/\s+/).filter(Boolean).length;
  }, [plainContent]);

  const toolbarButtonClass = (active: boolean) =>
    `p-2 rounded-lg transition-colors ${active
      ? 'bg-indigo-500/20 text-white ring-1 ring-indigo-400/40'
      : 'hover:bg-white/10 text-slate-300 hover:text-white'
    }`;

  return (
    <div className="min-h-0 md:h-full md:overflow-hidden flex flex-col md:flex-row gap-6 animate-fade-in pb-6">
      <div className="w-full md:w-80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <BookOpen className="text-indigo-400" /> {t('journalTitle', lang)}
          </h2>
          <button
            onClick={() => setSearchTerm('')}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
            title={t('search', lang)}
          >
            <Filter size={16} />
          </button>
        </div>

        <button
          onClick={handleNew}
          className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/30 active:scale-95"
        >
          <Plus size={18} /> {t('newEntry', lang)}
        </button>

        <div className="flex flex-col gap-3 bg-gradient-to-br from-white/5 to-white/0 p-3 rounded-2xl border border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-300" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('search', lang)}
              className="w-full bg-slate-900/50 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:border-indigo-500 outline-none transition-colors"
            />
          </div>
          <div className="flex justify-between gap-1">
            {moodOptions.map((mood) => {
              const isActive = activeMoodFilters.has(mood.id);
              return (
                <button
                  key={mood.id}
                  onClick={() => {
                    const next = new Set(activeMoodFilters);
                    if (next.has(mood.id)) next.delete(mood.id);
                    else next.add(mood.id);
                    setActiveMoodFilters(next);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-lg transition-all border ${isActive
                    ? 'bg-white/10 border-indigo-500/50 shadow-inner'
                    : 'border-transparent hover:bg-white/5 opacity-60 hover:opacity-100'
                    }`}
                  title={resolveMoodLabel(mood.id)}
                >
                  <EmojiGlyph emoji={mood.emoji} size={18} />
                </button>
              );
            })}
            <button
              onClick={() => setActiveMoodFilters(new Set())}
              className={`px-2 rounded-lg text-xs font-bold text-slate-300 hover:text-white transition-colors ${activeMoodFilters.size === 0 ? 'hidden' : ''
                }`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 md:overflow-y-auto custom-scrollbar space-y-2 pr-1 min-h-[300px]">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              onClick={() => selectEntry(entry)}
              className={`p-4 rounded-xl cursor-pointer transition-all border border-transparent group ${selectedEntry?.id === entry.id ? 'bg-white/10 border-white/10' : 'bg-white/5 hover:bg-white/10'
                }`}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="text-sm font-bold text-white">
                  {new Date(entry.date).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
                {entry.mood && <EmojiGlyph emoji={resolveMoodEmoji(entry.mood)} size={18} />}
              </div>
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                {extractPlainText(entry.content || '', false) || t('journalPlaceholder', lang)}
              </p>
            </div>
          ))}
          {filteredEntries.length === 0 && (
            <div className="text-center text-slate-300 text-sm py-10">
              {t('noEntries', lang)}
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-white/5 text-xs text-slate-300 text-center font-medium uppercase tracking-wider">
          {entries.length}{' '}
          {entries.length === 1 ? t('journalEntriesSingle', lang) : t('journalEntriesPlural', lang)}
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-3xl p-6 md:p-8 pb-4 md:pb-6 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-sky-500/10 pointer-events-none"></div>
        <div className="relative z-10 flex flex-col h-full">
          {selectedEntry ? (
            <>
              <div className="flex flex-col gap-4 border-b border-white/5 pb-4 mb-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-300">
                      <CalIcon size={16} />
                      <span className="text-sm font-mono">
                        {new Date(selectedEntry.date).toLocaleString()}
                      </span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={() => setIsMoodOpen(!isMoodOpen)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5"
                      >
                        <EmojiGlyph
                          emoji={resolveMoodEmoji(selectedEntry.mood || 'neutral')}
                          size={18}
                        />
                        <span className="text-xs font-bold text-slate-300 capitalize">
                          {resolveMoodLabel(selectedEntry.mood || 'neutral')}
                        </span>
                        <ChevronDown size={12} className="text-slate-300" />
                      </button>

                      {isMoodOpen && (
                        <ModalPortal>
                          <div
                            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in"
                            onClick={() => setIsMoodOpen(false)}
                          >
                            <div
                              className="bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-xs animate-scale-in relative"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <h3 className="text-lg font-bold text-white mb-4 text-center">
                                {t('selectMood', lang)}
                              </h3>
                              <div className="grid grid-cols-1 gap-2">
                                {moodOptions.map((m) => (
                                  <button
                                    key={m.id}
                                    onClick={() => handleMoodChange(m.id)}
                                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-4 transition-colors ${selectedEntry.mood === m.id
                                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                                      }`}
                                  >
                                    <EmojiGlyph emoji={m.emoji} size={22} />
                                    <span className="capitalize font-bold">{resolveMoodLabel(m.id)}</span>
                                    {selectedEntry.mood === m.id && (
                                      <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>
                                    )}
                                  </button>
                                ))}
                              </div>
                              <button
                                onClick={() => setIsMoodOpen(false)}
                                className="mt-4 w-full py-2 text-sm text-slate-400 hover:text-white transition-colors"
                              >
                                {t('cancel', lang)}
                              </button>
                            </div>
                          </div>
                        </ModalPortal>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 items-center justify-end">
                    <div className="flex items-center gap-2 text-xs text-slate-300 bg-white/5 px-3 py-1 rounded-full">
                      <span>{t('journalWordsLabel', lang)}: {wordCount}</span>
                      <span className="opacity-50">|</span>
                      <span>{t('journalEmojiLabel', lang)}: {emojiCount}</span>
                    </div>
                    <button
                      onClick={handleInspire}
                      className="p-2 hover:bg-yellow-500/20 rounded-lg text-slate-300 hover:text-yellow-400 transition-colors"
                      title={t('journalInspire', lang)}
                    >
                      <Lightbulb size={18} />
                    </button>
                    <button
                      onClick={() => handleSave(false)}
                      className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"
                      title={t('save', lang)}
                    >
                      <Save size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(selectedEntry.id)}
                      className="p-2 hover:bg-red-500/20 rounded-lg text-slate-300 hover:text-red-400 transition-colors"
                      title={t('delete', lang)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                  <div className="sticky top-0 z-20 px-2 pb-1 pt-0.5 journal-toolbar-shell">
                    <div className="flex flex-wrap items-center gap-2 rounded-2xl p-2">
                      <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                        <button
                          onClick={() => applyCommand('bold')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.bold)}
                          title={t('journalToolbarBold', lang)}
                        >
                          <Bold size={16} />
                        </button>
                        <button
                          onClick={() => applyCommand('italic')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.italic)}
                          title={t('journalToolbarItalic', lang)}
                        >
                          <Italic size={16} />
                        </button>
                        <button
                          onClick={() => applyCommand('underline')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.underline)}
                          title={t('journalToolbarUnderline', lang)}
                        >
                          <Underline size={16} />
                        </button>
                        <button
                          onClick={() => applyCommand('strikeThrough')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.strike)}
                          title={t('journalToolbarStrike', lang)}
                        >
                          <Strikethrough size={16} />
                        </button>
                        <button
                          onClick={toggleInlineCode}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.code)}
                          title={t('journalToolbarInlineCode', lang)}
                        >
                          <Code size={16} />
                        </button>
                        <button
                          onClick={clearFormatting}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(false)}
                          title={t('journalToolbarClear', lang)}
                        >
                          <Eraser size={16} />
                        </button>
                      </div>
                      <div className="h-6 w-px bg-white/10"></div>
                      <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                        <button
                          onClick={() => applyCommand('insertUnorderedList')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.list)}
                          title={t('journalToolbarList', lang)}
                        >
                          <List size={16} />
                        </button>
                        <button
                          onClick={() => applyCommand('insertOrderedList')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.listOrdered)}
                          title={t('journalToolbarListOrdered', lang)}
                        >
                          <ListOrdered size={16} />
                        </button>
                        <button
                          onClick={toggleQuote}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.quote)}
                          title={t('journalToolbarQuote', lang)}
                        >
                          <Quote size={16} />
                        </button>
                        <button
                          onClick={toggleCodeBlock}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.codeBlock)}
                          title={t('journalToolbarCodeBlock', lang)}
                        >
                          <Code size={16} />
                        </button>
                      </div>
                      <div className="h-6 w-px bg-white/10"></div>
                      <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                        <button
                          onClick={() => applyAlign('justifyLeft')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.align === 'left')}
                          title={t('journalToolbarAlignLeft', lang)}
                        >
                          <AlignLeft size={16} />
                        </button>
                        <button
                          onClick={() => applyAlign('justifyCenter')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.align === 'center')}
                          title={t('journalToolbarAlignCenter', lang)}
                        >
                          <AlignCenter size={16} />
                        </button>
                        <button
                          onClick={() => applyAlign('justifyRight')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.align === 'right')}
                          title={t('journalToolbarAlignRight', lang)}
                        >
                          <AlignRight size={16} />
                        </button>
                        <button
                          onClick={() => applyAlign('justifyFull')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(formatState.align === 'justify')}
                          title={t('journalToolbarAlignJustify', lang)}
                        >
                          <AlignJustify size={16} />
                        </button>
                      </div>
                      <div className="h-6 w-px bg-white/10"></div>
                      <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                        <ColorPicker
                          value={textColor}
                          onChange={(color) => {
                            setTextColor(color);
                            applyCommand('foreColor', color);
                          }}
                          icon={<Palette size={16} />}
                          label={t('journalToolbarTextColor', lang)}
                          onOpen={saveSelection}
                          showInput
                          buttonClassName={toolbarButtonClass(false)}
                        />
                        <ColorPicker
                          value={highlightColor}
                          onChange={(color) => {
                            setHighlightColor(color);
                            applyCommand('hiliteColor', color);
                          }}
                          icon={<Highlighter size={16} />}
                          label={t('journalToolbarHighlight', lang)}
                          onOpen={saveSelection}
                          showInput
                          showClear
                          onClear={() => applyCommand('hiliteColor', 'transparent')}
                          clearLabel={t('journalToolbarHighlightClear', lang)}
                          buttonClassName={toolbarButtonClass(false)}
                        />
                      </div>
                      <div className="h-6 w-px bg-white/10"></div>
                      <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                        <button
                          onClick={() => applyBlockFormat('p')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(blockValue === 'p')}
                          title={t('journalToolbarHeadingNormal', lang)}
                        >
                          N
                        </button>
                        <button
                          onClick={() => applyBlockFormat('h1')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(blockValue === 'h1')}
                          title={t('journalToolbarHeading1', lang)}
                        >
                          <Heading1 size={16} />
                        </button>
                        <button
                          onClick={() => applyBlockFormat('h2')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(blockValue === 'h2')}
                          title={t('journalToolbarHeading2', lang)}
                        >
                          <Heading2 size={16} />
                        </button>
                        <button
                          onClick={() => applyBlockFormat('h3')}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(blockValue === 'h3')}
                          title={t('journalToolbarHeading3', lang)}
                        >
                          <Heading3 size={16} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={fontSizeValue}
                          onChange={(e) => applyCommand('fontSize', e.target.value)}
                          onMouseDown={handleToolbarMouseDown}
                          onFocus={saveSelection}
                          className="bg-slate-900/60 border border-white/10 rounded-lg text-xs text-white px-2 py-1.5"
                          title={t('journalToolbarFontSize', lang)}
                        >
                          {FONT_SIZE_OPTIONS.map((size) => (
                            <option key={size.id} value={size.value}>
                              {size.label}
                            </option>
                          ))}
                        </select>
                        <Type size={16} className="text-slate-400" />
                        <select
                          onChange={(e) => applyCommand('fontName', e.target.value)}
                          onMouseDown={handleToolbarMouseDown}
                          onFocus={saveSelection}
                          className="bg-slate-900/60 border border-white/10 rounded-lg text-xs text-white px-2 py-1.5"
                          defaultValue={FONT_OPTIONS[0].value}
                          title={t('journalToolbarFont', lang)}
                        >
                          {FONT_OPTIONS.map((font) => (
                            <option key={font.id} value={font.value}>
                              {font.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="h-6 w-px bg-white/10"></div>
                      <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
                        <button
                          onClick={handleOpenLink}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(false)}
                          title={t('journalToolbarLink', lang)}
                        >
                          <Link2 size={16} />
                        </button>
                        <button
                          onClick={handleOpenEmoji}
                          onMouseDown={handleToolbarMouseDown}
                          className={toolbarButtonClass(false)}
                          title={t('journalToolbarEmoji', lang)}
                        >
                          <SmilePlus size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div
                    ref={editorRef}
                    className="journal-editor bg-transparent text-base md:text-lg text-white/90 leading-relaxed mb-6"
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder={t('journalPlaceholder', lang)}
                    onInput={syncContentFromEditor}
                    onBlur={() => void handleSave(true)}
                    onKeyUp={handleEditorKeyUp}
                    onMouseDown={handleEditorMouseDown}
                    onMouseUp={handleEditorMouseUp}
                    onFocus={updateFormatState}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                  <span>{isDirty ? t('journalUnsavedLabel', lang) : t('journalSavedLabel', lang)}</span>
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-white/10">
                {selectedEntry.aiReflection ? (
                  <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 relative animate-fade-in group">
                    <Sparkles
                      className="absolute -top-3 -left-2 text-indigo-400 bg-slate-900 rounded-full p-1 border border-white/10"
                      size={24}
                    />
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
                        {t('aiReflection', lang)}
                      </p>
                      <button
                        onClick={handleReport}
                        className="p-1 hover:bg-rose-500/20 rounded text-rose-400 transition-colors"
                        title={t('reportTooltip', lang)}
                      >
                        <Flag size={12} />
                      </button>
                    </div>
                    <p className="text-sm text-slate-200 italic leading-relaxed">"{selectedEntry.aiReflection}"</p>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalysing || !plainContent.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-secondary rounded-full text-white text-sm font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-transform disabled:opacity-50 disabled:scale-100"
                    >
                      {isAnalysing ? (
                        <span className="animate-pulse">{t('analyzing', lang)}</span>
                      ) : (
                        <>
                          <Sparkles size={16} /> {t('reflectAi', lang)}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50">
              <BookOpen size={64} strokeWidth={1} />
              <p className="mt-4">{t('journalPlaceholder', lang)}</p>
            </div>
          )}
        </div>
      </div>

      {isEmojiOpen && (
        <EmojiPicker
          title={t('journalEmojiTitle', lang)}
          searchPlaceholder={t('emojiSearchPlaceholder', lang)}
          emptyLabel={t('emojiSearchEmpty', lang)}
          recentEmptyLabel={t('emojiPickerRecentEmpty', lang)}
          tabAllLabel={t('emojiPickerTabAll', lang)}
          tabRecentLabel={t('emojiPickerTabRecent', lang)}
          onSelect={handleEmojiSelect}
          onClose={() => setIsEmojiOpen(false)}
        />
      )}

      {isLinkOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
            <div className="w-full max-w-md bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">
                {t('journalInsertLinkTitle', lang)}
              </h3>
              <div className="space-y-3">
                <input
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder={t('journalInsertLinkLabel', lang)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                />
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder={t('journalInsertLinkUrl', lang)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button
                  onClick={() => setIsLinkOpen(false)}
                  className="px-4 py-2 text-sm text-slate-300 hover:text-white"
                >
                  {t('cancel', lang)}
                </button>
                <button
                  onClick={handleLinkInsert}
                  className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                >
                  {t('journalInsertAction', lang)}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default Journal;
