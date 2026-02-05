import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

const DEFAULT_COLORS = [
  '#f8fafc',
  '#e2e8f0',
  '#cbd5f5',
  '#94a3b8',
  '#64748b',
  '#334155',
  '#0f172a',
  '#fca5a5',
  '#f87171',
  '#ef4444',
  '#fb923c',
  '#f97316',
  '#fdba74',
  '#facc15',
  '#fef08a',
  '#22c55e',
  '#86efac',
  '#10b981',
  '#14b8a6',
  '#99f6e4',
  '#0ea5e9',
  '#38bdf8',
  '#60a5fa',
  '#6366f1',
  '#a5b4fc',
  '#8b5cf6',
  '#c4b5fd',
  '#d946ef',
  '#f0abfc',
];

const isValidHex = (value: string) =>
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  colors?: string[];
  icon?: React.ReactNode;
  label?: string;
  showInput?: boolean;
  showClear?: boolean;
  onClear?: () => void;
  clearLabel?: string;
  onOpen?: () => void;
  className?: string;
  buttonClassName?: string;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  colors = DEFAULT_COLORS,
  icon,
  label,
  showInput = false,
  showClear = false,
  onClear,
  clearLabel = 'Clear',
  onOpen,
  className = '',
  buttonClassName = '',
}) => {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!open) return;
      const target = event.target as Node | null;
      if (!wrapperRef.current || !target) return;
      if (!wrapperRef.current.contains(target)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handleOutside);
    return () => window.removeEventListener('mousedown', handleOutside);
  }, [open]);

  const swatches = useMemo(() => colors.map((color) => color.toLowerCase()), [colors]);

  const handleSelect = (color: string) => {
    onChange(color);
    setOpen(false);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value.trim();
    setInputValue(next);
    if (isValidHex(next)) {
      onChange(next);
    }
  };

  const handleToggle = () => {
    if (!open && onOpen) {
      onOpen();
    }
    setOpen((prev) => !prev);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleToggle}
        className={`flex items-center justify-center ${buttonClassName}`}
        title={label}
      >
        {icon ? (
          icon
        ) : (
          <span
            className="inline-flex h-6 w-6 rounded-lg border border-white/20"
            style={{ backgroundColor: value }}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-44 rounded-2xl border border-white/10 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl">
          {label && <div className="text-[10px] uppercase text-slate-400 mb-2">{label}</div>}
          <div className="grid grid-cols-7 gap-2">
            {swatches.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => handleSelect(color)}
                className="h-5 w-5 rounded-md border border-white/10 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
          {showInput && (
            <input
              value={inputValue}
              onChange={handleInputChange}
              className="mt-3 w-full rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-white outline-none focus:border-primary"
              placeholder="#RRGGBB"
            />
          )}
          {showClear && onClear && (
            <button
              type="button"
              onClick={() => {
                onClear();
                setOpen(false);
              }}
              className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-wider text-slate-300 hover:bg-white/10 flex items-center justify-center gap-1"
            >
              <X size={12} /> {clearLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ColorPicker;
