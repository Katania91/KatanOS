import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
    value: string;
    label: string;
    icon?: React.ReactNode;
}

interface SelectProps {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
    placeholder?: string;
    className?: string;
    buttonClassName?: string;
    disabled?: boolean;
}

const Select: React.FC<SelectProps> = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    className = '',
    buttonClassName = '',
    disabled = false,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    const handleSelect = (optValue: string) => {
        onChange(optValue);
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger Button */}
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
          w-full flex items-center justify-between gap-2 px-3 py-2 
          bg-slate-900/50 border border-white/10 rounded-xl 
          text-left text-white transition-all
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/20 hover:bg-slate-800/50 cursor-pointer'}
          ${isOpen ? 'border-primary ring-2 ring-primary/20' : ''}
          ${buttonClassName}
        `}
            >
                <span className={`flex items-center gap-2 truncate ${!selectedOption ? 'text-slate-400' : ''}`}>
                    {selectedOption?.icon}
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div
                    className="absolute z-50 w-full mt-1 py-1 bg-slate-800 border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-y-auto animate-fade-in custom-scrollbar"
                    style={{ maxHeight: '240px' }}
                >
                    {options.map((option) => {
                        const isSelected = option.value === value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={`
                  w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors
                  ${isSelected
                                        ? 'bg-primary/20 text-primary'
                                        : 'text-slate-200 hover:bg-white/5 hover:text-white'
                                    }
                `}
                            >
                                <span className="flex items-center gap-2 truncate">
                                    {option.icon}
                                    {option.label}
                                </span>
                                {isSelected && <Check size={14} className="text-primary" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Select;
