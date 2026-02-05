import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, CalendarEvent } from '../types';
import { db } from '../services/db';
import { searchPlaces, getWeather, getWeatherCodeDescription } from '../services/weather';
import { parseCalendarEvent } from '../services/gemini';
import { resolveSecretValue } from '../services/secrets';
import { useTranslation } from '../services/useTranslation';
import { DEFAULT_CALENDAR_CATEGORY_ID, getCalendarCategoriesForUser, resolveCalendarCategory } from '../services/calendarCategories';
import EmojiGlyph from '../components/EmojiGlyph';
import ModalPortal from '../components/ModalPortal';
import DateTimePicker from '../components/DateTimePicker';
import RequiredInput from '../components/RequiredInput';
import Select from '../components/Select';
import {
  Plus, X, ChevronLeft, ChevronRight, MapPin, Clock, AlignLeft, Trash2,
  Loader2, Filter, CheckCircle2, LayoutGrid, List, Columns, Maximize2,
  Sparkles, Repeat, GripVertical, Edit, Flag
} from 'lucide-react';

interface AgendaProps {
  user: User;
  initialEventId?: string | null;
}

type ViewType = 'month' | 'week' | 'day' | 'list';
type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly';


// --- Date Helpers ---
const getWeekStart = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
  return new Date(d.setDate(diff));
};

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear();
};

const isEventOnDay = (event: CalendarEvent, day: Date) => {
  const start = new Date(event.start);
  const end = new Date(event.end);
  const current = new Date(day);

  // Reset times for date comparison
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const c = new Date(current.getFullYear(), current.getMonth(), current.getDate());

  return c.getTime() >= s.getTime() && c.getTime() <= e.getTime();
};

