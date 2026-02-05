import React from 'react';
import NumberInput from './NumberInput';

type NumberInputProps = React.ComponentProps<typeof NumberInput>;

interface RequiredNumberInputProps extends Omit<NumberInputProps, 'value' | 'onChange' | 'inputClassName'> {
    value: string;
    onChange: (value: string) => void;
    label: string;
    error?: boolean;
    onErrorClear?: () => void;
    className?: string;
    inputClassName?: string;
    labelClassName?: string;
    normalBorderClassName?: string;
    errorBorderClassName?: string;
    isValid?: (value: string) => boolean;
}

/**
 * Required wrapper for NumberInput that shows an asterisk and error border.
 */
const RequiredNumberInput: React.FC<RequiredNumberInputProps> = ({
    value,
    onChange,
    label,
    error = false,
    onErrorClear,
    className = '',
    inputClassName = '',
    labelClassName = '',
    normalBorderClassName = 'border border-white/10',
    errorBorderClassName = 'border-2 border-red-500',
    isValid = (nextValue) => nextValue !== '',
    ...rest
}) => {
    const handleChange = (nextValue: string) => {
        onChange(nextValue);
        if (onErrorClear && error && isValid(nextValue)) {
            onErrorClear();
        }
    };

    const borderClass = error ? errorBorderClassName : normalBorderClassName;

    return (
        <div className={className}>
            <label className={`text-[10px] uppercase font-bold text-slate-300 flex items-center gap-1 ${labelClassName}`}>
                {label}
                <span className="text-red-400">*</span>
            </label>
            <NumberInput
                value={value}
                onChange={handleChange}
                inputClassName={`${inputClassName} ${borderClass}`}
                {...rest}
            />
        </div>
    );
};

export default RequiredNumberInput;
