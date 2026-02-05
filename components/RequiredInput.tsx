import React from 'react';

interface RequiredInputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'className'> {
    value: string;
    onChange: (value: string) => void;
    label: string;
    placeholder?: string;
    error?: boolean;
    onErrorClear?: () => void;
    className?: string;
    type?: 'text' | 'number' | 'email' | 'password';
    inputClassName?: string;
    labelClassName?: string;
    normalBorderClassName?: string;
    errorBorderClassName?: string;
    isValid?: (value: string) => boolean;
}

/**
 * A reusable input component for required fields.
 * Shows an asterisk (*) next to the label and a red border when in error state.
 */
const RequiredInput: React.FC<RequiredInputProps> = ({
    value,
    onChange,
    label,
    placeholder,
    error = false,
    onErrorClear,
    className = '',
    type = 'text',
    inputClassName = '',
    labelClassName = '',
    normalBorderClassName = 'border border-white/10',
    errorBorderClassName = 'border-2 border-red-500',
    isValid = (nextValue) => nextValue.trim().length > 0,
    ...rest
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const nextValue = e.target.value;
        onChange(nextValue);
        if (onErrorClear && error && isValid(nextValue)) {
            onErrorClear();
        }
    };

    const baseInputClass = 'w-full transition-colors outline-none';
    const borderClass = error ? errorBorderClassName : normalBorderClassName;

    return (
        <div className={className}>
            <label className={`text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 ${labelClassName}`}>
                {label}
                <span className="text-red-400">*</span>
            </label>
            <input
                {...rest}
                type={type}
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                className={`${baseInputClass} ${inputClassName} ${borderClass}`}
            />
        </div>
    );
};

export default RequiredInput;