const formatTime = (dateStr: string) => {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const Agenda: React.FC<AgendaProps> = ({ user, initialEventId }) => {
  const { t } = useTranslation();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [view, setView] = useState<ViewType>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weatherData, setWeatherData] = useState<Record<string, number>>({});

  // Modal & Selection
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => {
    const initialLang = user.language || 'it';
    const initial = getCalendarCategoriesForUser(user, initialLang).map((cat) => cat.id);
    return new Set(initial);
  });

  // AI & Form State
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [showAiInput, setShowAiInput] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    location: '',
    start: '',
    end: '',
    description: '',
    type: DEFAULT_CALENDAR_CATEGORY_ID,
    recurrence: 'none' as RecurrenceType
  });
  const [titleError, setTitleError] = useState(false);
  const [startError, setStartError] = useState(false);
  const [endError, setEndError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Location Search
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const searchTimeout = useRef<any>(null);

  const lang = user.language || 'it';
  const calendarCategories = useMemo(() => getCalendarCategoriesForUser(user, lang), [user, lang]);
  const calendarCategoryIds = useMemo(() => calendarCategories.map((cat) => cat.id), [calendarCategories]);
  const defaultCategoryId = useMemo(() => {
    return calendarCategories.find((cat) => cat.id !== DEFAULT_CALENDAR_CATEGORY_ID)?.id || DEFAULT_CALENDAR_CATEGORY_ID;
  }, [calendarCategories]);
  const calendarCategoryIdsRef = useRef<string[]>([]);

  useEffect(() => {
    setActiveFilters((prev) => {
      if (!calendarCategoryIds.length) return prev;
      if (prev.size === 0) {
        calendarCategoryIdsRef.current = calendarCategoryIds;
        return new Set(calendarCategoryIds);
      }
      const prevIds = calendarCategoryIdsRef.current;
      const prevHadAll = prevIds.length > 0 && prevIds.every((id) => prev.has(id));
      const next = new Set([...prev].filter((id) => calendarCategoryIds.includes(id)));
      if (prevHadAll) {
        calendarCategoryIds.forEach((id) => next.add(id));
      }
      calendarCategoryIdsRef.current = calendarCategoryIds;
      return next;
    });
  }, [calendarCategoryIds]);

  useEffect(() => {
    if (!calendarCategoryIds.length) return;
    if (!calendarCategoryIds.includes(formData.type)) {
      setFormData((prev) => ({ ...prev, type: defaultCategoryId }));
    }
  }, [calendarCategoryIds, defaultCategoryId, formData.type]);

  useEffect(() => {
    loadEvents();
    loadWeather();
  }, [user]);

  useEffect(() => {
    if (initialEventId && events.length > 0) {
      const event = events.find(e => e.id === initialEventId);
      if (event) {
        setSelectedEvent(event);
        setCurrentDate(new Date(event.start));
      }
    }
  }, [initialEventId, events]);

  const loadWeather = async () => {
    try {
      let lat = 41.9028;
      let lon = 12.4964;
      let cityName = undefined;

      const savedLoc = localStorage.getItem(`katanos_weather_loc_${user.id}`);
      if (savedLoc) {
        const loc = JSON.parse(savedLoc);
        lat = loc.lat;
        lon = loc.lon;
        cityName = loc.label || loc.name;
      }

      const data = await getWeather(lat, lon, cityName, lang);
      const map: Record<string, number> = {};
      data.daily.forEach(d => {
        const dateKey = new Date(d.date).toDateString();
        map[dateKey] = d.weatherCode;
      });
      setWeatherData(map);
    } catch (e) {
      console.error("Weather load failed", e);
    }
  };


  // Global Escape Handler
  useEffect(() => {
    const handleEscape = (event: Event) => {
      if (showModal) setShowModal(false);
      else if (selectedEvent) setSelectedEvent(null);
    };
    window.addEventListener('katanos:escape', handleEscape);
    return () => window.removeEventListener('katanos:escape', handleEscape);
  }, [showModal, selectedEvent]);

  // Location Search Debounce
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (formData.location.length < 3 || !showLocationSuggestions) {
      setLocationSuggestions([]);
      return;
    }
    setIsSearchingLocation(true);
    searchTimeout.current = setTimeout(async () => {
      const results = await searchPlaces(formData.location, lang);
      setLocationSuggestions(results);
      setIsSearchingLocation(false);
    }, 500);
    return () => clearTimeout(searchTimeout.current);
  }, [formData.location, showLocationSuggestions, lang]);

  const loadEvents = async () => {
    const data = await db.events.list(user.id);
    setEvents(data);
  };

  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(currentDate);
    if (direction === 'today') {
      const now = new Date();
      setCurrentDate(now);
      setSelectedDate(now);
      return;
    }

    const offset = direction === 'next' ? 1 : -1;

    switch (view) {
      case 'month':
        newDate.setMonth(newDate.getMonth() + offset);
        break;
      case 'week':
        newDate.setDate(newDate.getDate() + (offset * 7));
        break;
      case 'day':
        newDate.setDate(newDate.getDate() + offset);
        break;
      case 'list':
        newDate.setMonth(newDate.getMonth() + offset);
        break;
    }
    setCurrentDate(newDate);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isTitleMissing = !formData.title.trim();
    const isStartMissing = !formData.start;
    const isEndMissing = !formData.end;
    setTitleError(isTitleMissing);
    setStartError(isStartMissing);
    setEndError(isEndMissing);
    if (isTitleMissing || isStartMissing || isEndMissing) return;

    const category = resolveCalendarCategory(calendarCategories, formData.type);
    const baseEvent = {
      userId: user.id,
      title: formData.title,
      description: formData.description,
      location: formData.location,
      type: category?.id || DEFAULT_CALENDAR_CATEGORY_ID,
      color: category?.color || '#fff'
    };

    const eventsToCreate = [];
    const startDate = new Date(formData.start);
    const endDate = new Date(formData.end);
    const duration = endDate.getTime() - startDate.getTime();

    // Adjust for timezone for ISO string
    const toLocalISO = (d: Date) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };

    if (editingId) {
      // Update existing event
      await db.events.update(editingId, {
        ...baseEvent,
        start: toLocalISO(startDate),
        end: toLocalISO(endDate)
      });
    } else {
      // Create new event(s)
      let iterations = 1;
      if (formData.recurrence === 'daily') iterations = 7;
      if (formData.recurrence === 'weekly') iterations = 4;
      if (formData.recurrence === 'monthly') iterations = 6;

      const eventsToCreate = [];
      for (let i = 0; i < iterations; i++) {
        const s = new Date(startDate);
        const e = new Date(s.getTime() + duration);

        if (formData.recurrence === 'daily') s.setDate(s.getDate() + i);
        if (formData.recurrence === 'weekly') s.setDate(s.getDate() + (i * 7));
        if (formData.recurrence === 'monthly') s.setMonth(s.getMonth() + i);

        // Recalculate end time based on new start
        const newEnd = new Date(s.getTime() + duration);

        eventsToCreate.push({
          ...baseEvent,
          start: toLocalISO(s),
          end: toLocalISO(newEnd)
        });
      }

      for (const ev of eventsToCreate) {
        await db.events.add(ev);
      }
    }

    setTitleError(false);
    setStartError(false);
    setEndError(false);
    setShowModal(false);
    setEditingId(null);
    loadEvents();
  };

  const handleAiCreate = async () => {
    if (!aiPrompt.trim()) return;
    const apiKey = await resolveSecretValue(user.apiKey);
    if (!apiKey) return;
    setIsAiGenerating(true);
    const result = await parseCalendarEvent(apiKey, lang, aiPrompt);
    setIsAiGenerating(false);

    if (result) {
      setFormData({
        title: result.title || '',
        location: result.location || '',
        description: result.description || '',
        type: result.type && calendarCategories.some(c => c.id === result.type) ? result.type : defaultCategoryId,
        start: result.start || '',
        end: result.end || '',
        recurrence: 'none'
      });
      setTitleError(false);
      setStartError(false);
      setEndError(false);
      setShowAiInput(false);
      setAiPrompt('');
      setShowModal(true);
    }
  };

  const handleReport = () => {
    const subject = encodeURIComponent(t('reportAiSubject', lang));
    const body = encodeURIComponent(t('reportAiBody', lang).replace('{content}', aiPrompt).replace('{userId}', user?.id || 'unknown'));
    const mailto = `mailto:kevin@katania.me?subject=${subject}&body=${body}`;
    if (window.katanos?.openExternal) {
      window.katanos.openExternal(mailto);
    } else {
      window.open(mailto);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date, targetHour?: number) => {
    e.preventDefault();
    const eventId = e.dataTransfer.getData("text/plain");
    const event = events.find(ev => ev.id === eventId);
    if (!event) return;

    const oldStart = new Date(event.start);
    const oldEnd = new Date(event.end);
    const duration = oldEnd.getTime() - oldStart.getTime();

    const newStart = new Date(targetDate);
    if (targetHour !== undefined) {
      newStart.setHours(targetHour);
      newStart.setMinutes(oldStart.getMinutes()); // Keep original minutes
    } else {
      // Month view drop - keep original time
      newStart.setHours(oldStart.getHours());
      newStart.setMinutes(oldStart.getMinutes());
    }

    const newEnd = new Date(newStart.getTime() + duration);

    // Adjust for timezone
    const toLocalISO = (d: Date) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };

    await db.events.update(eventId, {
      start: toLocalISO(newStart),
      end: toLocalISO(newEnd)
    });
    loadEvents();
  };

  const handleEdit = (event: CalendarEvent) => {
    setEditingId(event.id);

    // Adjust for timezone for date-time input
    const toLocalISO = (d: Date) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };

    setFormData({
      title: event.title,
      location: event.location || '',
      description: event.description || '',
      type: calendarCategories.some((cat) => cat.id === event.type) ? event.type : DEFAULT_CALENDAR_CATEGORY_ID,
      start: toLocalISO(new Date(event.start)),
      end: toLocalISO(new Date(event.end)),
      recurrence: 'none' // Editing recurrence is complex, disable for single edit
    });
    setTitleError(false);
    setStartError(false);
    setEndError(false);

    setSelectedEvent(null);
    setShowModal(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      await db.events.delete(deleteId);
      setSelectedEvent(null);
      setDeleteId(null);
      loadEvents();
    }
  };

  const openNewEventModal = (startDate?: Date) => {
    setEditingId(null);
    const start = startDate || new Date();
    start.setSeconds(0, 0);
    // Round to nearest 30 min
    const minutes = start.getMinutes();
    const remainder = minutes % 30;
    start.setMinutes(minutes - remainder + (remainder >= 15 ? 30 : 0));

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    // Adjust for timezone for date-time input
    const toLocalISO = (d: Date) => {
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    };

    setFormData({
      title: '',
      location: '',
      description: '',
      type: defaultCategoryId,
      start: toLocalISO(start),
      end: toLocalISO(end),
      recurrence: 'none'
    });
    setTitleError(false);
    setStartError(false);
    setEndError(false);
    setShowModal(true);
  };

  const getEventCategory = (event: CalendarEvent) => {
    return resolveCalendarCategory(calendarCategories, event.type);
  };

  const getEventCategoryId = (event: CalendarEvent) => {
    return getEventCategory(event)?.id || DEFAULT_CALENDAR_CATEGORY_ID;
  };

  const getEventCategoryColor = (event: CalendarEvent) => {
    return getEventCategory(event)?.color || event.color || '#475569';
  };

  const getEventCategoryLabel = (event: CalendarEvent) => {
    return getEventCategory(event)?.name || event.type;
  };

  const getEventCategoryEmoji = (event: CalendarEvent) => {
    return getEventCategory(event)?.emoji;
  };

  // --- Renderers ---

  const renderSidebar = () => (
    <div className="w-full lg:w-72 shrink-0 flex flex-col gap-6 min-h-0">
      {/* Create Button */}
      <div className="flex flex-col gap-3">
        <button
          onClick={() => openNewEventModal()}
          className="w-full bg-primary hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-primary/20 transition-all active:scale-95 group"
        >
          <div className="bg-white/20 p-1 rounded-lg group-hover:rotate-90 transition-transform">
            <Plus size={20} />
          </div>
          <span>{t('newEvent', lang)}</span>
        </button>

        {/* AI Create Button */}
        {user.apiKey && (
          <div className="relative">
            {!showAiInput ? (
              <button
                onClick={() => setShowAiInput(true)}
                className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:brightness-110 text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95"
              >
                <Sparkles size={18} />
                <span>{t('aiCreateEvent', lang)}</span>
              </button>
            ) : (
              <div className="bg-slate-800 p-3 rounded-2xl border border-white/10 animate-fade-in">
                <textarea
                  autoFocus
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={t('aiCreatePlaceholder', lang)}
                  className="w-full bg-transparent text-sm text-white placeholder-slate-500 outline-none resize-none h-16 mb-2"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAiCreate();
                    }
                  }}
                />
                <div className="flex justify-between items-center">
                  <button
                    onClick={handleReport}
                    className="p-1.5 hover:bg-rose-500/20 rounded text-rose-400 transition-colors flex items-center gap-1"
                    title={t('reportTooltip', lang)}
                  >
                    <Flag size={12} />
                  </button>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAiInput(false)} className="p-1 hover:bg-white/10 rounded text-slate-300"><X size={16} /></button>
                    <button onClick={handleAiCreate} disabled={isAiGenerating} className="p-1 bg-primary rounded text-white disabled:opacity-50">
                      {isAiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mini Calendar */}
      <div className="glass-panel p-6 rounded-3xl">
        <div className="flex items-center justify-between mb-4">
          <span className="font-bold text-white capitalize">
            {currentDate.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })}
          </span>
          <div className="flex gap-1">
            <button onClick={() => handleNavigate('prev')} className="p-1 hover:bg-white/10 rounded"><ChevronLeft size={16} /></button>
            <button onClick={() => handleNavigate('next')} className="p-1 hover:bg-white/10 rounded"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-xs mb-2 text-slate-300 font-bold">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {Array.from({ length: 35 }).map((_, i) => {
            const d = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const startDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
            const dayNum = i - startDay + 1;
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayNum);
            const isCurrentMonth = date.getMonth() === currentDate.getMonth();
            const isSelected = isSameDay(date, selectedDate);
            const isToday = isSameDay(date, new Date());
            const hasEvents = events.some(e => isEventOnDay(e, date));

            return (
              <button
                key={i}
                onClick={() => { setSelectedDate(date); setCurrentDate(date); }}
                className={`
                  h-8 w-8 rounded-full flex items-center justify-center relative transition-all
                  ${!isCurrentMonth ? 'text-slate-500' : 'text-slate-300'}
                  ${isSelected ? 'bg-primary text-white font-bold shadow-lg shadow-primary/30' : 'hover:bg-white/10'}
                  ${isToday && !isSelected ? 'border border-primary text-primary' : ''}
                `}
              >
                {date.getDate()}
                {hasEvents && !isSelected && <div className="absolute bottom-1 w-1 h-1 bg-indigo-400 rounded-full"></div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel p-5 rounded-3xl flex-1 min-h-0 flex flex-col">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Filter size={12} /> {t('filters', lang)}
        </h3>
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          {calendarCategories.map(cat => {
            const isActive = activeFilters.has(cat.id);
            return (
              <button
                key={cat.id}
                onClick={() => {
                  const next = new Set(activeFilters);
                  if (next.has(cat.id)) next.delete(cat.id);
                  else next.add(cat.id);
                  setActiveFilters(next);
                }}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${isActive ? 'bg-white/5 border-white/10' : 'border-transparent opacity-50 hover:opacity-100'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-8 rounded-full" style={{ backgroundColor: cat.color }}></div>
                  <span className="flex items-center gap-2 text-sm font-medium text-white">
                    {cat.emoji && <EmojiGlyph emoji={cat.emoji} size={18} />}
                    {cat.name}
                  </span>
                </div>
                {isActive && <CheckCircle2 size={16} className="text-white/50" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  );

  const renderMonthView = () => {
    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
    const startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

    const days = [];
    for (let i = 0; i < startDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div className="h-full overflow-auto custom-scrollbar">
        <div className="grid grid-cols-7 grid-rows-6 bg-black/10 min-h-[600px] h-full">
          {days.map((day, idx) => {
            if (!day) return <div key={idx} className="bg-black/10 border-r border-b border-white/5"></div>;

            const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
            const dayEvents = events
              .filter(e => isEventOnDay(e, date) && activeFilters.has(getEventCategoryId(e)))
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

            const isToday = isSameDay(date, new Date());
            const isSelected = isSameDay(date, selectedDate);
            const weatherCode = weatherData[date.toDateString()];
            const weatherInfo = weatherCode !== undefined ? getWeatherCodeDescription(weatherCode, lang) : null;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(date)}
                onDoubleClick={() => openNewEventModal(date)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, date)}
                className={`
                  relative border-r border-b border-white/5 p-2 transition-all cursor-pointer group flex flex-col gap-1 min-h-[100px]
                  ${isSelected ? 'bg-white/5' : 'hover:bg-white/[0.02]'}
                `}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={`
                    text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full transition-colors
                    ${isToday ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'text-slate-300 group-hover:text-white'}
                  `}>
                    {day}
                  </span>
                  {weatherInfo && (
                    <span className="text-lg opacity-70" title={weatherInfo.label}>{weatherInfo.icon}</span>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-1 overflow-hidden">
                  {dayEvents.slice(0, 4).map(ev => {
                    const categoryColor = getEventCategoryColor(ev);
                    return (
                      <div
                        key={ev.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", ev.id)}
                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                        className="text-[10px] px-2 py-1 rounded-md truncate font-medium text-white shadow-sm border-l-2 hover:brightness-110 transition-all cursor-pointer active:cursor-grabbing"
                        style={{ backgroundColor: `${categoryColor}15`, borderLeftColor: categoryColor }}
                      >
                        {ev.title}
                      </div>
                    )
                  })}
                  {dayEvents.length > 4 && (
                    <div className="text-[10px] text-slate-500 px-1 font-medium">
                      + {dayEvents.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = getWeekStart(currentDate);
    const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
    const hours = Array.from({ length: 24 }).map((_, i) => i);

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {/* Header */}
          <div className="grid grid-cols-8 border-b border-white/5 bg-[var(--app-overlay)] backdrop-blur shrink-0 sticky top-0 z-30">
            <div className="p-4 border-r border-white/5"></div>
            {weekDays.map((d, i) => {
              const isToday = isSameDay(d, new Date());
              return (
                <div key={i} className={`p-3 text-center border-r border-white/5 ${isToday ? 'bg-white/5' : ''}`}>
                  <div className={`text-xs font-bold uppercase mb-1 ${isToday ? 'text-primary' : 'text-slate-300'}`}>
                    {d.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', { weekday: 'short' })}
                  </div>
                  <div className={`text-xl font-display font-bold ${isToday ? 'text-white' : 'text-slate-300'}`}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-8 relative min-h-[1440px]"> {/* 60px per hour */}
            {/* Time Column */}
            <div className="border-r border-white/5 bg-black/10">
              {hours.map(h => (
                <div key={h} className="h-[60px] border-b border-white/5 text-xs text-slate-300 p-2 text-right font-mono">
                  {h}:00
                </div>
              ))}
            </div>

            {/* Days Columns */}
            {weekDays.map((day, dayIdx) => {
              const dayEvents = events.filter(e => isEventOnDay(e, day) && activeFilters.has(getEventCategoryId(e)));
              const weatherCode = weatherData[day.toDateString()];
              const weatherInfo = weatherCode !== undefined ? getWeatherCodeDescription(weatherCode, lang) : null;

              return (
                <div key={dayIdx} className="relative border-r border-white/5 bg-black/5 group hover:bg-white/[0.02] transition-colors">
                  {/* Weather Header in Week View */}
                  <div className="absolute top-0 left-0 right-0 h-8 flex justify-center items-center pointer-events-none opacity-50">
                    {weatherInfo && <span title={weatherInfo.label}>{weatherInfo.icon}</span>}
                  </div>

                  {/* Hour Lines */}
                  {hours.map(h => (
                    <div
                      key={h}
                      className="h-[60px] border-b border-white/5"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleDrop(e, day, h)}
                      onDoubleClick={() => {
                        const newDate = new Date(day);
                        newDate.setHours(h);
                        openNewEventModal(newDate);
                      }}
                    ></div>
                  ))}

                  {/* Events */}
                  {dayEvents.map(ev => {
                    const evStart = new Date(ev.start);
                    const evEnd = new Date(ev.end);
                    const categoryColor = getEventCategoryColor(ev);

                    // Calculate start/end for this specific day column
                    const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);

                    const effectiveStart = evStart < dayStart ? dayStart : evStart;
                    const effectiveEnd = evEnd > dayEnd ? dayEnd : evEnd;

                    const startMinutes = effectiveStart.getHours() * 60 + effectiveStart.getMinutes();
                    const duration = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);

                    return (
                      <div
                        key={ev.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", ev.id)}
                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                        className="absolute left-1 right-1 rounded-lg p-2 text-xs border-l-4 shadow-lg cursor-pointer hover:brightness-110 hover:z-10 transition-all overflow-hidden active:cursor-grabbing"
                        style={{
                          top: `${startMinutes}px`,
                          height: `${Math.max(duration, 30)}px`, // Min height 30px
                          backgroundColor: `${categoryColor}30`,
                          borderLeftColor: categoryColor,
                          color: 'white'
                        }}
                      >
                        <div className="font-bold truncate flex items-center gap-1">
                          {ev.title}
                        </div>
                        <div className="text-[10px] opacity-80 truncate">
                          {evStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {evEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}

                  {/* Current Time Indicator */}
                  {isSameDay(day, new Date()) && (
                    <div
                      className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                      style={{ top: `${new Date().getHours() * 60 + new Date().getMinutes()}px` }}
                    >
                      <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }).map((_, i) => i);
    const day = currentDate;
    const weatherCode = weatherData[day.toDateString()];
    const weatherInfo = weatherCode !== undefined ? getWeatherCodeDescription(weatherCode, lang) : null;

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {/* Header */}
          <div className="grid grid-cols-[60px_1fr] border-b border-white/5 bg-[var(--app-overlay)] backdrop-blur shrink-0 sticky top-0 z-30">
            <div className="p-4 border-r border-white/5"></div>
            <div className="p-3 text-center border-r border-white/5 bg-white/5 flex items-center justify-center gap-4">
              <div>
                <div className="text-xs font-bold uppercase mb-1 text-primary">
                  {day.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', { weekday: 'long' })}
                </div>
                <div className="text-xl font-display font-bold text-white">
                  {day.getDate()} {day.toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-US', { month: 'long' })}
                </div>
              </div>
              {weatherInfo && (
                <div className="text-4xl" title={weatherInfo.label}>{weatherInfo.icon}</div>
              )}
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-[60px_1fr] relative min-h-[1440px]">
            {/* Time Column */}
            <div className="border-r border-white/5 bg-black/10">
              {hours.map(h => (
                <div key={h} className="h-[60px] border-b border-white/5 text-xs text-slate-300 p-2 text-right font-mono">
                  {h}:00
                </div>
              ))}
            </div>

            {/* Day Column */}
            <div className="relative border-r border-white/5 bg-black/5 group hover:bg-white/[0.02] transition-colors">
              {/* Hour Lines */}
              {hours.map(h => (
                <div
                  key={h}
                  className="h-[60px] border-b border-white/5"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, day, h)}
                  onDoubleClick={() => {
                    const newDate = new Date(day);
                    newDate.setHours(h);
                    openNewEventModal(newDate);
                  }}
                ></div>
              ))}

              {/* Events */}
              {events.filter(e => isEventOnDay(e, day) && activeFilters.has(getEventCategoryId(e))).map(ev => {
                const evStart = new Date(ev.start);
                const evEnd = new Date(ev.end);
                const categoryColor = getEventCategoryColor(ev);

                const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);

                const effectiveStart = evStart < dayStart ? dayStart : evStart;
                const effectiveEnd = evEnd > dayEnd ? dayEnd : evEnd;

                const startMinutes = effectiveStart.getHours() * 60 + effectiveStart.getMinutes();
                const duration = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60);

                return (
                  <div
                    key={ev.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", ev.id)}
                    onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); }}
                    className="absolute left-2 right-2 rounded-lg p-3 text-sm border-l-4 shadow-lg cursor-pointer hover:brightness-110 hover:z-10 transition-all overflow-hidden active:cursor-grabbing"
                    style={{
                      top: `${startMinutes}px`,
                      height: `${Math.max(duration, 30)}px`,
                      backgroundColor: `${categoryColor}30`,
                      borderLeftColor: categoryColor,
                      color: 'white'
                    }}
                  >
                    <div className="font-bold truncate flex items-center gap-2">
                      <GripVertical size={14} className="opacity-50" />
                      {ev.title}
                    </div>
                    <div className="text-xs opacity-80 truncate pl-5">
                      {evStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {evEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {ev.description && <div className="text-xs opacity-60 mt-1 line-clamp-1 pl-5">{ev.description}</div>}
                    {ev.location && <div className="text-xs opacity-60 mt-1 flex items-center gap-1 pl-5"><MapPin size={10} /> {ev.location}</div>}
                  </div>
                );
              })}

              {/* Current Time Indicator */}
              {isSameDay(day, new Date()) && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-red-500 z-20 pointer-events-none flex items-center"
                  style={{ top: `${new Date().getHours() * 60 + new Date().getMinutes()}px` }}
                >
                  <div className="w-2 h-2 bg-red-500 rounded-full -ml-1"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const sortedEvents = events
      .filter(e => activeFilters.has(getEventCategoryId(e)))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // Group by month
    const grouped: Record<string, CalendarEvent[]> = {};
    sortedEvents.forEach(ev => {
      const key = new Date(ev.start).toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(ev);
    });

    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
        {Object.entries(grouped).map(([month, monthEvents]) => (
          <div key={month} className="animate-fade-in">
            <h3 className="text-xl font-display font-bold text-slate-300 mb-4 sticky top-0 bg-[var(--app-overlay)] backdrop-blur py-2 z-10 capitalize">{month}</h3>
            <div className="space-y-3">
              {monthEvents.map(ev => {
                const categoryColor = getEventCategoryColor(ev);
                const categoryLabel = getEventCategoryLabel(ev);
                const categoryEmoji = getEventCategoryEmoji(ev);
                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className="flex items-center gap-4 p-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/5 cursor-pointer transition-all group"
                  >
                    <div className="flex flex-col items-center justify-center w-16 h-16 bg-slate-900 rounded-xl border border-white/10 shrink-0">
                      <span className="text-xs font-bold text-slate-300 uppercase">{new Date(ev.start).toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { weekday: 'short' })}</span>
                      <span className="text-xl font-bold text-white">{new Date(ev.start).getDate()}</span>
                    </div>

                    <div className="w-1 h-12 rounded-full" style={{ backgroundColor: categoryColor }}></div>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-lg text-white truncate group-hover:text-primary transition-colors">{ev.title}</h4>
                      <div className="flex items-center gap-3 text-sm text-slate-300">
                        <span className="flex items-center gap-1"><Clock size={14} /> {formatTime(ev.start)} - {formatTime(ev.end)}</span>
                        {ev.location && <span className="flex items-center gap-1 truncate"><MapPin size={14} /> {ev.location}</span>}
                      </div>
                    </div>

                    <div className="px-3 py-1 rounded-lg bg-white/5 text-xs font-medium text-slate-300 border border-white/5">
                      <span className="flex items-center gap-2">
                        {categoryEmoji && <EmojiGlyph emoji={categoryEmoji} size={16} />}
                        {categoryLabel}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {sortedEvents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-50">
            <List size={48} />
            <p className="mt-4">{t('noEvents', lang)}</p>
          </div>
        )}
      </div>
    );
  };

  const selectedCategory = resolveCalendarCategory(calendarCategories, formData.type);
  const selectedCategoryEmoji = selectedCategory?.emoji;

  return (
    <div className="min-h-0 lg:h-full lg:overflow-hidden flex flex-col lg:flex-row gap-6">
      {/* Sidebar */}
      {renderSidebar()}

      {/* Main Content */}
      <div className="flex-1 glass-panel rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-black/10">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-display font-bold capitalize text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
              {view === 'week'
                ? `${t('week', lang) || 'Week'} ${getWeekStart(currentDate).getDate()} - ${addDays(getWeekStart(currentDate), 6).getDate()}`
                : view === 'day'
                  ? currentDate.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
                  : currentDate.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { month: 'long', year: 'numeric' })
              }
            </h2>
            <div className="flex bg-black/20 rounded-xl p-1 border border-white/5">
              <button onClick={() => handleNavigate('prev')} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"><ChevronLeft size={20} /></button>
              <button onClick={() => handleNavigate('today')} className="px-3 py-1 hover:bg-white/10 rounded-lg text-xs font-bold text-indigo-300 uppercase tracking-wider transition-colors">{t('today', lang)}</button>
              <button onClick={() => handleNavigate('next')} className="p-2 hover:bg-white/10 rounded-lg text-slate-300 hover:text-white transition-colors"><ChevronRight size={20} /></button>
            </div>
          </div>

          <div className="flex bg-black/20 rounded-xl p-1 border border-white/5">
            {[
              { id: 'month', icon: LayoutGrid, label: t('month_view', lang) },
              { id: 'week', icon: Columns, label: t('week', lang) },
              { id: 'day', icon: Maximize2, label: t('day', lang) },
              { id: 'list', icon: List, label: t('list', lang) },
            ].map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id as ViewType)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                  ${view === v.id ? 'bg-primary text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/5'}
                `}
              >
                <v.icon size={16} />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* View Content */}
        <div className="flex-1 overflow-hidden relative bg-black/10">
          {view === 'month' && renderMonthView()}
          {view === 'week' && renderWeekView()}
          {view === 'day' && renderDayView()}
          {view === 'list' && renderListView()}
        </div>
      </div>

      {/* --- CREATE MODAL --- */}
      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fade-in">
            <div className="glass-panel p-8 rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar relative">
              <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-slate-300 hover:text-white"><X size={24} /></button>

              <h3 className="text-2xl font-display font-bold mb-6">{t('newEvent', lang)}</h3>

              <form onSubmit={handleSave} className="space-y-5">
                <RequiredInput
                  value={formData.title}
                  onChange={(value) => setFormData({ ...formData, title: value })}
                  error={titleError}
                  onErrorClear={() => setTitleError(false)}
                  label={t('title', lang)}
                  labelClassName="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2"
                  inputClassName="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all"
                  placeholder="Meeting..."
                  autoFocus
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      {t('startDate', lang)} <span className="text-red-400">*</span>
                    </label>
                    <DateTimePicker
                      value={formData.start}
                      onChange={(value) => {
                        setFormData({ ...formData, start: value });
                        if (startError && value) setStartError(false);
                      }}
                      lang={lang}
                      placeholder={t('startDate', lang)}
                      allowClear={false}
                      inputClassName={`w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 ${startError ? 'border-2 border-red-500' : 'border border-white/10'} rounded-xl px-3 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all text-sm`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                      {t('endDate', lang)} <span className="text-red-400">*</span>
                    </label>
                    <DateTimePicker
                      value={formData.end}
                      onChange={(value) => {
                        setFormData({ ...formData, end: value });
                        if (endError && value) setEndError(false);
                      }}
                      lang={lang}
                      placeholder={t('endDate', lang)}
                      allowClear={false}
                      inputClassName={`w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 ${endError ? 'border-2 border-red-500' : 'border border-white/10'} rounded-xl px-3 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all text-sm`}
                    />
                  </div>
                </div>

                <div className="relative">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">{t('location', lang)}</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={formData.location}
                      onChange={e => {
                        setFormData({ ...formData, location: e.target.value });
                        setShowLocationSuggestions(true);
                      }}
                      className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary transition-all"
                      placeholder="Roma, Italia"
                    />
                    <MapPin className="absolute left-3 top-3.5 text-slate-300" size={18} />
                    {isSearchingLocation && <Loader2 className="absolute right-3 top-3.5 text-indigo-400 animate-spin" size={18} />}
                  </div>
                  {showLocationSuggestions && locationSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden max-h-48 overflow-y-auto custom-scrollbar">
                      {locationSuggestions.map((place, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, location: place.display_name });
                            setShowLocationSuggestions(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-white/10 text-xs text-slate-300 hover:text-white border-b border-white/5 last:border-0 flex items-start gap-2 transition-colors"
                        >
                          <MapPin size={14} className="mt-0.5 shrink-0 text-indigo-400" />
                          <span className="leading-tight">{place.display_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">{t('category', lang)}</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Select
                        value={formData.type}
                        onChange={(val) => setFormData({ ...formData, type: val })}
                        options={calendarCategories.map((cat) => ({ value: cat.id, label: cat.name }))}
                      />
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: selectedCategory?.color || '#475569' }}
                        ></span>
                        {selectedCategoryEmoji && <EmojiGlyph emoji={selectedCategoryEmoji} size={16} />}
                        <span className="text-xs text-slate-300">{selectedCategory?.name || formData.type}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">{t('recurrence', lang)}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'none', label: t('rec_none', lang) },
                      { id: 'daily', label: t('rec_daily', lang) },
                      { id: 'weekly', label: t('rec_weekly', lang) },
                      { id: 'monthly', label: t('rec_monthly', lang) },
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, recurrence: opt.id as RecurrenceType })}
                        className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${formData.recurrence === opt.id ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-slate-300 hover:bg-white/5'}`}
                      >
                        <Repeat size={14} className={formData.recurrence === opt.id ? 'text-primary' : ''} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">{t('description', lang)}</label>
                  <textarea
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-slate-100 placeholder:text-slate-400 outline-none focus:border-primary h-24 resize-none transition-all"
                    placeholder="..."
                  />
                </div>

                <button type="submit" className="w-full bg-primary hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-95 mt-4">
                  {t('saveEvent', lang)}
                </button>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* --- DETAIL MODAL --- */}
      {selectedEvent && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
            <div className="glass-panel rounded-3xl w-full max-w-2xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row max-h-[90vh] animate-scale-in">
              <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 z-20 bg-black/20 p-2 rounded-full text-white hover:bg-white/20 backdrop-blur-sm transition-colors"><X size={20} /></button>

              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider text-white shadow-sm"
                    style={{ backgroundColor: getEventCategoryColor(selectedEvent) }}
                  >
                    <span className="flex items-center gap-2">
                      {getEventCategoryEmoji(selectedEvent) && (
                        <EmojiGlyph emoji={getEventCategoryEmoji(selectedEvent)} size={16} />
                      )}
                      {getEventCategoryLabel(selectedEvent)}
                    </span>
                  </div>
                </div>

                <h2 className="text-4xl font-display font-bold mb-8 leading-tight">{selectedEvent.title}</h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-4 group">
                    <div className="bg-white/5 p-3 rounded-xl text-indigo-400 group-hover:bg-indigo-500/20 transition-colors"><Clock size={20} /></div>
                    <div>
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">{t('time', lang)}</p>
                      {isSameDay(new Date(selectedEvent.start), new Date(selectedEvent.end)) ? (
                        <>
                          <p className="text-white font-medium text-lg">{new Date(selectedEvent.start).toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                          <p className="text-slate-300">{formatTime(selectedEvent.start)} - {formatTime(selectedEvent.end)}</p>
                        </>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <p className="text-white font-medium text-lg">
                            {new Date(selectedEvent.start).toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p className="text-slate-300 text-xs font-bold uppercase">{t('until', lang)}</p>
                          <p className="text-white font-medium text-lg">
                            {new Date(selectedEvent.end).toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedEvent.location && (
                    <div className="flex items-start gap-4 group">
                      <div className="bg-white/5 p-3 rounded-xl text-emerald-400 group-hover:bg-emerald-500/20 transition-colors"><MapPin size={20} /></div>
                      <div>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">{t('location', lang)}</p>
                        <p className="text-white font-medium">{selectedEvent.location}</p>
                      </div>
                    </div>
                  )}

                  {selectedEvent.description && (
                    <div className="flex items-start gap-4 group">
                      <div className="bg-white/5 p-3 rounded-xl text-pink-400 group-hover:bg-pink-500/20 transition-colors"><AlignLeft size={20} /></div>
                      <div>
                        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">{t('description', lang)}</p>
                        <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{selectedEvent.description}</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-10 pt-6 border-t border-white/10 flex justify-end gap-3">
                  <button
                    onClick={() => handleEdit(selectedEvent)}
                    className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 px-4 py-2 rounded-xl hover:bg-indigo-500/10 transition-colors text-sm font-bold"
                  >
                    <Edit size={18} /> {t('edit', lang) || 'Edit'}
                  </button>
                  <button
                    onClick={() => handleDelete(selectedEvent.id)}
                    className="flex items-center gap-2 text-red-400 hover:text-red-300 px-4 py-2 rounded-xl hover:bg-red-500/10 transition-colors text-sm font-bold"
                  >
                    <Trash2 size={18} /> {t('deleteEvent', lang)}
                  </button>
                </div>
              </div>

              {selectedEvent.location && (
                <div className="w-full md:w-1/2 bg-slate-900 min-h-[250px] relative border-l border-white/5 hidden md:block">
                  <iframe
                    key={selectedEvent.location}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    title="Google Maps"
                    allowFullScreen
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(selectedEvent.location)}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                    className="absolute inset-0 grayscale hover:grayscale-0 transition-all duration-700 opacity-60 hover:opacity-100"
                  ></iframe>
                  <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md px-4 py-2 rounded-full text-xs font-bold text-white pointer-events-none border border-white/10">
                    Google Maps
                  </div>
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <ModalPortal>
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-md animate-fade-in">
            <div className="glass-panel p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 animate-scale-in">
              <h3 className="text-lg font-bold text-white mb-2">{t('confirmDelete', lang)}</h3>
              <p className="text-slate-300 text-sm mb-6">{t('deleteItemWarning', lang)}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm hover:bg-slate-700 transition-colors"
                >
                  {t('cancel', lang)}
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 font-bold text-sm hover:bg-red-500/20 transition-colors"
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

export default Agenda;
