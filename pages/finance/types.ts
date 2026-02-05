// Finance module types

export type TxType = 'income' | 'expense';
export type Frequency = 'weekly' | 'monthly' | 'yearly';
export type ViewTab = 'overview' | 'transactions' | 'planning';

// Chart.js tooltip context type (minimal definition for our use case)
export interface ChartTooltipContext {
    raw: number;
    label?: string;
    dataset: {
        label?: string;
        data: number[];
    };
}

// Chart.js scriptable context type for backgroundColor
export interface ChartScriptableContext {
    raw: number;
}

export const DEFAULT_RANGE_DAYS = 30;
