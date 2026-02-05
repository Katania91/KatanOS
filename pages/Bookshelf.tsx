import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Book } from '../types';
import { db } from '../services/db';
import { useTranslation } from '../services/useTranslation';
import { Search, Plus, Trash2, BookOpen, ShoppingCart, CheckCircle, Star, X, Loader, Library, Calendar, Upload, Target, BarChart3, Download, ArrowUpDown, ChevronDown, TrendingUp } from 'lucide-react';
import ModalPortal from '../components/ModalPortal';
import DatePicker from '../components/DatePicker';
import RequiredInput from '../components/RequiredInput';
import Select from '../components/Select';

interface BookshelfProps {
  user: User;
}

interface GoogleBook {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    imageLinks?: {
      thumbnail: string;
    };
    pageCount?: number;
    description?: string;
    categories?: string[];
  };
}

const Bookshelf: React.FC<BookshelfProps> = ({ user }) => {
  const { t } = useTranslation();
  const [books, setBooks] = useState<Book[]>([]);
  const [activeTab, setActiveTab] = useState<'tobuy' | 'toread' | 'read'>('toread');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GoogleBook[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isManualEntry, setIsManualEntry] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [searchType, setSearchType] = useState<'intitle' | 'inauthor'>('intitle');

  // Manual entry state
  const [manualTitle, setManualTitle] = useState('');
  const [manualTitleError, setManualTitleError] = useState(false);
  const [manualAuthor, setManualAuthor] = useState('');
  const [manualPages, setManualPages] = useState('');
  const [manualCover, setManualCover] = useState('');

  // Book detail editing state
  const [editingNotes, setEditingNotes] = useState('');
  const [editingStartedAt, setEditingStartedAt] = useState('');
  const [editingFinishedAt, setEditingFinishedAt] = useState('');

  // Drag & drop state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [draggingBook, setDraggingBook] = useState<Book | null>(null);
  const dragImageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lang = user.language || 'it';

  // 3D Tilt state
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);
  const [tiltStyle, setTiltStyle] = useState<{ rotateX: number; rotateY: number }>({ rotateX: 0, rotateY: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>, bookId: string) => {
    if (draggingId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateY = ((x - centerX) / centerX) * 15; // Max 15 degrees
    const rotateX = ((centerY - y) / centerY) * 10; // Max 10 degrees
    setTiltStyle({ rotateX, rotateY });
    setHoveredBookId(bookId);
  };

  const handleMouseLeave = () => {
    setHoveredBookId(null);
    setTiltStyle({ rotateX: 0, rotateY: 0 });
  };

  // Filters & Sorting state
  const [sortBy, setSortBy] = useState<'title' | 'addedAt' | 'rating' | 'pages'>('addedAt');
  const [filterRating, setFilterRating] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Reading Goal
  const readingGoalKey = `katanos.readingGoal.${user.id}`;
  const [readingGoal, setReadingGoal] = useState<number>(() => {
    const stored = localStorage.getItem(readingGoalKey);
    return stored ? parseInt(stored) : 0;
  });
  const [showGoalInput, setShowGoalInput] = useState(false);
  const [goalInputValue, setGoalInputValue] = useState('');

  // Save reading goal
  useEffect(() => {
    if (readingGoal > 0) {
      localStorage.setItem(readingGoalKey, readingGoal.toString());
    }
  }, [readingGoal, readingGoalKey]);

  // Stats with useMemo
  const stats = useMemo(() => {
    const readBooks = books.filter(b => b.status === 'read');
    const currentYear = new Date().getFullYear();
    const booksThisYear = readBooks.filter(b => {
      const finishedYear = b.finishedAt ? new Date(b.finishedAt).getFullYear() : null;
      return finishedYear === currentYear;
    });

    const totalPages = readBooks.reduce((sum, b) => sum + (b.pageCount || 0), 0);
    const ratedBooks = readBooks.filter(b => b.rating);
    const avgRating = ratedBooks.length > 0
      ? (ratedBooks.reduce((sum, b) => sum + (b.rating || 0), 0) / ratedBooks.length).toFixed(1)
      : '-';

    const booksWithDuration = readBooks.filter(b => b.startedAt && b.finishedAt);
    let avgDays = '-';
    if (booksWithDuration.length > 0) {
      const totalDays = booksWithDuration.reduce((sum, b) => {
        const start = new Date(b.startedAt!);
        const end = new Date(b.finishedAt!);
        return sum + Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      }, 0);
      avgDays = Math.round(totalDays / booksWithDuration.length).toString();
    }

    return {
      total: books.length,
      read: readBooks.length,
      toread: books.filter(b => b.status === 'toread').length,
      tobuy: books.filter(b => b.status === 'tobuy').length,
      booksThisYear: booksThisYear.length,
      totalPages,
      avgRating,
      avgDays
    };
  }, [books]);

  // Export CSV
  const exportCSV = () => {
    const headers = ['Title', 'Author', 'Status', 'Rating', 'Pages', 'Added', 'Started', 'Finished', 'Notes'];
    const rows = books.map(b => [
      `"${b.title.replace(/"/g, '""')}"`,
      `"${b.author.replace(/"/g, '""')}"`,
      b.status,
      b.rating || '',
      b.pageCount || '',
      b.addedAt?.split('T')[0] || '',
      b.startedAt?.split('T')[0] || '',
      b.finishedAt?.split('T')[0] || '',
      `"${(b.notes || '').replace(/"/g, '""')}"`
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookshelf_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        window.dispatchEvent(new CustomEvent('katanos:notify', {
          detail: {
            title: t('error', lang),
            message: t('fileTooLarge', lang),
            type: 'error',
          },
        }));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setManualCover(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    loadBooks();
  }, [user.id]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
          return; // Prioritize closing the top-most modal
        }
        if (selectedBook) setSelectedBook(null);
        if (isSearchOpen) setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [selectedBook, isSearchOpen, showDeleteConfirm]);

  const loadBooks = async () => {
    const userBooks = await db.books.list(user.id);
    setBooks(userBooks);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      let q = encodeURIComponent(searchQuery);
      if (searchType === 'intitle') {
        q = `intitle:${q} `;
      } else if (searchType === 'inauthor') {
        q = `inauthor:${q} `;
      }

      // Add printType=books to filter out magazines/etc.
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=20&printType=books&langRestrict=${lang}`);
      const data = await response.json();
      setSearchResults(data.items || []);
    } catch (error) {
      console.error("Error searching books:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddGoogleBook = async (googleBook: GoogleBook, status: 'tobuy' | 'toread' | 'read') => {
    const bookAuthor = googleBook.volumeInfo.authors ? googleBook.volumeInfo.authors.join(', ') : 'Unknown';

    // Check for duplicates
    const isDuplicate = books.some(b =>
      b.title.toLowerCase() === googleBook.volumeInfo.title.toLowerCase() &&
      b.author.toLowerCase() === bookAuthor.toLowerCase()
    );

    if (isDuplicate) {
      window.dispatchEvent(new CustomEvent('katanos:notify', {
        detail: {
          title: t('error', lang),
          message: t('bookExists', lang),
          type: 'error',
        },
      }));
      return;
    }

    const newBook: Omit<Book, 'id'> = {
      userId: user.id,
      title: googleBook.volumeInfo.title,
      author: bookAuthor,
      cover: googleBook.volumeInfo.imageLinks?.thumbnail?.replace('http:', 'https:'),
      status: status,
      addedAt: new Date().toISOString(),
      pageCount: googleBook.volumeInfo.pageCount,
      description: googleBook.volumeInfo.description,
      categories: googleBook.volumeInfo.categories,
    };

    await db.books.add(newBook);
    await loadBooks();
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);

    window.dispatchEvent(new CustomEvent('katanos:notify', {
      detail: {
        title: t('success', lang),
        message: t('bookAdded', lang),
        type: 'success',
      },
    }));
  };

  const handleAddManualBook = async (status: 'tobuy' | 'toread' | 'read') => {
    const isTitleMissing = !manualTitle.trim();
    setManualTitleError(isTitleMissing);
    if (isTitleMissing) return;

    // Check for duplicates
    const isDuplicate = books.some(b =>
      b.title.toLowerCase() === manualTitle.toLowerCase() &&
      b.author.toLowerCase() === manualAuthor.toLowerCase()
    );

    if (isDuplicate) {
      window.dispatchEvent(new CustomEvent('katanos:notify', {
        detail: {
          title: t('error', lang),
          message: t('bookExists', lang),
          type: 'error',
        },
      }));
      return;
    }

    const newBook: Omit<Book, 'id'> = {
      userId: user.id,
      title: manualTitle,
      author: manualAuthor,
      cover: manualCover || undefined,
      status: status,
      addedAt: new Date().toISOString(),
      pageCount: parseInt(manualPages) || undefined,
    };

    await db.books.add(newBook);
    await loadBooks();
    setIsSearchOpen(false);
    setManualTitle('');
    setManualTitleError(false);
    setManualAuthor('');
    setManualPages('');
    setManualCover('');

    window.dispatchEvent(new CustomEvent('katanos:notify', {
      detail: {
        title: t('success', lang),
        message: t('bookAdded', lang),
        type: 'success',
      },
    }));
  };

  const handleDeleteBook = async (id: string) => {
    await db.books.delete(id);
    await loadBooks();
    setSelectedBook(null);
    setShowDeleteConfirm(false);
  };

  const handleMoveBook = async (book: Book, newStatus: 'tobuy' | 'toread' | 'read') => {
    await db.books.update(book.id, { status: newStatus });
    await loadBooks();
    setSelectedBook(null);
  };

  const handleRateBook = async (book: Book, rating: number) => {
    await db.books.update(book.id, { rating });
    setSelectedBook(prev => prev ? { ...prev, rating } : null);
    await loadBooks();
  };

  // Update book notes
  const handleUpdateNotes = async (book: Book, notes: string) => {
    await db.books.update(book.id, { notes });
    setSelectedBook(prev => prev ? { ...prev, notes } : null);
    await loadBooks();
  };

  // Update reading dates
  const handleUpdateDates = async (book: Book, startedAt?: string, finishedAt?: string) => {
    const updates: Partial<Book> = {};
    if (startedAt !== undefined) updates.startedAt = startedAt || undefined;
    if (finishedAt !== undefined) updates.finishedAt = finishedAt || undefined;
    await db.books.update(book.id, updates);
    setSelectedBook(prev => prev ? { ...prev, ...updates } : null);
    await loadBooks();
  };

  // Calculate reading duration in days
  const getReadingDuration = (book: Book): number | null => {
    if (!book.startedAt || !book.finishedAt) return null;
    const start = new Date(book.startedAt);
    const end = new Date(book.finishedAt);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Drag & Drop handlers for reordering
  const handleDragStart = (e: React.DragEvent, book: Book) => {
    if (activeTab === 'read') return; // No reordering for "read" tab

    setDraggingId(book.id);
    setDraggingBook(book);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', book.id);

    // Create custom drag image with actual book cover
    if (dragImageRef.current) {
      e.dataTransfer.setDragImage(dragImageRef.current, 55, 82);
    }
  };

  const handleDragOver = (e: React.DragEvent, bookId: string) => {
    e.preventDefault();
    if (draggingId && draggingId !== bookId) {
      setDragOverId(bookId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
    setDraggingBook(null);
  };

  const handleDrop = async (e: React.DragEvent, targetBook: Book) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetBook.id) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    const sameStatusBooks = books
      .filter(b => b.status === activeTab)
      .sort((a, b) => (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity));

    const draggedBook = sameStatusBooks.find(b => b.id === draggingId);
    if (!draggedBook) return;

    const draggedIndex = sameStatusBooks.findIndex(b => b.id === draggingId);
    const targetIndex = sameStatusBooks.findIndex(b => b.id === targetBook.id);

    // Remove dragged book and insert at target position
    const reordered = [...sameStatusBooks];
    reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedBook);

    // Update sortOrder for all affected books
    const updates = reordered.map((book, index) => ({
      id: book.id,
      sortOrder: index
    }));

    // Batch update
    for (const update of updates) {
      await db.books.update(update.id, { sortOrder: update.sortOrder });
    }

    setDraggingId(null);
    setDragOverId(null);
    await loadBooks();
  };

  // Initialize editing state when selecting a book
  useEffect(() => {
    if (selectedBook) {
      setEditingNotes(selectedBook.notes || '');
      setEditingStartedAt(selectedBook.startedAt ? selectedBook.startedAt.split('T')[0] : '');
      setEditingFinishedAt(selectedBook.finishedAt ? selectedBook.finishedAt.split('T')[0] : '');
    }
  }, [selectedBook?.id]);

  const filteredBooks = books
    .filter(b => b.status === activeTab)
    .filter(b => filterRating === null || (b.rating || 0) >= filterRating)
    .sort((a, b) => {
      // First, respect manual sortOrder for drag & drop (only in tobuy/toread)
      if (activeTab !== 'read' && sortBy === 'addedAt') {
        return (a.sortOrder ?? Infinity) - (b.sortOrder ?? Infinity);
      }
      // Then apply selected sort
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'pages':
          return (b.pageCount || 0) - (a.pageCount || 0);
        case 'addedAt':
        default:
          return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
      }
    });

  return (
    <div className="h-full flex flex-col space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
            <Library className="text-amber-400" size={32} />
            {t('bookshelfTitle', lang)}
          </h1>
          <p className="text-slate-400 mt-1">{t('bookshelfSubtitle', lang)}</p>
        </div>
        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-indigo-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-primary/20"
        >
          <Plus size={18} />
          {t('addBook', lang)}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-900/50 rounded-xl border border-white/10 w-full md:w-fit">
        <button
          onClick={() => setActiveTab('tobuy')}
          className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'tobuy' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
        >
          <ShoppingCart size={16} />
          {t('toBuy', lang)}
          <span className="ml-2 bg-black/30 px-1.5 py-0.5 rounded-md text-[10px]">
            {books.filter(b => b.status === 'tobuy').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('toread')}
          className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'toread' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
        >
          <BookOpen size={16} />
          {t('toRead', lang)}
          <span className="ml-2 bg-black/30 px-1.5 py-0.5 rounded-md text-[10px]">
            {books.filter(b => b.status === 'toread').length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('read')}
          className={`flex-1 md:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'read' ? 'bg-white/10 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
        >
          <CheckCircle size={16} />
          {t('read', lang)}
          <span className="ml-2 bg-black/30 px-1.5 py-0.5 rounded-md text-[10px]">
            {books.filter(b => b.status === 'read').length}
          </span>
        </button>
      </div>

      {/* Stats Bar & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/5 rounded-2xl p-4 border border-white/5">
        {/* Left: Quick Stats */}
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} className="text-amber-400" />
            <span className="text-slate-400">{t('totalBooks', lang)}:</span>
            <span className="text-white font-bold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-slate-400">{t('booksThisYear', lang)}:</span>
            <span className="text-white font-bold">{stats.booksThisYear}</span>
          </div>
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-indigo-400" />
            <span className="text-slate-400">{t('pagesRead', lang)}:</span>
            <span className="text-white font-bold">{stats.totalPages.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Star size={14} className="text-yellow-400" />
            <span className="text-slate-400">{t('avgRating', lang)}:</span>
            <span className="text-white font-bold">{stats.avgRating}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-cyan-400" />
            <span className="text-slate-400">{t('avgReadingTime', lang)}:</span>
            <span className="text-white font-bold">{stats.avgDays} {t('daysToRead', lang)}</span>
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-primary text-white' : 'bg-white/10 text-slate-300 hover:text-white'}`}
            title="Filters"
          >
            <ArrowUpDown size={16} />
          </button>
          <button
            onClick={exportCSV}
            className="p-2 rounded-lg bg-white/10 text-slate-300 hover:text-white transition-colors"
            title={t('exportCsvBooks', lang)}
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Reading Goal */}
      {readingGoal > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl p-4 border border-amber-500/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-amber-400" />
              <span className="text-sm font-bold text-white">{t('readingGoal', lang)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                {stats.booksThisYear} {t('booksOfGoal', lang)} {readingGoal}
              </span>
              <button
                onClick={() => {
                  setReadingGoal(0);
                  localStorage.removeItem(readingGoalKey);
                }}
                className="text-slate-500 hover:text-red-400 transition-colors"
                title="Reset goal"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="h-2 bg-black/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${stats.booksThisYear >= readingGoal ? 'bg-gradient-to-r from-emerald-400 to-green-400' : 'bg-gradient-to-r from-amber-400 to-orange-400'}`}
              style={{ width: `${Math.min(100, (stats.booksThisYear / readingGoal) * 100)}%` }}
            />
          </div>
          {stats.booksThisYear >= readingGoal && (
            <p className="text-xs text-emerald-400 mt-2 font-bold text-center animate-pulse">🎉 {t('goalReached', lang)}</p>
          )}
        </div>
      )}

      {/* Goal Input (if no goal set) */}
      {readingGoal === 0 && (
        <div className="bg-white/5 rounded-xl p-3 border border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-slate-400" />
            <span className="text-sm text-slate-400">{t('readingGoalDesc', lang)}</span>
          </div>
          {showGoalInput ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={goalInputValue}
                onChange={(e) => setGoalInputValue(e.target.value)}
                placeholder="12"
                className="w-16 bg-slate-900/50 border border-white/10 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-primary text-center"
                min="1"
                max="100"
              />
              <button
                onClick={() => {
                  const goal = parseInt(goalInputValue);
                  if (goal > 0) {
                    setReadingGoal(goal);
                    setShowGoalInput(false);
                  }
                }}
                className="px-3 py-1 rounded-lg bg-primary text-white text-xs font-bold"
              >
                OK
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowGoalInput(true)}
              className="px-3 py-1 rounded-lg bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-colors"
            >
              {t('setGoal', lang)}
            </button>
          )}
        </div>
      )}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white/5 rounded-xl p-4 border border-white/5 flex flex-wrap gap-4 animate-fade-in">
          {/* Sort By */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t('sortBy', lang)}:</span>
            <Select
              value={sortBy}
              onChange={(val) => setSortBy(val as 'title' | 'addedAt' | 'rating' | 'pages')}
              options={[
                { value: 'addedAt', label: t('sortDateAdded', lang) },
                { value: 'title', label: t('sortTitle', lang) },
                { value: 'rating', label: t('sortRating', lang) },
                { value: 'pages', label: t('sortPages', lang) },
              ]}
              className="min-w-[140px]"
            />
          </div>

          {/* Filter by Rating */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{t('filterByRating', lang)}:</span>
            <div className="flex gap-1">
              {[null, 1, 2, 3, 4, 5].map((r) => (
                <button
                  key={r ?? 'all'}
                  onClick={() => setFilterRating(r)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors flex items-center justify-center ${filterRating === r ? 'bg-primary text-white' : 'bg-white/10 text-slate-400 hover:text-white'}`}
                >
                  {r === null ? '★' : `${r}+`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bookshelf Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {filteredBooks.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-white/5 rounded-3xl">
            <Library size={48} className="mb-4 opacity-50" />
            <p>{t('noBooks', lang)}</p>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4 p-4">
            {filteredBooks.map((book) => {
              const isDragging = draggingId === book.id;
              const isDragOver = dragOverId === book.id;
              const canDrag = activeTab !== 'read';

              return (
                <div
                  key={book.id}
                  draggable={canDrag}
                  onDragStart={(e) => handleDragStart(e, book)}
                  onDragOver={(e) => handleDragOver(e, book.id)}
                  onDragLeave={handleDragLeave}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => handleDrop(e, book)}
                  onClick={() => !isDragging && setSelectedBook(book)}
                  onMouseMove={(e) => handleMouseMove(e, book.id)}
                  onMouseLeave={handleMouseLeave}
                  className={`group relative transition-all duration-200 ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                    } ${isDragging ? 'opacity-40 scale-95' : ''} ${isDragOver ? 'scale-105' : ''}`}
                  style={{ perspective: '800px' }}
                >
                  {/* Drop indicator */}
                  {isDragOver && (
                    <div className="absolute -left-2 top-0 bottom-0 w-1 bg-primary rounded-full animate-pulse z-20" />
                  )}

                  {/* Book with 3D Tilt */}
                  <div
                    className={`relative aspect-[2/3] rounded-lg bg-slate-800 border ${isDragOver ? 'border-primary' : 'border-white/10'} overflow-hidden`}
                    style={{
                      transformStyle: 'preserve-3d',
                      willChange: hoveredBookId === book.id ? 'transform, box-shadow' : 'auto',
                      transition: hoveredBookId === book.id ? 'none' : 'transform 0.3s ease-out, box-shadow 0.3s ease-out',
                      transform: hoveredBookId === book.id && !isDragging
                        ? `rotateX(${tiltStyle.rotateX}deg) rotateY(${tiltStyle.rotateY}deg) translateZ(20px) scale(1.05)`
                        : 'rotateX(0deg) rotateY(0deg) translateZ(0px) scale(1)',
                      boxShadow: hoveredBookId === book.id && !isDragging
                        ? `${-tiltStyle.rotateY * 2}px ${tiltStyle.rotateX * 2}px 30px rgba(0,0,0,0.4), 0 0 60px rgba(99, 102, 241, 0.15)`
                        : '0 10px 30px rgba(0,0,0,0.3)'
                    }}
                  >
                    {book.cover ? (
                      <img
                        src={book.cover}
                        alt={book.title}
                        className="w-full h-full object-cover pointer-events-none"
                        onError={(e) => {
                          // Fallback if image fails to load
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const fallback = parent.querySelector('.fallback-content');
                            if (fallback) fallback.classList.remove('hidden');
                            if (fallback) fallback.classList.add('flex');
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-slate-700 to-slate-800">
                        <span className="font-display font-bold text-white line-clamp-3">{book.title}</span>
                        <span className="text-xs text-slate-400 mt-2 line-clamp-2">{book.author}</span>
                      </div>
                    )}

                    {/* Fallback content for when image errors out (hidden by default, shown via CSS if needed or just rely on the else block above if we manage state, but here we use DOM manipulation for simplicity in onError) */}
                    <div className="hidden fallback-content w-full h-full absolute inset-0 flex-col items-center justify-center p-4 text-center bg-gradient-to-br from-slate-700 to-slate-800">
                      <span className="font-display font-bold text-white line-clamp-3">{book.title}</span>
                      <span className="text-xs text-slate-400 mt-2 line-clamp-2">{book.author}</span>
                    </div>

                    {/* Spine Effect */}

                    {/* Spine Effect */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-r from-white/20 to-transparent pointer-events-none"></div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent pointer-events-none"></div>

                    {/* Hover Shine Effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                    {/* Rating Badge */}
                    {book.rating && (
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded flex items-center gap-1">
                        <Star size={10} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-[10px] font-bold text-white">{book.rating}</span>
                      </div>
                    )}
                  </div>

                  {/* Book Shadow */}
                  <div
                    className="absolute -bottom-2 left-2 right-2 h-3 bg-black/40 blur-md rounded-full transition-all duration-100"
                    style={{
                      opacity: hoveredBookId === book.id ? 0.7 : 0.3,
                      transform: hoveredBookId === book.id ? 'scale(1.05)' : 'scale(0.95)'
                    }}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Hidden drag image - shows actual book cover */}
        <div
          ref={dragImageRef}
          className="fixed -left-[9999px] w-[110px] h-[165px] bg-slate-700 rounded-lg shadow-2xl border-2 border-primary overflow-hidden opacity-80"
        >
          {draggingBook?.cover ? (
            <img src={draggingBook.cover} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-gradient-to-br from-slate-700 to-slate-800">
              <span className="font-display font-bold text-white text-xs line-clamp-3">{draggingBook?.title}</span>
              <span className="text-[10px] text-slate-400 mt-1 line-clamp-2">{draggingBook?.author}</span>
            </div>
          )}
        </div>

        {/* Shelf Visuals */}
        <div className="mt-8 border-t-8 border-[#3e2c20] opacity-30 rounded-full"></div>
      </div>

      {/* Search/Add Modal */}
      {isSearchOpen && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
            <div className="glass-panel p-6 rounded-3xl w-full max-w-2xl shadow-2xl animate-scale-in max-h-[90vh] flex flex-col relative">
              <button
                onClick={() => setIsSearchOpen(false)}
                className="absolute top-4 right-4 text-slate-300 hover:text-white"
              >
                <X size={20} />
              </button>

              <h2 className="text-xl font-bold text-white mb-6">{t('addBook', lang)}</h2>

              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => { setIsManualEntry(false); setManualTitleError(false); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${!isManualEntry ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  {t('searchOnline', lang)}
                </button>
                <button
                  onClick={() => { setIsManualEntry(true); setManualTitleError(false); }}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${isManualEntry ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                >
                  {t('manualEntry', lang)}
                </button>
              </div>

              {!isManualEntry ? (
                <>
                  <form onSubmit={handleSearch} className="relative mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('searchBook', lang)}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white outline-none focus:border-primary"
                      autoFocus
                    />
                    {isSearching && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Loader className="animate-spin text-primary" size={18} />
                      </div>
                    )}
                  </form>

                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setSearchType('intitle')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${searchType === 'intitle' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                    >
                      {t('searchByTitle', lang)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchType('inauthor')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${searchType === 'inauthor' ? 'bg-primary text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                        }`}
                    >
                      {t('searchByAuthor', lang)}
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                    {searchResults.length === 0 && !isSearching && searchQuery && (
                      <p className="text-center text-slate-500 py-8">{t('noResults', lang)}</p>
                    )}

                    {searchResults.map((book) => (
                      <div key={book.id} className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/20 transition-colors">
                        <div className="w-16 h-24 bg-slate-800 rounded-lg overflow-hidden flex-shrink-0">
                          {book.volumeInfo.imageLinks?.thumbnail ? (
                            <img src={book.volumeInfo.imageLinks.thumbnail.replace('http:', 'https:')} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-700">
                              <BookOpen size={20} className="text-slate-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white truncate">{book.volumeInfo.title}</h3>
                          <p className="text-sm text-slate-400 truncate">{book.volumeInfo.authors?.join(', ')}</p>
                          <p className="text-xs text-slate-500 mt-1">{book.volumeInfo.pageCount} {t('pages', lang)}</p>

                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => handleAddGoogleBook(book, 'tobuy')}
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                            >
                              {t('toBuy', lang)}
                            </button>
                            <button
                              onClick={() => handleAddGoogleBook(book, 'toread')}
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                            >
                              {t('toRead', lang)}
                            </button>
                            <button
                              onClick={() => handleAddGoogleBook(book, 'read')}
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                            >
                              {t('read', lang)}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <RequiredInput
                    value={manualTitle}
                    onChange={setManualTitle}
                    error={manualTitleError}
                    onErrorClear={() => setManualTitleError(false)}
                    label={t('bookTitle', lang)}
                    labelClassName="text-xs text-slate-300 uppercase font-bold mb-1"
                    inputClassName="w-full bg-slate-900/50 rounded-xl px-3 py-2 text-white outline-none focus:border-primary"
                  />
                  <div>
                    <label className="text-xs text-slate-300 uppercase font-bold block mb-1">{t('bookAuthor', lang)}</label>
                    <input
                      value={manualAuthor}
                      onChange={(e) => setManualAuthor(e.target.value)}
                      className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-primary"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-slate-300 uppercase font-bold block mb-1">{t('bookPages', lang)}</label>
                      <input
                        type="number"
                        value={manualPages}
                        onChange={(e) => setManualPages(e.target.value)}
                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 uppercase font-bold block mb-1">{t('bookCoverUrl', lang)}</label>
                      <div className="flex gap-2">
                        <input
                          value={manualCover}
                          onChange={(e) => setManualCover(e.target.value)}
                          placeholder="https://..."
                          className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white outline-none focus:border-primary"
                        />
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={handleFileUpload}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                          title="Upload image"
                        >
                          <Upload size={20} />
                        </button>
                      </div>
                      {manualCover && (
                        <div className="mt-2 w-20 h-28 rounded-lg overflow-hidden border border-white/10 bg-slate-800 relative group">
                          <img
                            src={manualCover}
                            alt="Preview"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <button
                            onClick={() => setManualCover('')}
                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                          >
                            <X size={16} className="text-white" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4">
                    <p className="text-xs text-slate-400 mb-2">{t('selectCategory', lang)}:</p>
                    <div className="grid grid-cols-3 gap-3">
                      <button
                        onClick={() => handleAddManualBook('tobuy')}
                        className="py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold disabled:opacity-50"
                      >
                        {t('toBuy', lang)}
                      </button>
                      <button
                        onClick={() => handleAddManualBook('toread')}
                        className="py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold disabled:opacity-50"
                      >
                        {t('toRead', lang)}
                      </button>
                      <button
                        onClick={() => handleAddManualBook('read')}
                        className="py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold disabled:opacity-50"
                      >
                        {t('read', lang)}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Book Details Modal */}
      {selectedBook && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
            <div className="glass-panel p-6 rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar relative">
              <button
                onClick={() => setSelectedBook(null)}
                className="absolute top-4 right-4 text-slate-300 hover:text-white z-10"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center mb-6">
                <div className="w-32 h-48 rounded-lg shadow-2xl overflow-hidden mb-4 border border-white/10">
                  {selectedBook.cover ? (
                    <img src={selectedBook.cover} alt={selectedBook.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <BookOpen size={32} className="text-slate-600" />
                    </div>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white text-center">{selectedBook.title}</h2>
                <p className="text-slate-400 text-center">{selectedBook.author}</p>
                {selectedBook.pageCount && (
                  <p className="text-xs text-slate-500 mt-1">{selectedBook.pageCount} {t('pages', lang)}</p>
                )}
              </div>

              <div className="space-y-6">
                {/* Rating */}
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRateBook(selectedBook, star)}
                      className={`p-1 transition-transform hover:scale-110 ${(selectedBook.rating || 0) >= star ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'
                        }`}
                    >
                      <Star size={24} className={(selectedBook.rating || 0) >= star ? 'fill-current' : ''} />
                    </button>
                  ))}
                </div>

                {/* Move Actions */}
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold mb-2 text-center">{t('moveBook', lang)}</p>
                  <div className="flex gap-2 justify-center">
                    {selectedBook.status !== 'tobuy' && (
                      <button
                        onClick={() => handleMoveBook(selectedBook, 'tobuy')}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-colors"
                      >
                        {t('toBuy', lang)}
                      </button>
                    )}
                    {selectedBook.status !== 'toread' && (
                      <button
                        onClick={() => handleMoveBook(selectedBook, 'toread')}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-colors"
                      >
                        {t('toRead', lang)}
                      </button>
                    )}
                    {selectedBook.status !== 'read' && (
                      <button
                        onClick={() => handleMoveBook(selectedBook, 'read')}
                        className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 transition-colors"
                      >
                        {t('read', lang)}
                      </button>
                    )}
                  </div>
                </div>

                {/* Reading Timeline */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400 uppercase font-bold">
                    <Calendar size={14} />
                    {t('readingDuration', lang)}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">{t('startedReading', lang)}</label>
                      <DatePicker
                        value={editingStartedAt}
                        onChange={(value) => {
                          setEditingStartedAt(value);
                          handleUpdateDates(selectedBook, value, undefined);
                        }}
                        lang={lang}
                        inputClassName="w-full bg-slate-900/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-primary"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 uppercase block mb-1">{t('finishedReading', lang)}</label>
                      <DatePicker
                        value={editingFinishedAt}
                        onChange={(value) => {
                          setEditingFinishedAt(value);
                          handleUpdateDates(selectedBook, undefined, value);
                        }}
                        lang={lang}
                        inputClassName="w-full bg-slate-900/50 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-white outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                  {getReadingDuration(selectedBook) !== null && (
                    <p className="text-center text-sm text-emerald-400 font-medium">
                      {getReadingDuration(selectedBook)} {t('daysToRead', lang)}
                    </p>
                  )}
                </div>

                {/* Personal Notes */}
                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                  <label className="text-xs text-slate-400 uppercase font-bold block mb-2">{t('personalNotes', lang)}</label>
                  <textarea
                    value={editingNotes}
                    onChange={(e) => setEditingNotes(e.target.value)}
                    onBlur={() => handleUpdateNotes(selectedBook, editingNotes)}
                    placeholder={t('notesPlaceholder', lang)}
                    rows={3}
                    className="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary resize-none"
                  />
                </div>

                {/* Description */}
                {selectedBook.description && (
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                    <p className="text-sm text-slate-300 leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                      {selectedBook.description.replace(/<[^>]*>/g, '')}
                    </p>
                  </div>
                )}

                {/* Delete */}
                <div className="pt-4 border-t border-white/10 flex justify-center">
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-bold"
                  >
                    <Trash2 size={16} />
                    {t('delete', lang)}
                  </button>
                </div>
              </div>

              {/* Delete Confirmation Overlay */}
              {showDeleteConfirm && (
                <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-fade-in" onClick={() => setShowDeleteConfirm(false)}>
                  <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl max-w-sm w-full animate-scale-in" onClick={e => e.stopPropagation()}>
                    <h3 className="text-xl font-bold text-white mb-2 text-center">{t('confirmDeleteBook', lang)}</h3>
                    <p className="text-slate-400 text-sm mb-6 text-center">{t('actionCannotBeUndone', lang)}</p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
                      >
                        {t('cancel', lang)}
                      </button>
                      <button
                        onClick={() => handleDeleteBook(selectedBook.id)}
                        className="px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors shadow-lg shadow-red-500/20"
                      >
                        {t('delete', lang)}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default Bookshelf;
