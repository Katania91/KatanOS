import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../services/useTranslation';

interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string;
  onChange: (value: string) => void;
  lang?: string;
  inputClassName?: string;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  lang = 'it',
  step = 1,
  min,
  max,
  placeholder,
  inputClassName,
  className,
  disabled,
  ...rest
}) => {
  const { t } = useTranslation();
  const stepValue = typeof step === 'number' ? step : Number(step) || 1;
  const decimals = stepValue.toString().includes('.')
    ? stepValue.toString().split('.')[1]?.length || 0
    : 0;

  const clampValue = (raw: number) => {
    let next = raw;
    if (typeof min === 'number') next = Math.max(min, next);
    if (typeof max === 'number') next = Math.min(max, next);
    return next;
  };

  const formatValue = (raw: number) => {
    if (!Number.isFinite(raw)) return '';
    return decimals > 0 ? raw.toFixed(decimals) : String(Math.round(raw));
  };

  const applyStep = (direction: 1 | -1) => {
    const current = Number(value);
    if (!Number.isFinite(current)) {
      const base = typeof min === 'number' ? min : 0;
      const next = direction > 0 && base === 0 ? stepValue : base;
      onChange(formatValue(clampValue(next)));
      return;
    }
    const next = clampValue(current + direction * stepValue);
    onChange(formatValue(next));
  };

  return (
    <div className={`relative ${className || ''}`}>
      <input
        {...rest}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        disabled={disabled}
        className={`w-full pr-9 ${inputClassName || ''} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      />
      <div className="absolute right-1 top-1 bottom-1 flex flex-col justify-between">
        <button
          type="button"
          onClick={() => applyStep(1)}
          aria-label={t('pickerIncrease', lang)}
          disabled={disabled}
          className="flex h-4 w-6 items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <ChevronUp size={14} />
        </button>
        <button
          type="button"
          onClick={() => applyStep(-1)}
          aria-label={t('pickerDecrease', lang)}
          disabled={disabled}
          className="flex h-4 w-6 items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <ChevronDown size={14} />
        </button>
      </div>
    </div>
  );
};

export default NumberInput;
