import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '../services/useTranslation';
import {
  buildCalendarDays,
  formatDateValue,
  getMonthLabel,
  getWeekdayLabels,
  isSameDay,
  parseDateValue,
} from './dateUtils';

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  lang?: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
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
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [floatingStyles, setFloatingStyles] = useState<React.CSSProperties>({ visibility: 'hidden' });

  useEffect(() => {
    if (selectedDate) {
      setViewDate(selectedDate);
    }
  }, [selectedDate]);

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

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDate = (date: Date) => {
    onChange(formatDateValue(date));
    setOpen(false);
  };

  const handleToday = () => {
    onChange(formatDateValue(new Date()));
    setOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setOpen(false);
  };

  const displayValue = value || '';

  const portalRoot = typeof document !== 'undefined' ? document.body : null;

  return (
    <div ref={wrapperRef} className={`relative ${className || ''}`}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        aria-label={t('pickerOpenDate', lang)}
        className={`w-full flex items-center justify-between gap-2 ${inputClassName || ''} ${
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-white/20'
        }`}
      >
        <span className={displayValue ? 'text-white' : 'text-slate-400'}>
          {displayValue || placeholder || ''}
        </span>
        <Calendar size={16} className="text-slate-300 shrink-0" />
      </button>

      {open && portalRoot
        ? createPortal(
            <div
              ref={popoverRef}
              style={floatingStyles}
              className="fixed z-[120] w-[280px] rounded-2xl border border-white/10 bg-slate-900/95 shadow-xl backdrop-blur"
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

              <div className="px-3 py-2">
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

export default DatePicker;
