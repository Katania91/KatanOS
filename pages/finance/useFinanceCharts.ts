// Finance chart hooks - extracted from Finance.tsx for better maintainability

import { useMemo } from 'react';
import type { Transaction, FinanceDebt, FinanceGoal } from '../../types';
import { useTranslation } from '../../services/useTranslation';
import { getFinanceCategoryLabel } from '../../services/financeCategories';
import {
    type ChartTooltipContext,
    type ChartScriptableContext,
    DEFAULT_RANGE_DAYS,
    createCurrencyFormatter,
    toMonthKey,
} from './index';

interface UseFinanceChartsParams {
    transactions: Transaction[];
    filteredTransactions: Transaction[];
    debts: FinanceDebt[];
    goals: FinanceGoal[];
    lang: string;
    currencyCode: string;
    startDate: string;
    endDate: string;
}

export const useFinanceCharts = ({
    transactions,
    filteredTransactions,
    debts,
    goals,
    lang,
    currencyCode,
    startDate,
    endDate,
}: UseFinanceChartsParams) => {
    const { t } = useTranslation();
    const formatCurrency = createCurrencyFormatter(lang, currencyCode);

    // Stats calculation
    const stats = useMemo(() => {
        const incomeAll = transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
        const expenseAll = transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
        const incomeRange = filteredTransactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
        const expenseRange = filteredTransactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
        const savingsRate = incomeRange > 0 ? ((incomeRange - expenseRange) / incomeRange) * 100 : 0;

        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

        const currentMonthIncome = transactions
            .filter((tx) => tx.type === 'income' && tx.date.startsWith(currentMonthKey))
            .reduce((sum, tx) => sum + tx.amount, 0);
        const currentMonthExpense = transactions
            .filter((tx) => tx.type === 'expense' && tx.date.startsWith(currentMonthKey))
            .reduce((sum, tx) => sum + tx.amount, 0);
        const prevMonthExpense = transactions
            .filter((tx) => tx.type === 'expense' && tx.date.startsWith(prevMonthKey))
            .reduce((sum, tx) => sum + tx.amount, 0);

        const expenseChange = prevMonthExpense > 0
            ? ((currentMonthExpense - prevMonthExpense) / prevMonthExpense) * 100
            : 0;

        const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
        const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
        const totalGoalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
        const netWorth = incomeAll - expenseAll - totalDebt;

        const daysInRange = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const dailyAverage = expenseRange / daysInRange;

        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const dayOfMonth = now.getDate();
        const projectedMonthlyExpense = (currentMonthExpense / dayOfMonth) * daysInMonth;

        return {
            balance: incomeAll - expenseAll,
            incomeRange,
            expenseRange,
            savingsRate,
            expenseChange,
            totalDebt,
            totalSaved,
            totalGoalTarget,
            netWorth,
            dailyAverage,
            projectedMonthlyExpense,
            currentMonthIncome,
            currentMonthExpense,
        };
    }, [transactions, filteredTransactions, debts, goals, startDate, endDate]);

    // Category breakdown
    const categoryBreakdown = useMemo(() => {
        const totals: Record<string, number> = {};
        filteredTransactions
            .filter((tx) => tx.type === 'expense')
            .forEach((tx) => {
                totals[tx.category] = (totals[tx.category] || 0) + tx.amount;
            });
        const labels = Object.keys(totals);
        return {
            labels,
            values: labels.map((label) => totals[label]),
        };
    }, [filteredTransactions]);

    // Monthly trend
    const monthlyTrend = useMemo(() => {
        const months: string[] = [];
        const monthLabels: string[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.push(monthKey);
            monthLabels.push(d.toLocaleDateString(lang, { month: 'short' }));
        }
        const income = months.map((month) =>
            transactions
                .filter((tx) => tx.type === 'income' && toMonthKey(tx.date) === month)
                .reduce((sum, tx) => sum + tx.amount, 0)
        );
        const expense = months.map((month) =>
            transactions
                .filter((tx) => tx.type === 'expense' && toMonthKey(tx.date) === month)
                .reduce((sum, tx) => sum + tx.amount, 0)
        );
        const balance = income.map((inc, idx) => inc - expense[idx]);
        return { months, monthLabels, income, expense, balance };
    }, [transactions, lang]);

    // Cashflow series
    const cashflowSeries = useMemo(() => {
        const days: string[] = [];
        const dataIncome: number[] = [];
        const dataExpense: number[] = [];
        const start = new Date(endDate);
        start.setDate(start.getDate() - DEFAULT_RANGE_DAYS + 1);
        for (let i = 0; i < DEFAULT_RANGE_DAYS; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            const key = d.toISOString().slice(0, 10);
            days.push(key.slice(5));
            const dayIncome = transactions
                .filter((tx) => tx.type === 'income' && tx.date.slice(0, 10) === key)
                .reduce((sum, tx) => sum + tx.amount, 0);
            const dayExpense = transactions
                .filter((tx) => tx.type === 'expense' && tx.date.slice(0, 10) === key)
                .reduce((sum, tx) => sum + tx.amount, 0);
            dataIncome.push(dayIncome);
            dataExpense.push(dayExpense);
        }
        return { days, dataIncome, dataExpense };
    }, [transactions, endDate]);

    // Cashflow chart data
    const cashflowChartData = useMemo(() => ({
        labels: cashflowSeries.days,
        datasets: [
            {
                label: t('income', lang),
                data: cashflowSeries.dataIncome,
                borderColor: '#34d399',
                backgroundColor: 'rgba(52, 211, 153, 0.2)',
                tension: 0.35,
                fill: true,
            },
            {
                label: t('expenses', lang),
                data: cashflowSeries.dataExpense,
                borderColor: '#f87171',
                backgroundColor: 'rgba(248, 113, 113, 0.2)',
                tension: 0.35,
                fill: true,
            },
        ],
    }), [cashflowSeries, lang]);

    // Cashflow chart options
    const cashflowChartOptions = useMemo(() => ({
        plugins: {
            legend: { position: 'top' as const },
        },
        scales: {
            x: { grid: { display: false } },
            y: { grid: { color: 'rgba(255,255,255,0.06)' } },
        },
    }), []);

    // Monthly chart data
    const monthlyChartData = useMemo(() => ({
        labels: monthlyTrend.monthLabels,
        datasets: [
            {
                label: t('income', lang),
                data: monthlyTrend.income,
                backgroundColor: 'rgba(52, 211, 153, 0.8)',
                borderRadius: 6,
            },
            {
                label: t('expenses', lang),
                data: monthlyTrend.expense,
                backgroundColor: 'rgba(248, 113, 113, 0.8)',
                borderRadius: 6,
            },
        ],
    }), [monthlyTrend, lang]);

    // Monthly chart options
    const monthlyChartOptions = useMemo(() => {
        const fmt = createCurrencyFormatter(lang, currencyCode);
        return {
            plugins: {
                legend: { position: 'top' as const, labels: { boxWidth: 12, padding: 15 } },
                tooltip: {
                    callbacks: {
                        label: (context: ChartTooltipContext) => `${context.dataset.label}: ${fmt(context.raw)}`,
                    },
                },
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    grid: { color: 'rgba(255,255,255,0.06)' },
                    ticks: { callback: (value: number) => fmt(value) },
                },
            },
        };
    }, [lang, currencyCode]);

    // Category chart data
    const categoryChartData = useMemo(() => ({
        labels: categoryBreakdown.labels.map((label) => getFinanceCategoryLabel(label, lang)),
        datasets: [
            {
                data: categoryBreakdown.values,
                backgroundColor: ['#f97316', '#f43f5e', '#a855f7', '#38bdf8', '#34d399', '#facc15', '#ec4899', '#06b6d4', '#84cc16', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 8,
            },
        ],
    }), [categoryBreakdown, lang]);

    // Category chart options
    const categoryChartOptions = useMemo(() => {
        const fmt = createCurrencyFormatter(lang, currencyCode);
        return {
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context: ChartTooltipContext) => {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                            return `${context.label}: ${fmt(value)} (${pct}%)`;
                        },
                    },
                },
            },
            cutout: '60%',
        };
    }, [lang, currencyCode]);

    // Category legend items
    const categoryLegendItems = useMemo(() => {
        const labels = categoryChartData.labels as string[];
        const values = categoryChartData.datasets[0]?.data as number[] | undefined;
        const colors = categoryChartData.datasets[0]?.backgroundColor as string[] | undefined;
        if (!labels?.length || !values?.length || !colors?.length) return [];
        const total = values.reduce((sum, value) => sum + value, 0);
        return labels.map((label, index) => {
            const value = values[index] ?? 0;
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return {
                label,
                color: colors[index % colors.length],
                pct,
            };
        });
    }, [categoryChartData]);

    return {
        stats,
        formatCurrency,
        categoryBreakdown,
        monthlyTrend,
        cashflowChartData,
        cashflowChartOptions,
        monthlyChartData,
        monthlyChartOptions,
        categoryChartData,
        categoryChartOptions,
        categoryLegendItems,
    };
};
