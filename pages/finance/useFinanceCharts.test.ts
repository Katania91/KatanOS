import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFinanceCharts } from './useFinanceCharts';
import type { Transaction, FinanceDebt, FinanceGoal } from '../../types';

// Helper to create mock transaction
const mockTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
    id: Math.random().toString(),
    userId: 'test-user',
    type: 'expense',
    amount: 100,
    category: 'food',
    description: 'Test transaction',
    date: new Date().toISOString(),
    ...overrides,
});

// Helper to create mock debt
const mockDebt = (overrides: Partial<FinanceDebt> = {}): FinanceDebt => ({
    id: Math.random().toString(),
    userId: 'test-user',
    name: 'Test Debt',
    balance: 1000,
    rate: 5,
    minPayment: 50,
    ...overrides,
});

// Helper to create mock goal
const mockGoal = (overrides: Partial<FinanceGoal> = {}): FinanceGoal => ({
    id: Math.random().toString(),
    userId: 'test-user',
    name: 'Test Goal',
    targetAmount: 5000,
    currentAmount: 1000,
    targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
});

describe('useFinanceCharts', () => {
    const defaultParams = {
        transactions: [] as Transaction[],
        filteredTransactions: [] as Transaction[],
        debts: [] as FinanceDebt[],
        goals: [] as FinanceGoal[],
        lang: 'it',
        currencyCode: 'EUR',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
    };

    describe('stats', () => {
        it('should return zero values for empty transactions', () => {
            const { result } = renderHook(() => useFinanceCharts(defaultParams));

            expect(result.current.stats.balance).toBe(0);
            expect(result.current.stats.incomeRange).toBe(0);
            expect(result.current.stats.expenseRange).toBe(0);
            expect(result.current.stats.savingsRate).toBe(0);
        });

        it('should calculate balance correctly', () => {
            const transactions = [
                mockTransaction({ type: 'income', amount: 3000, date: '2024-01-15' }),
                mockTransaction({ type: 'expense', amount: 1000, date: '2024-01-20' }),
            ];

            const { result } = renderHook(() => useFinanceCharts({
                ...defaultParams,
                transactions,
                filteredTransactions: transactions,
            }));

            expect(result.current.stats.balance).toBe(2000);
            expect(result.current.stats.incomeRange).toBe(3000);
            expect(result.current.stats.expenseRange).toBe(1000);
        });

        it('should calculate savings rate correctly', () => {
            const transactions = [
                mockTransaction({ type: 'income', amount: 1000, date: '2024-01-15' }),
                mockTransaction({ type: 'expense', amount: 400, date: '2024-01-20' }),
            ];

            const { result } = renderHook(() => useFinanceCharts({
                ...defaultParams,
                transactions,
                filteredTransactions: transactions,
            }));

            // (1000 - 400) / 1000 * 100 = 60%
            expect(result.current.stats.savingsRate).toBe(60);
        });

        it('should calculate total debt correctly', () => {
            const debts = [
                mockDebt({ balance: 500 }),
                mockDebt({ balance: 1500 }),
            ];

            const { result } = renderHook(() => useFinanceCharts({
                ...defaultParams,
                debts,
            }));

            expect(result.current.stats.totalDebt).toBe(2000);
        });

        it('should calculate total saved correctly', () => {
            const goals = [
                mockGoal({ currentAmount: 1000 }),
                mockGoal({ currentAmount: 2000 }),
            ];

            const { result } = renderHook(() => useFinanceCharts({
                ...defaultParams,
                goals,
            }));

            expect(result.current.stats.totalSaved).toBe(3000);
        });
    });

    describe('categoryBreakdown', () => {
        it('should return empty breakdown for no expenses', () => {
            const { result } = renderHook(() => useFinanceCharts(defaultParams));

            expect(result.current.categoryBreakdown.labels).toHaveLength(0);
            expect(result.current.categoryBreakdown.values).toHaveLength(0);
        });

        it('should group expenses by category', () => {
            const transactions = [
                mockTransaction({ type: 'expense', amount: 100, category: 'food', date: '2024-01-15' }),
                mockTransaction({ type: 'expense', amount: 200, category: 'food', date: '2024-01-16' }),
                mockTransaction({ type: 'expense', amount: 150, category: 'transport', date: '2024-01-17' }),
            ];

            const { result } = renderHook(() => useFinanceCharts({
                ...defaultParams,
                transactions,
                filteredTransactions: transactions,
            }));

            expect(result.current.categoryBreakdown.labels).toContain('food');
            expect(result.current.categoryBreakdown.labels).toContain('transport');

            const foodIndex = result.current.categoryBreakdown.labels.indexOf('food');
            expect(result.current.categoryBreakdown.values[foodIndex]).toBe(300);
        });
    });

    describe('formatCurrency', () => {
        it('should return a currency formatter function', () => {
            const { result } = renderHook(() => useFinanceCharts(defaultParams));

            expect(typeof result.current.formatCurrency).toBe('function');
            expect(result.current.formatCurrency(100)).toContain('100');
        });
    });

    describe('chart data', () => {
        it('should return cashflow chart data', () => {
            const { result } = renderHook(() => useFinanceCharts(defaultParams));

            expect(result.current.cashflowChartData).toHaveProperty('labels');
            expect(result.current.cashflowChartData).toHaveProperty('datasets');
            expect(result.current.cashflowChartData.datasets).toHaveLength(2);
        });

        it('should return monthly chart data', () => {
            const { result } = renderHook(() => useFinanceCharts(defaultParams));

            expect(result.current.monthlyChartData).toHaveProperty('labels');
            expect(result.current.monthlyChartData).toHaveProperty('datasets');
        });

        it('should return category chart data', () => {
            const { result } = renderHook(() => useFinanceCharts(defaultParams));

            expect(result.current.categoryChartData).toHaveProperty('labels');
            expect(result.current.categoryChartData).toHaveProperty('datasets');
        });
    });

    describe('chart options', () => {
        it('should return chart options objects', () => {
            const { result } = renderHook(() => useFinanceCharts(defaultParams));

            expect(result.current.cashflowChartOptions).toHaveProperty('plugins');
            expect(result.current.monthlyChartOptions).toHaveProperty('plugins');
            expect(result.current.categoryChartOptions).toHaveProperty('cutout');
        });
    });
});
