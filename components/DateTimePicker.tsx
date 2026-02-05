import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../services/useTranslation';
import {
  buildCalendarDays,
  formatDateTimeValue,
  getMonthLabel,
  getWeekdayLabels,
  isSameDay,
  parseDateTimeValue,
} from './dateUtils';

interface DateTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  lang?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

const DateTimePicker: React.FC<DateTimePickerProps> = ({
  value,
  onChange,
  lang = 'it',
  placeholder,
  className,
  inputClassName,
  disabled,
  allowClear = true,
}) => {
  const { t } = useTranslation();
  const parsed = useMemo(() => parseDateTimeValue(value), [value]);
  const selectedDate = parsed?.date || null;
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());
  const [hours, setHours] = useState(parsed?.hours ?? 0);
  const [minutes, setMinutes] = useState(parsed?.minutes ?? 0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [floatingStyles, setFloatingStyles] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
    if (parsed) {
      setHours(parsed.hours);
      setMinutes(parsed.minutes);
    }
  }, [parsed, selectedDate]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInside =
        (wrapperRef.current && wrapperRef.current.contains(target)) ||
        (popoverRef.current && popoverRef.current.contains(target));
      if (!isInside) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = wrapperRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const gap = 8;
      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - triggerRect.bottom;
      const spaceAbove = triggerRect.top;
      const placeAbove = spaceBelow < popoverRect.height && spaceAbove > spaceBelow;

      let top = placeAbove
        ? triggerRect.top - popoverRect.height - gap
        : triggerRect.bottom + gap;
      let left = triggerRect.left;

      const maxLeft = viewportWidth - popoverRect.width - gap;
      if (left > maxLeft) left = Math.max(gap, maxLeft);
      if (left < gap) left = gap;

      if (top < gap) top = gap;
      if (top + popoverRect.height > viewportHeight - gap) {
        top = Math.max(gap, viewportHeight - popoverRect.height - gap);
      }

      setFloatingStyles({ top, left, visibility: 'visible' });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const weekDays = useMemo(() => getWeekdayLabels(lang), [lang]);
  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const today = useMemo(() => new Date(), []);
  const hoursList = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutesList = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const commitValue = (date: Date, nextHours: number, nextMinutes: number) => {
    onChange(formatDateTimeValue(date, nextHours, nextMinutes));
  };

  const handleSelectDate = (date: Date) => {
    commitValue(date, hours, minutes);
  };

  const handleSelectHour = (nextHours: number) => {
    setHours(nextHours);
    const baseDate = selectedDate || new Date();
    commitValue(baseDate, nextHours, minutes);
  };

  const handleSelectMinute = (nextMinutes: number) => {
    setMinutes(nextMinutes);
    const baseDate = selectedDate || new Date();
    commitValue(baseDate, hours, nextMinutes);
  };

  const handleToday = () => {
    const now = new Date();
    commitValue(now, hours, minutes);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  const displayValue = value ? value.replace('T', ' ') : '';

  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  return (
    <div ref={wrapperRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-label={t('pickerOpenDateTime', lang)}
        className={`w-full flex items-center justify-between gap-2 ${inputClassName || ''} ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-white/20'
        }`}
      >
        <span className={displayValue ? 'text-white' : 'text-slate-400'}>
          {displayValue || placeholder || ''}
        </span>
        <CalendarClock size={16} className="text-slate-300 shrink-0" />
      </button>

      {open && portalRoot
        ? createPortal(
            <div
              ref={popoverRef}
              style={floatingStyles}
              className="fixed z-[120] w-[320px] rounded-2xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur"
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label={t('pickerPrevMonth', lang)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-white capitalize">
                  {getMonthLabel(viewDate, lang)}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label={t('pickerNextMonth', lang)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 px-3 py-3">
                <div className="flex-1">
                  <div className="grid grid-cols-7 text-[10px] uppercase text-slate-400 mb-2">
                    {weekDays.map((day) => (
                      <span key={day} className="text-center">
                        {day}
                      </span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map(({ date, inMonth }) => {
                      const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
                      const isToday = isSameDay(date, today);
                      return (
                        <button
                          key={date.toISOString()}
                          type="button"
                          onClick={() => handleSelectDate(date)}
                          className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${
                            inMonth ? 'text-slate-200' : 'text-slate-500'
                          } ${
                            isSelected
                              ? 'bg-gradient-to-r from-primary to-secondary text-white'
                              : 'hover:bg-white/10'
                          } ${isToday && !isSelected ? 'border border-primary/40' : ''}`}
                        >
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 sm:w-[140px]">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase text-slate-400 mb-1 text-center">
                      {t('clock_hours', lang)}
                    </p>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                      {hoursList.map((hour) => (
                        <button
                          key={hour}
                          type="button"
                          onClick={() => handleSelectHour(hour)}
                          className={`w-full rounded-lg px-2 py-1 text-xs font-semibold text-center transition-colors ${
                            hour === hours
                              ? 'bg-primary/30 text-white'
                              : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {String(hour).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase text-slate-400 mb-1 text-center">
                      {t('clock_minutes', lang)}
                    </p>
                    <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                      {minutesList.map((minute) => (
                        <button
                          key={minute}
                          type="button"
                          onClick={() => handleSelectMinute(minute)}
                          className={`w-full rounded-lg px-2 py-1 text-xs font-semibold text-center transition-colors ${
                            minute === minutes
                              ? 'bg-secondary/30 text-white'
                              : 'text-slate-300 hover:bg-white/10'
                          }`}
                        >
                          {String(minute).padStart(2, '0')}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleToday}
                  className="text-xs font-semibold text-slate-300 hover:text-white"
                >
                  {t('today', lang)}
                </button>
                {allowClear && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs font-semibold text-slate-300 hover:text-white"
                  >
                    {t('pickerClear', lang)}
                  </button>
                )}
              </div>
            </div>,
            portalRoot
          )
        : null}
    </div>
  );
};

export default DateTimePicker;
