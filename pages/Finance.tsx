import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { User, Transaction, FinanceBudget, FinanceDebt, FinanceGoal, FinanceRecurring } from '../types';
import { db } from '../services/db';
import { askGeminiFinance } from '../services/gemini';
import { resolveSecretValue } from '../services/secrets';
import { useTranslation } from '../services/useTranslation';
import { getDefaultFinanceCategories, getFinanceCategoryLabel } from '../services/financeCategories';
import DatePicker from '../components/DatePicker';
import NumberInput from '../components/NumberInput';
import RequiredInput from '../components/RequiredInput';
import RequiredNumberInput from '../components/RequiredNumberInput';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  Download,
  Flame,
  Flag,
  Info,
  LineChart,
  Minus,
  PiggyBank,
  Plus,
  Pencil,
  RefreshCw,
  Repeat,
  Scale,
  Sparkles,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import ChartWrapper from '../components/ChartWrapper';
import ModalPortal from '../components/ModalPortal';

interface FinanceProps {
  user: User;
}

type TxType = 'income' | 'expense';
type Frequency = 'weekly' | 'monthly' | 'yearly';

const DEFAULT_RANGE_DAYS = 30;

type ViewTab = 'overview' | 'transactions' | 'planning';

// Helper function definita FUORI dal componente per evitare problemi di inizializzazione
const createCurrencyFormatter = (lang: string, currency: string) => (value: number) =>
  new Intl.NumberFormat(lang, { style: 'currency', currency }).format(value || 0);


const Finance: React.FC<FinanceProps> = ({ user }) => {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [debts, setDebts] = useState<FinanceDebt[]>([]);
  const [recurring, setRecurring] = useState<FinanceRecurring[]>([]);

  const [activeTab, setActiveTab] = useState<ViewTab>('overview');
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showFinanceInfo, setShowFinanceInfo] = useState(false);
  const [goalContributionId, setGoalContributionId] = useState<string | null>(null);
  const [goalContributionAmount, setGoalContributionAmount] = useState('');
  const [debtPaymentId, setDebtPaymentId] = useState<string | null>(null);
  const [debtPaymentAmount, setDebtPaymentAmount] = useState('');

  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [type, setType] = useState<TxType>('expense');
  const [category, setCategory] = useState<string>('food');
  const [tagsInput, setTagsInput] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [amountError, setAmountError] = useState(false);
  const [descError, setDescError] = useState(false);

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - DEFAULT_RANGE_DAYS + 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [rangePreset, setRangePreset] = useState<'last30' | 'thisMonth' | 'custom'>('last30');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | TxType>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterTag, setFilterTag] = useState('all');

  const [budgetCategory, setBudgetCategory] = useState('food');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetAmountError, setBudgetAmountError] = useState(false);

  const [goalName, setGoalName] = useState('');
  const [goalEmoji, setGoalEmoji] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalNameError, setGoalNameError] = useState(false);
  const [goalTargetError, setGoalTargetError] = useState(false);

  const [debtName, setDebtName] = useState('');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtRate, setDebtRate] = useState('');
  const [debtMin, setDebtMin] = useState('');
  const [debtDueDay, setDebtDueDay] = useState('');
  const [debtNameError, setDebtNameError] = useState(false);
  const [debtBalanceError, setDebtBalanceError] = useState(false);

  const [recurringType, setRecurringType] = useState<TxType>('expense');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringCategory, setRecurringCategory] = useState('food');
  const [recurringDesc, setRecurringDesc] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState<Frequency>('monthly');
  const [recurringStartDate, setRecurringStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [recurringTags, setRecurringTags] = useState('');
  const [recurringAmountError, setRecurringAmountError] = useState(false);
  const [recurringDescError, setRecurringDescError] = useState(false);

  const [aiTip, setAiTip] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  const lang = user.language || 'it';
  const currencyCode = user.currency || 'EUR';

  // Helper per formattazione valuta
  const formatCurrency = createCurrencyFormatter(lang, currencyCode);

  const parseTags = (input: string) =>
    input
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

  const toMonthKey = (value: string) => value.slice(0, 7);

  const getNextDate = (dateValue: Date, frequency: Frequency) => {
    const next = new Date(dateValue);
    if (frequency === 'weekly') {
      next.setDate(next.getDate() + 7);
      return next;
    }
    if (frequency === 'monthly') {
      next.setMonth(next.getMonth() + 1);
      return next;
    }
    next.setFullYear(next.getFullYear() + 1);
    return next;
  };

  const categoryOptions = useMemo(() => {
    const defaults = getDefaultFinanceCategories(lang);
    const custom = (user.financeCategories || []).map((cat) => ({ id: cat, label: cat }));
    const merged = [...defaults, ...custom];
    if (category && !merged.some((cat) => cat.id === category)) {
      merged.push({ id: category, label: category });
    }
    return merged;
  }, [category, lang, user.financeCategories]);

  const categoryLabel = (value: string) => getFinanceCategoryLabel(value, lang);

  const loadFinanceData = async () => {
    const [txs, budgetItems, goalItems, debtItems, recurringItems] = await Promise.all([
      db.transactions.list(user.id),
      db.financeBudgets.list(user.id),
      db.financeGoals.list(user.id),
      db.financeDebts.list(user.id),
      db.financeRecurring.list(user.id),
    ]);
    setTransactions(txs);
    setBudgets(budgetItems);
    setGoals(goalItems);
    setDebts(debtItems);
    setRecurring(recurringItems);
  };

  useEffect(() => {
    loadFinanceData();
  }, [user.id]);

  useEffect(() => {
    if (recurring.length === 0) return;
    let cancelled = false;
    const applyRecurring = async () => {
      const today = new Date();
      const pendingTransactions: Omit<Transaction, 'id'>[] = [];
      const recurringUpdates: Array<{ id: string; nextDate: string }> = [];
      for (const item of recurring) {
        let nextDate = new Date(item.nextDate || item.startDate);
        if (Number.isNaN(nextDate.getTime())) continue;
        let updated = false;
        while (nextDate <= today) {
          pendingTransactions.push({
            userId: user.id,
            amount: item.amount,
            type: item.type,
            category: item.category,
            description: item.description,
            date: nextDate.toISOString(),
            tags: item.tags || [],
          });
          nextDate = getNextDate(nextDate, item.frequency);
          updated = true;
        }
        if (updated) {
          recurringUpdates.push({ id: item.id, nextDate: nextDate.toISOString() });
        }
      }
      if (pendingTransactions.length === 0 && recurringUpdates.length === 0) {
        return;
      }
      if (pendingTransactions.length > 0) {
        await db.transactions.addMany(pendingTransactions);
      }
      for (const update of recurringUpdates) {
        await db.financeRecurring.update(update.id, { nextDate: update.nextDate });
      }
      if (cancelled) return;
      if (pendingTransactions.length > 0) {
        const updatedTxs = await db.transactions.list(user.id);
        if (!cancelled) setTransactions(updatedTxs);
      }
      if (recurringUpdates.length > 0) {
        const refreshedRecurring = await db.financeRecurring.list(user.id);
        if (!cancelled) setRecurring(refreshedRecurring);
      }
    };
    void applyRecurring();
    return () => {
      cancelled = true;
    };
  }, [recurring, user.id]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const txDate = tx.date.slice(0, 10);
      if (txDate < startDate || txDate > endDate) return false;
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterCategory !== 'all' && tx.category !== filterCategory) return false;
      if (filterTag !== 'all') {
        const tags = tx.tags || [];
        if (!tags.includes(filterTag)) return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const haystack = `${tx.description} ${tx.category} ${(tx.tags || []).join(' ')}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [transactions, startDate, endDate, filterType, filterCategory, filterTag, searchTerm]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => (tx.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [transactions]);

  const stats = useMemo(() => {
    const incomeAll = transactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const expenseAll = transactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const incomeRange = filteredTransactions.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
    const expenseRange = filteredTransactions.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
    const savingsRate = incomeRange > 0 ? ((incomeRange - expenseRange) / incomeRange) * 100 : 0;
    
    // Calcoli aggiuntivi per il mese precedente
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

    // Totale debiti
    const totalDebt = debts.reduce((sum, d) => sum + d.balance, 0);
    
    // Totale risparmiato negli obiettivi
    const totalSaved = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalGoalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    
    // Net Worth stimato
    const netWorth = incomeAll - expenseAll - totalDebt;

    // Media giornaliera spese (ultimo mese)
    const daysInRange = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const dailyAverage = expenseRange / daysInRange;

    // Proiezione fine mese
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

  const monthlyTrend = useMemo(() => {
    const months: string[] = [];
    const monthLabels: string[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthKey);
      // Etichetta più leggibile: "Gen", "Feb", etc.
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
    // Calcola il bilancio netto per ogni mese
    const balance = income.map((inc, idx) => inc - expense[idx]);
    return { months, monthLabels, income, expense, balance };
  }, [transactions, lang]);

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

  const cashflowChartOptions = useMemo(() => ({
    plugins: {
      legend: { position: 'top' },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: 'rgba(255,255,255,0.06)' } },
    },
  }), []);

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

  const monthlyChartOptions = useMemo(() => {
    const fmt = createCurrencyFormatter(lang, currencyCode);
    return {
      plugins: { 
        legend: { position: 'top', labels: { boxWidth: 12, padding: 15 } },
        tooltip: {
          callbacks: {
            label: (context: any) => `${context.dataset.label}: ${fmt(context.raw)}`,
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

  // Trend categorie negli ultimi 3 mesi
  const categoryTrend = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    const monthLabels: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      monthLabels.push(d.toLocaleDateString(lang, { month: 'short' }));
    }
    
    // Trova le top 5 categorie per spesa totale
    const categoryTotals: Record<string, number> = {};
    transactions
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
      });
    
    const topCategories = Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat);
    
    const datasets = topCategories.map((cat, idx) => {
      const colors = ['#f97316', '#f43f5e', '#a855f7', '#38bdf8', '#34d399'];
      const data = months.map((month) =>
        transactions
          .filter((tx) => tx.type === 'expense' && tx.category === cat && toMonthKey(tx.date) === month)
          .reduce((sum, tx) => sum + tx.amount, 0)
      );
      return {
        label: categoryLabel(cat),
        data,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length] + '30',
        tension: 0.3,
        fill: false,
      };
    });
    
    return { monthLabels, datasets };
  }, [transactions, lang]);

  // Calcolo accumulo netto nel tempo (ultimi 6 mesi)
  const netWorthTrend = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    const monthLabels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      monthLabels.push(d.toLocaleDateString(lang, { month: 'short' }));
    }
    
    let runningTotal = 0;
    // Calcola il totale fino al primo mese nel range
    const firstMonth = months[0];
    transactions.forEach((tx) => {
      if (toMonthKey(tx.date) < firstMonth) {
        runningTotal += tx.type === 'income' ? tx.amount : -tx.amount;
      }
    });
    
    const values = months.map((month) => {
      const monthIncome = transactions
        .filter((tx) => tx.type === 'income' && toMonthKey(tx.date) === month)
        .reduce((sum, tx) => sum + tx.amount, 0);
      const monthExpense = transactions
        .filter((tx) => tx.type === 'expense' && toMonthKey(tx.date) === month)
        .reduce((sum, tx) => sum + tx.amount, 0);
      runningTotal += monthIncome - monthExpense;
      return runningTotal;
    });
    
    return { monthLabels, values };
  }, [transactions, lang]);

  // Grafico bilancio netto mensile
  const balanceTrendChartData = useMemo(() => ({
    labels: monthlyTrend.monthLabels,
    datasets: [
      {
        label: t('periodBalance', lang),
        data: monthlyTrend.balance,
        borderColor: '#38bdf8',
        backgroundColor: (context: any) => {
          const value = context.raw;
          return value >= 0 ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)';
        },
        tension: 0.35,
        fill: true,
        pointBackgroundColor: monthlyTrend.balance.map((v) => v >= 0 ? '#34d399' : '#f87171'),
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  }), [monthlyTrend, lang]);

  const balanceTrendChartOptions = useMemo(() => {
    const fmt = createCurrencyFormatter(lang, currencyCode);
    return {
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => `${t('periodBalance', lang)}: ${fmt(context.raw)}`,
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

  // Grafico Net Worth cumulativo
  const netWorthChartData = useMemo(() => ({
    labels: netWorthTrend.monthLabels,
    datasets: [
      {
        label: t('netWorth', lang),
        data: netWorthTrend.values,
        borderColor: '#a855f7',
        backgroundColor: 'rgba(168, 85, 247, 0.15)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#a855f7',
        pointRadius: 4,
        pointHoverRadius: 6,
      },
    ],
  }), [netWorthTrend, lang]);

  const netWorthChartOptions = useMemo(() => {
    const fmt = createCurrencyFormatter(lang, currencyCode);
    return {
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => `${t('netWorth', lang)}: ${fmt(context.raw)}`,
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

  // Grafico categorie trend
  const categoryTrendChartData = useMemo(() => ({
    labels: categoryTrend.monthLabels,
    datasets: categoryTrend.datasets,
  }), [categoryTrend]);

  const categoryTrendChartOptions = useMemo(() => {
    const fmt = createCurrencyFormatter(lang, currencyCode);
    return {
      plugins: { 
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: (context: any) => `${context.dataset.label}: ${fmt(context.raw)}`,
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

  const categoryChartOptions = useMemo(() => {
    const fmt = createCurrencyFormatter(lang, currencyCode);
    return {
      plugins: { 
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => {
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

  const budgetsWithProgress = useMemo(() => {
    const monthKey = toMonthKey(endDate);
    return budgets.map((budget) => {
      const spent = transactions
        .filter((tx) => tx.type === 'expense' && tx.category === budget.category && toMonthKey(tx.date) === monthKey)
        .reduce((sum, tx) => sum + tx.amount, 0);
      const pct = budget.amount > 0 ? Math.min(100, (spent / budget.amount) * 100) : 0;
      const remaining = Math.max(0, budget.amount - spent);
      const isOverBudget = spent > budget.amount;
      return { ...budget, spent, pct, remaining, isOverBudget };
    });
  }, [budgets, transactions, endDate]);

  // Alert per budget superati
  const budgetAlerts = useMemo(() => {
    return budgetsWithProgress.filter((b) => b.pct >= 90);
  }, [budgetsWithProgress]);

  // Calcolo giorni rimanenti per obiettivi
  const goalsWithProgress = useMemo(() => {
    return goals.map((goal) => {
      const pct = goal.targetAmount > 0 ? Math.min(100, (goal.currentAmount / goal.targetAmount) * 100) : 0;
      const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
      let daysRemaining: number | null = null;
      let monthlyNeeded: number | null = null;
      
      if (goal.targetDate && remaining > 0) {
        const targetDate = new Date(goal.targetDate);
        const today = new Date();
        const diffTime = targetDate.getTime() - today.getTime();
        daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (daysRemaining > 0) {
          monthlyNeeded = (remaining / daysRemaining) * 30;
        }
      }
      
      return { ...goal, pct, remaining, daysRemaining, monthlyNeeded };
    });
  }, [goals]);

  // Top spese del periodo
  const topExpenses = useMemo(() => {
    return [...filteredTransactions]
      .filter((tx) => tx.type === 'expense')
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredTransactions]);

  // Entrate ricorrenti totali mensili
  const monthlyRecurringIncome = useMemo(() => {
    return recurring
      .filter((r) => r.type === 'income')
      .reduce((sum, r) => {
        if (r.frequency === 'monthly') return sum + r.amount;
        if (r.frequency === 'weekly') return sum + r.amount * 4.33;
        if (r.frequency === 'yearly') return sum + r.amount / 12;
        return sum;
      }, 0);
  }, [recurring]);

  const monthlyRecurringExpense = useMemo(() => {
    return recurring
      .filter((r) => r.type === 'expense')
      .reduce((sum, r) => {
        if (r.frequency === 'monthly') return sum + r.amount;
        if (r.frequency === 'weekly') return sum + r.amount * 4.33;
        if (r.frequency === 'yearly') return sum + r.amount / 12;
        return sum;
      }, 0);
  }, [recurring]);

  // Confronto mese corrente vs precedente
  const monthComparison = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
    
    const currentIncome = transactions.filter((tx) => tx.type === 'income' && tx.date.startsWith(currentMonthKey)).reduce((sum, tx) => sum + tx.amount, 0);
    const currentExpense = transactions.filter((tx) => tx.type === 'expense' && tx.date.startsWith(currentMonthKey)).reduce((sum, tx) => sum + tx.amount, 0);
    const prevIncome = transactions.filter((tx) => tx.type === 'income' && tx.date.startsWith(prevMonthKey)).reduce((sum, tx) => sum + tx.amount, 0);
    const prevExpense = transactions.filter((tx) => tx.type === 'expense' && tx.date.startsWith(prevMonthKey)).reduce((sum, tx) => sum + tx.amount, 0);
    
    return {
      currentIncome,
      currentExpense,
      currentBalance: currentIncome - currentExpense,
      prevIncome,
      prevExpense,
      prevBalance: prevIncome - prevExpense,
      incomeChange: prevIncome > 0 ? ((currentIncome - prevIncome) / prevIncome) * 100 : 0,
      expenseChange: prevExpense > 0 ? ((currentExpense - prevExpense) / prevExpense) * 100 : 0,
    };
  }, [transactions]);

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const isAmountMissing = !amount;
    const isDescMissing = !desc.trim();
    setAmountError(isAmountMissing);
    setDescError(isDescMissing);
    if (isAmountMissing || isDescMissing) return;
    const payload = {
      amount: parseFloat(amount),
      type,
      category,
      description: desc,
      date: new Date(date).toISOString(),
      tags: parseTags(tagsInput),
    };
    if (editingId) {
      await db.transactions.update(editingId, payload);
    } else {
      await db.transactions.add({ userId: user.id, ...payload });
    }
    setAmount('');
    setDesc('');
    setTagsInput('');
    setEditingId(null);
    setAmountError(false);
    setDescError(false);
    const updated = await db.transactions.list(user.id);
    setTransactions(updated);
    setShowQuickAdd(false);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingId(tx.id);
    setAmount(tx.amount.toString());
    setDesc(tx.description);
    setAmountError(false);
    setDescError(false);
    setType(tx.type);
    setCategory(tx.category);
    setTagsInput((tx.tags || []).join(', '));
    setDate(tx.date.slice(0, 10));
  };

  const handleDeleteTransaction = async () => {
    if (!deleteId) return;
    await db.transactions.delete(deleteId);
    const updated = await db.transactions.list(user.id);
    setTransactions(updated);
    setDeleteId(null);
    if (editingId === deleteId) {
      setEditingId(null);
      setAmount('');
      setDesc('');
      setTagsInput('');
    }
  };

  const handleAddBudget = async () => {
    const isAmountMissing = !budgetAmount;
    setBudgetAmountError(isAmountMissing);
    if (isAmountMissing) return;
    await db.financeBudgets.add({
      userId: user.id,
      category: budgetCategory,
      amount: parseFloat(budgetAmount),
      period: 'monthly',
      startMonth: toMonthKey(endDate),
    });
    const updated = await db.financeBudgets.list(user.id);
    setBudgets(updated);
    setBudgetAmount('');
    setBudgetAmountError(false);
  };

  const handleAddGoal = async () => {
    const isNameMissing = !goalName.trim();
    const isTargetMissing = !goalTarget;
    setGoalNameError(isNameMissing);
    setGoalTargetError(isTargetMissing);
    if (isNameMissing || isTargetMissing) return;
    await db.financeGoals.add({
      userId: user.id,
      name: goalName,
      targetAmount: parseFloat(goalTarget),
      currentAmount: parseFloat(goalCurrent || '0'),
      targetDate: goalDate || undefined,
      emoji: goalEmoji || undefined,
    });
    const updated = await db.financeGoals.list(user.id);
    setGoals(updated);
    setGoalName('');
    setGoalTarget('');
    setGoalCurrent('');
    setGoalDate('');
    setGoalEmoji('');
    setGoalNameError(false);
    setGoalTargetError(false);
  };

  const handleAddGoalContribution = async (goal: FinanceGoal, amountValue: number) => {
    if (!amountValue) return;
    const nextAmount = Math.max(0, goal.currentAmount + amountValue);
    await db.financeGoals.update(goal.id, { currentAmount: nextAmount });
    const updated = await db.financeGoals.list(user.id);
    setGoals(updated);
  };

  const handleCustomGoalContribution = async () => {
    if (!goalContributionId || !goalContributionAmount) return;
    const goal = goals.find((g) => g.id === goalContributionId);
    if (!goal) return;
    const amountValue = parseFloat(goalContributionAmount);
    if (isNaN(amountValue)) return;
    await handleAddGoalContribution(goal, amountValue);
    setGoalContributionId(null);
    setGoalContributionAmount('');
  };

  const handleDebtPayment = async () => {
    if (!debtPaymentId || !debtPaymentAmount) return;
    const debt = debts.find((d) => d.id === debtPaymentId);
    if (!debt) return;
    const paymentValue = parseFloat(debtPaymentAmount);
    if (isNaN(paymentValue) || paymentValue <= 0) return;
    
    const newBalance = Math.max(0, debt.balance - paymentValue);
    await db.financeDebts.update(debt.id, { balance: newBalance });
    
    // Registra anche come transazione
    await db.transactions.add({
      userId: user.id,
      amount: paymentValue,
      type: 'expense',
      category: 'other',
      description: `${t('debtPayment', lang)}: ${debt.name}`,
      date: new Date().toISOString(),
      tags: ['debito', debt.name.toLowerCase()],
    });
    
    const [updatedDebts, updatedTxs] = await Promise.all([
      db.financeDebts.list(user.id),
      db.transactions.list(user.id),
    ]);
    setDebts(updatedDebts);
    setTransactions(updatedTxs);
    setDebtPaymentId(null);
    setDebtPaymentAmount('');
  };

  const resetQuickAddForm = useCallback(() => {
    setAmount('');
    setDesc('');
    setType('expense');
    setCategory('food');
    setTagsInput('');
    setDate(new Date().toISOString().split('T')[0]);
    setEditingId(null);
    setAmountError(false);
    setDescError(false);
    setShowQuickAdd(false);
  }, []);

  const handleAddDebt = async () => {
    const isNameMissing = !debtName.trim();
    const isBalanceMissing = !debtBalance;
    setDebtNameError(isNameMissing);
    setDebtBalanceError(isBalanceMissing);
    if (isNameMissing || isBalanceMissing) return;
    await db.financeDebts.add({
      userId: user.id,
      name: debtName,
      balance: parseFloat(debtBalance),
      rate: debtRate ? parseFloat(debtRate) : undefined,
      minPayment: debtMin ? parseFloat(debtMin) : undefined,
      dueDay: debtDueDay ? parseInt(debtDueDay, 10) : undefined,
    });
    const updated = await db.financeDebts.list(user.id);
    setDebts(updated);
    setDebtName('');
    setDebtBalance('');
    setDebtRate('');
    setDebtMin('');
    setDebtDueDay('');
    setDebtNameError(false);
    setDebtBalanceError(false);
  };

  const handleAddRecurring = async () => {
    const isAmountMissing = !recurringAmount;
    const isDescMissing = !recurringDesc.trim();
    setRecurringAmountError(isAmountMissing);
    setRecurringDescError(isDescMissing);
    if (isAmountMissing || isDescMissing) return;
    const startIso = new Date(recurringStartDate).toISOString();
    await db.financeRecurring.add({
      userId: user.id,
      type: recurringType,
      amount: parseFloat(recurringAmount),
      category: recurringCategory,
      description: recurringDesc,
      frequency: recurringFrequency,
      startDate: startIso,
      nextDate: startIso,
      tags: parseTags(recurringTags),
    });
    const updated = await db.financeRecurring.list(user.id);
    setRecurring(updated);
    setRecurringAmount('');
    setRecurringDesc('');
    setRecurringTags('');
    setRecurringAmountError(false);
    setRecurringDescError(false);
  };

  const handleAiInsight = async () => {
    setAiLoading(true);
    const apiKey = await resolveSecretValue(user.apiKey);
    if (!apiKey) {
      setAiTip(t('missingApiKey', lang));
      setAiLoading(false);
      return;
    }
    const topCategories = categoryBreakdown.labels
      .map((label, index) => ({
        label: categoryLabel(label),
        total: categoryBreakdown.values[index] || 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    const budgetAlertSummary = budgetAlerts.map((budget) => ({
      label: categoryLabel(budget.category),
      spent: budget.spent,
      amount: budget.amount,
      pct: budget.pct,
    }));

    const recurringSummary = {
      count: recurring.length,
      incomeCount: recurring.filter((item) => item.type === 'income').length,
      expenseCount: recurring.filter((item) => item.type === 'expense').length,
    };

    const recentTransactions = [...filteredTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((tx) => ({
        date: tx.date,
        type: tx.type,
        category: categoryLabel(tx.category),
        description: tx.description,
        amount: tx.amount,
      }));

    const insight = await askGeminiFinance(apiKey, lang, {
      currency: currencyCode,
      range: { start: startDate, end: endDate },
      stats: {
        rangeIncome: stats.incomeRange,
        rangeExpense: stats.expenseRange,
        rangeBalance: stats.incomeRange - stats.expenseRange,
        savingsRate: stats.savingsRate,
        dailyAverage: stats.dailyAverage,
        currentMonthIncome: stats.currentMonthIncome,
        currentMonthExpense: stats.currentMonthExpense,
        projectedMonthlyExpense: stats.projectedMonthlyExpense,
        totalDebt: stats.totalDebt,
        totalSaved: stats.totalSaved,
        totalGoalTarget: stats.totalGoalTarget,
        debtsCount: debts.length,
        goalsCount: goals.length,
        budgetsCount: budgets.length,
      },
      topCategories,
      budgetAlerts: budgetAlertSummary,
      recurringSummary,
      recentTransactions,
    });
    setAiTip(insight || t('noInsights', lang));
    setAiLoading(false);
  };

  const handleReportAi = () => {
    if (!aiTip) return;
    const formatValue = (value: number) => `${value.toFixed(2)} ${currencyCode}`;
    const formatPct = (value: number) => `${value.toFixed(1)}%`;
    const topCategorySummary = categoryBreakdown.labels
      .map((label, index) => ({
        id: label,
        label: categoryLabel(label),
        total: categoryBreakdown.values[index] || 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .map((item) => `${item.label} (${item.id})=${formatValue(item.total)}`)
      .join('; ') || 'none';
    const budgetAlertSummary = budgetAlerts.length
      ? budgetAlerts
          .map(
            (budget) =>
              `${categoryLabel(budget.category)} (${budget.category}) pct=${formatPct(budget.pct)} spent=${formatValue(budget.spent)} amount=${formatValue(budget.amount)}`
          )
          .join('; ')
      : 'none';
    const recurringIncomeCount = recurring.filter((item) => item.type === 'income').length;
    const recurringExpenseCount = recurring.filter((item) => item.type === 'expense').length;
    const contextLines = [
      `rangeStart=${startDate}`,
      `rangeEnd=${endDate}`,
      `filterType=${filterType}`,
      `filterCategory=${filterCategory}`,
      `filterTag=${filterTag}`,
      `searchTerm=${searchTerm || 'none'}`,
      `currency=${currencyCode}`,
      `transactionsTotal=${transactions.length}`,
      `transactionsFiltered=${filteredTransactions.length}`,
      `incomeRange=${formatValue(stats.incomeRange)}`,
      `expenseRange=${formatValue(stats.expenseRange)}`,
      `balanceRange=${formatValue(stats.incomeRange - stats.expenseRange)}`,
      `savingsRate=${formatPct(stats.savingsRate)}`,
      `dailyAverage=${formatValue(stats.dailyAverage)}`,
      `currentMonthIncome=${formatValue(stats.currentMonthIncome)}`,
      `currentMonthExpense=${formatValue(stats.currentMonthExpense)}`,
      `projectedMonthlyExpense=${formatValue(stats.projectedMonthlyExpense)}`,
      `totalDebt=${formatValue(stats.totalDebt)}`,
      `totalSaved=${formatValue(stats.totalSaved)}`,
      `totalGoalTarget=${formatValue(stats.totalGoalTarget)}`,
      `budgets=${budgets.length}`,
      `debts=${debts.length}`,
      `goals=${goals.length}`,
      `recurringTotal=${recurring.length}`,
      `recurringIncome=${recurringIncomeCount}`,
      `recurringExpense=${recurringExpenseCount}`,
      `topCategories=${topCategorySummary}`,
      `budgetAlerts=${budgetAlertSummary}`,
    ].join('\n');
    const subject = encodeURIComponent(t('reportAiSubject', lang));
    const body = encodeURIComponent(
      `${t('reportAiBody', lang)
        .replace('{content}', aiTip.substring(0, 500))
        .replace('{userId}', user?.id || 'unknown')}\n\nFinance context:\n${contextLines}`
    );
    const mailto = `mailto:kevin@katania.me?subject=${subject}&body=${body}`;
    if (window.katanos?.openExternal) {
      window.katanos.openExternal(mailto);
    } else {
      window.open(mailto);
    }
  };

  const escapeCsvValue = (value: string) => {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const handleExportCsv = () => {
    if (filteredTransactions.length === 0) {
      window.dispatchEvent(new CustomEvent('katanos:notify', {
        detail: {
          title: t('transactions', lang),
          message: t('noTransactions', lang),
          type: 'info',
        },
      }));
      return;
    }

    const headers = [
      t('date', lang),
      t('typeCode', lang),
      t('typeLabel', lang),
      t('categoryId', lang),
      t('categoryLabel', lang),
      t('description', lang),
      t('amount', lang),
      t('currency', lang),
      t('tags', lang),
    ];

    const rows = [...filteredTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map((tx) => [
        tx.date,
        tx.type,
        t(tx.type === 'income' ? 'income' : 'expenses', lang),
        tx.category,
        categoryLabel(tx.category),
        tx.description,
        tx.amount.toFixed(2),
        currencyCode,
        (tx.tags || []).join('; '),
      ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => escapeCsvValue(String(value))).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    link.href = url;
    link.download = `katanos-finance-${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-0 flex flex-col gap-4 animate-fade-in pb-4">
      {/* Header con navigazione tabs */}
      <div className="glass-panel rounded-3xl p-5 md:p-6 flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3">
              <Wallet className="text-emerald-400" /> {t('financeCenterTitle', lang)}
            </h2>
            <p className="text-slate-300 text-sm">{t('financeCenterDesc', lang)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Tab Navigation */}
            <div className="flex bg-slate-900/50 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'overview'
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {t('overview', lang)}
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'transactions'
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {t('transactions', lang)}
              </button>
              <button
                onClick={() => setActiveTab('planning')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'planning'
                    ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                    : 'text-slate-300 hover:bg-white/10'
                }`}
              >
                {t('planning', lang)}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowQuickAdd(true)}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/30 hover:scale-[1.02] transition-transform flex items-center gap-2"
          >
            <Plus size={14} /> {t('quickEntry', lang)}
          </button>
          <button
            onClick={() => {
              const today = new Date();
              const start = new Date();
              start.setDate(today.getDate() - DEFAULT_RANGE_DAYS + 1);
              setStartDate(start.toISOString().split('T')[0]);
              setEndDate(today.toISOString().split('T')[0]);
              setRangePreset('last30');
            }}
            aria-pressed={rangePreset === 'last30'}
            className={`px-4 py-2 rounded-full border text-xs font-bold transition-colors ${
              rangePreset === 'last30'
                ? 'bg-white/20 text-white border-white/30'
                : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
            }`}
          >
            {t('last30Days', lang)}
          </button>
          <button
            onClick={() => {
              const now = new Date();
              const start = new Date(now.getFullYear(), now.getMonth(), 1);
              const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              setStartDate(start.toISOString().split('T')[0]);
              setEndDate(end.toISOString().split('T')[0]);
              setRangePreset('thisMonth');
            }}
            aria-pressed={rangePreset === 'thisMonth'}
            className={`px-4 py-2 rounded-full border text-xs font-bold transition-colors ${
              rangePreset === 'thisMonth'
                ? 'bg-white/20 text-white border-white/30'
                : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/10'
            }`}
          >
            {t('thisMonth', lang)}
          </button>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-full bg-white/10 text-white border border-white/10 text-xs font-bold flex items-center gap-2 hover:bg-white/20"
          >
            <Download size={14} /> {t('exportCsv', lang)}
          </button>
          <button
            onClick={() => setShowFinanceInfo(true)}
            title={t('financeInfoButton', lang)}
            aria-label={t('financeInfoButton', lang)}
            className="px-3 py-2 rounded-full bg-white/10 text-white border border-white/10 text-xs font-bold flex items-center gap-2 hover:bg-white/20"
          >
            <Info size={14} /> {t('financeInfoButton', lang)}
          </button>
          <button
            onClick={handleAiInsight}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-primary to-secondary text-white text-xs font-bold shadow-lg shadow-primary/30 hover:scale-[1.02] transition-transform flex items-center gap-2"
          >
            <Sparkles size={14} /> {aiLoading ? t('analyzing', lang) : t('financeAiInsights', lang)}
          </button>
        </div>

        {/* Alert Budget */}
        {budgetAlerts.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertTriangle className="text-amber-400 shrink-0 mt-0.5" size={18} />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-300">{t('budgetAlertTitle', lang)}</p>
              <p className="text-xs text-amber-200/80 mt-1">
                {budgetAlerts.map((b) => `${categoryLabel(b.category)} (${b.pct.toFixed(0)}%)`).join(', ')}
              </p>
            </div>
          </div>
        )}

        {aiTip && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-slate-200 flex items-start gap-3">
            <Flame className="text-amber-400 mt-0.5 shrink-0" size={18} />
            <div className="flex-1 flex items-start justify-between gap-3">
              <p className="text-slate-200 whitespace-pre-line">{aiTip}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReportAi}
                  className="text-xs flex items-center gap-1 text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                  title={t('reportTooltip', lang)}
                >
                  <Flag size={12} /> {t('report', lang)}
                </button>
                <button onClick={() => setAiTip('')} className="text-slate-400 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Financial Snapshot - Cards principali */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-wide">{t('netWorth', lang)}</p>
              <Scale size={14} className="text-emerald-400" />
            </div>
            <p className={`text-xl font-bold mt-2 ${stats.netWorth >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {formatCurrency(stats.netWorth)}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-slate-300 uppercase font-bold tracking-wide">{t('balance', lang)}</p>
              <Wallet size={14} className="text-sky-400" />
            </div>
            <p className="text-xl font-bold text-white mt-2">{formatCurrency(stats.balance)}</p>
            <p className="text-[10px] text-slate-400 mt-1">{t('allTime', lang)}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-wide">{t('income', lang)}</p>
              <ArrowUp size={14} className="text-emerald-400" />
            </div>
            <p className="text-xl font-bold text-emerald-300 mt-2">{formatCurrency(stats.incomeRange)}</p>
            <p className="text-[10px] text-slate-400 mt-1">{t('inRange', lang)}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-rose-300 uppercase font-bold tracking-wide">{t('expenses', lang)}</p>
              <ArrowDown size={14} className="text-rose-400" />
            </div>
            <p className="text-xl font-bold text-rose-300 mt-2">{formatCurrency(stats.expenseRange)}</p>
            <div className="flex items-center gap-1 mt-1">
              {stats.expenseChange !== 0 && (
                <>
                  {stats.expenseChange > 0 ? (
                    <ArrowUpRight size={12} className="text-rose-400" />
                  ) : (
                    <ArrowDownRight size={12} className="text-emerald-400" />
                  )}
                  <span className={`text-[10px] ${stats.expenseChange > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {Math.abs(stats.expenseChange).toFixed(1)}% {t('vsPrevMonth', lang)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-sky-300 uppercase font-bold tracking-wide">{t('savingsRate', lang)}</p>
              <PiggyBank size={14} className="text-sky-400" />
            </div>
            <p className="text-xl font-bold text-sky-300 mt-2">{stats.savingsRate.toFixed(0)}%</p>
            <p className="text-[10px] text-slate-400 mt-1">{t('inRange', lang)}</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-amber-300 uppercase font-bold tracking-wide">{t('dailyAverage', lang)}</p>
              <Zap size={14} className="text-amber-400" />
            </div>
            <p className="text-xl font-bold text-amber-300 mt-2">{formatCurrency(stats.dailyAverage)}</p>
            <p className="text-[10px] text-slate-400 mt-1">{t('avgExpenseDay', lang)}</p>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <>
          {/* Overview Tab - Charts and Summary */}
          {/* Row 1: Main Cashflow + Month Comparison */}
          <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-4">
            <div className="glass-panel rounded-3xl p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <LineChart size={18} className="text-sky-400" /> {t('cashflowTrend', lang)}
                </h3>
                <div className="text-xs text-slate-400">{t('last30Days', lang)}</div>
              </div>
              <div className="h-64">
                <ChartWrapper
                  type="line"
                  data={cashflowChartData}
                  options={cashflowChartOptions}
                />
              </div>
            </div>

            {/* Month Comparison Card */}
            <div className="glass-panel rounded-3xl p-5 md:p-6">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <Calendar size={16} className="text-indigo-300" /> {t('monthComparison', lang)}
              </h3>
              <div className="space-y-4">
                {/* Current Month */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">{t('currentMonth', lang)}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-bold text-emerald-300">{formatCurrency(monthComparison.currentIncome)}</p>
                      <p className="text-[10px] text-slate-400">{t('income', lang)}</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-rose-300">{formatCurrency(monthComparison.currentExpense)}</p>
                      <p className="text-[10px] text-slate-400">{t('expenses', lang)}</p>
                    </div>
                    <div>
                      <p className={`text-lg font-bold ${monthComparison.currentBalance >= 0 ? 'text-sky-300' : 'text-rose-300'}`}>
                        {formatCurrency(monthComparison.currentBalance)}
                      </p>
                      <p className="text-[10px] text-slate-400">{t('balance', lang)}</p>
                    </div>
                  </div>
                </div>
                
                {/* Previous Month */}
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-2">{t('previousMonth', lang)}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold text-emerald-300/60">{formatCurrency(monthComparison.prevIncome)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-rose-300/60">{formatCurrency(monthComparison.prevExpense)}</p>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${monthComparison.prevBalance >= 0 ? 'text-sky-300/60' : 'text-rose-300/60'}`}>
                        {formatCurrency(monthComparison.prevBalance)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Changes */}
                <div className="flex justify-around">
                  <div className="text-center">
                    <div className={`flex items-center justify-center gap-1 ${monthComparison.incomeChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {monthComparison.incomeChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      <span className="text-sm font-bold">{Math.abs(monthComparison.incomeChange).toFixed(1)}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400">{t('income', lang)}</p>
                  </div>
                  <div className="text-center">
                    <div className={`flex items-center justify-center gap-1 ${monthComparison.expenseChange <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {monthComparison.expenseChange > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      <span className="text-sm font-bold">{Math.abs(monthComparison.expenseChange).toFixed(1)}%</span>
                    </div>
                    <p className="text-[10px] text-slate-400">{t('expenses', lang)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Income/Expense Bars + Category Donut + Balance Trend */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Monthly Income vs Expense Bars */}
            <div className="glass-panel rounded-3xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-indigo-300" /> {t('monthlyTrend', lang)}
              </h4>
              <div className="h-52">
                <ChartWrapper
                  type="bar"
                  data={monthlyChartData}
                  options={monthlyChartOptions}
                />
              </div>
            </div>

            {/* Category Breakdown Donut */}
            <div className="glass-panel rounded-3xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <Coins size={16} className="text-amber-300" /> {t('expenseBreakdown', lang)}
              </h4>
              {categoryBreakdown.values.length > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="relative h-52 flex-1 min-w-0">
                    <ChartWrapper
                      type="doughnut"
                      data={categoryChartData}
                      options={categoryChartOptions}
                    />
                    {/* Center text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center">
                        <p className="text-lg font-bold text-white">{formatCurrency(stats.expenseRange)}</p>
                        <p className="text-[10px] text-slate-400">{t('total', lang)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap sm:flex-col gap-2 text-xs text-slate-200 min-w-[140px]">
                    {categoryLegendItems.map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate">
                          {item.label} ({item.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-sm text-slate-400">
                  {t('noTransactions', lang)}
                </div>
              )}
            </div>

            {/* Monthly Balance Trend */}
            <div className="glass-panel rounded-3xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <TrendingUp size={16} className="text-sky-300" /> {t('balanceTrend', lang)}
              </h4>
              <div className="h-52">
                <ChartWrapper
                  type="line"
                  data={balanceTrendChartData}
                  options={balanceTrendChartOptions}
                />
              </div>
            </div>
          </div>

          {/* Row 3: Net Worth + Category Trend + Budget Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Net Worth Evolution */}
            <div className="glass-panel rounded-3xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <Scale size={16} className="text-purple-400" /> {t('netWorthEvolution', lang)}
              </h4>
              <div className="h-48">
                <ChartWrapper
                  type="line"
                  data={netWorthChartData}
                  options={netWorthChartOptions}
                />
              </div>
            </div>

            {/* Category Spending Trend */}
            <div className="glass-panel rounded-3xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <Flame size={16} className="text-orange-400" /> {t('categoryTrend', lang)}
              </h4>
              {categoryTrend.datasets.length > 0 ? (
                <div className="h-48">
                  <ChartWrapper
                    type="line"
                    data={categoryTrendChartData}
                    options={categoryTrendChartOptions}
                  />
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">
                  {t('noTransactions', lang)}
                </div>
              )}
            </div>

            {/* Budget Status Overview */}
            <div className="glass-panel rounded-3xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <PiggyBank size={16} className="text-emerald-400" /> {t('budgetStatus', lang)}
              </h4>
              {budgetsWithProgress.length > 0 ? (
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {budgetsWithProgress.map((budget) => (
                    <div key={budget.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 truncate max-w-[120px]">{categoryLabel(budget.category)}</span>
                        <span className={budget.isOverBudget ? 'text-rose-400' : 'text-slate-400'}>
                          {budget.pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            budget.pct > 100 ? 'bg-rose-500' : budget.pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, budget.pct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{formatCurrency(budget.spent)}</span>
                        <span>{formatCurrency(budget.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-48 flex flex-col items-center justify-center text-sm text-slate-400">
                  <PiggyBank size={32} className="text-slate-600 mb-2" />
                  <p>{t('noBudgets', lang)}</p>
                  <button
                    onClick={() => setActiveTab('planning')}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    {t('addBudget', lang)}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Side Panels - Recurring, Top Expenses, Goals, Debts */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Recurring Summary */}
            <div className="glass-panel rounded-3xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <Repeat size={16} className="text-indigo-300" /> {t('recurringMonthly', lang)}
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300">{t('recurringIncome', lang)}</span>
                  <span className="text-sm font-bold text-emerald-300">+{formatCurrency(monthlyRecurringIncome)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300">{t('recurringExpense', lang)}</span>
                  <span className="text-sm font-bold text-rose-300">-{formatCurrency(monthlyRecurringExpense)}</span>
                </div>
                <div className="border-t border-white/10 pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-300">{t('netRecurring', lang)}</span>
                    <span className={`text-sm font-bold ${monthlyRecurringIncome - monthlyRecurringExpense >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {formatCurrency(monthlyRecurringIncome - monthlyRecurringExpense)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Expenses */}
            <div className="glass-panel rounded-3xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <TrendingDown size={16} className="text-rose-300" /> {t('topExpenses', lang)}
              </h4>
              {topExpenses.length === 0 ? (
                <p className="text-xs text-slate-400">{t('noTransactions', lang)}</p>
              ) : (
                <div className="space-y-2">
                  {topExpenses.map((tx, idx) => (
                    <div key={tx.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-xs text-slate-200 truncate max-w-[100px]">{tx.description}</span>
                      </div>
                      <span className="text-xs font-bold text-rose-300">{formatCurrency(tx.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Goals Quick View */}
            <div className="glass-panel rounded-3xl p-5">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                <Target size={16} className="text-sky-300" /> {t('goalsProgress', lang)}
              </h4>
              {goalsWithProgress.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-sm text-slate-400">
                  <Target size={28} className="text-slate-600 mb-2" />
                  <p>{t('noGoals', lang)}</p>
                  <button
                    onClick={() => setActiveTab('planning')}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    {t('addGoal', lang)}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {goalsWithProgress.slice(0, 3).map((goal) => (
                    <div key={goal.id} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-300 truncate max-w-[100px]">{goal.emoji} {goal.name}</span>
                        <span className="text-sky-300">{goal.pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div className={`h-full ${goal.pct >= 100 ? 'bg-emerald-400' : 'bg-sky-400'}`} style={{ width: `${goal.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  {goalsWithProgress.length > 3 && (
                    <button
                      onClick={() => setActiveTab('planning')}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      +{goalsWithProgress.length - 3} {t('more', lang)}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Debt Overview + Projected */}
            <div className="glass-panel rounded-3xl p-5">
              {debts.length > 0 ? (
                <>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                    <CreditCard size={16} className="text-rose-300" /> {t('debtOverview', lang)}
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-300">{t('totalDebt', lang)}</span>
                      <span className="text-lg font-bold text-rose-300">{formatCurrency(stats.totalDebt)}</span>
                    </div>
                    <div className="space-y-2">
                      {debts.slice(0, 2).map((debt) => (
                        <div key={debt.id} className="flex justify-between items-center text-xs">
                          <span className="text-slate-400 truncate max-w-[80px]">{debt.name}</span>
                          <span className="text-slate-200">{formatCurrency(debt.balance)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                    <TrendingUp size={16} className="text-amber-300" /> {t('projectedExpense', lang)}
                  </h4>
                  <p className="text-2xl font-bold text-amber-300">{formatCurrency(stats.projectedMonthlyExpense)}</p>
                  <p className="text-[10px] text-slate-400 mt-1">{t('projectedExpenseDesc', lang)}</p>
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-300">{t('avgExpenseDay', lang)}</span>
                      <span className="text-sm font-bold text-slate-200">{formatCurrency(stats.dailyAverage)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'transactions' && (
        <>
          {/* Transactions Tab */}
          <div className="glass-panel rounded-3xl p-5 md:p-6 flex flex-col gap-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar size={18} className="text-indigo-300" /> {t('transactions', lang)}
                <span className="text-xs font-normal text-slate-400 ml-2">
                  ({filteredTransactions.length} {t('results', lang)})
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t('search', lang)}
                  className="bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white min-w-[150px]"
                />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as 'all' | TxType)}
                  className="bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="all">{t('all', lang)}</option>
                  <option value="income">{t('income', lang)}</option>
                  <option value="expense">{t('expenses', lang)}</option>
                </select>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="all">{t('all', lang)}</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="all">{t('allTags', lang)}</option>
                  {allTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300">{t('startDate', lang)}</label>
                <DatePicker
                  value={startDate}
                  onChange={(value) => {
                    setStartDate(value);
                    setRangePreset('custom');
                  }}
                  lang={lang}
                  inputClassName="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-300">{t('endDate', lang)}</label>
                <DatePicker
                  value={endDate}
                  onChange={(value) => {
                    setEndDate(value);
                    setRangePreset('custom');
                  }}
                  lang={lang}
                  inputClassName="w-full bg-slate-900/50 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => loadFinanceData()}
                  className="w-full px-3 py-2 rounded-lg bg-white/10 text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/20"
                >
                  <RefreshCw size={14} /> {t('refresh', lang)}
                </button>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setFilterType('all');
                    setFilterCategory('all');
                    setFilterTag('all');
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10"
                >
                  {t('clearFilters', lang)}
                </button>
              </div>
            </div>

            {/* Transaction Summary for Period */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-emerald-300 uppercase font-bold">{t('periodIncome', lang)}</p>
                <p className="text-lg font-bold text-emerald-300">{formatCurrency(stats.incomeRange)}</p>
              </div>
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-rose-300 uppercase font-bold">{t('periodExpense', lang)}</p>
                <p className="text-lg font-bold text-rose-300">{formatCurrency(stats.expenseRange)}</p>
              </div>
              <div className="bg-sky-500/10 border border-sky-500/20 rounded-xl p-3 text-center">
                <p className="text-[10px] text-sky-300 uppercase font-bold">{t('periodBalance', lang)}</p>
                <p className={`text-lg font-bold ${stats.incomeRange - stats.expenseRange >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {formatCurrency(stats.incomeRange - stats.expenseRange)}
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {filteredTransactions.length === 0 ? (
                <div className="text-sm text-slate-400 text-center py-8">{t('noTransactions', lang)}</div>
              ) : (
                filteredTransactions
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((tx) => (
                    <div
                      key={tx.id}
                      className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3 hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                            tx.type === 'income' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {tx.type === 'income' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm text-white font-semibold truncate">{tx.description}</p>
                          <p className="text-xs text-slate-400">
                            {categoryLabel(tx.category)} · {tx.date.slice(0, 10)}
                          </p>
                          {tx.tags && tx.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tx.tags.map((tag) => (
                                <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-200">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold ${tx.type === 'income' ? 'text-emerald-300' : 'text-rose-300'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                        </span>
                        <button
                          onClick={() => {
                            handleEditTransaction(tx);
                            setShowQuickAdd(true);
                          }}
                          className="p-2 rounded-lg hover:bg-white/10 text-slate-300"
                          title={t('edit', lang)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteId(tx.id)}
                          className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-300"
                          title={t('delete', lang)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'planning' && (
        <>
          {/* Planning Tab - Budgets, Goals, Debts, Recurring */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Budgets */}
            <div className="glass-panel rounded-3xl p-5 md:p-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <PiggyBank size={18} className="text-emerald-300" /> {t('budgets', lang)}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">{t('category', lang)}</label>
                    <select
                      value={budgetCategory}
                      onChange={(e) => setBudgetCategory(e.target.value)}
                      className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <RequiredNumberInput
                    value={budgetAmount}
                    onChange={setBudgetAmount}
                    error={budgetAmountError}
                    onErrorClear={() => setBudgetAmountError(false)}
                    label={t('amount', lang)}
                    labelClassName="text-slate-400"
                    className="flex flex-col gap-1"
                    step={0.01}
                    placeholder={t('amount', lang)}
                    lang={lang}
                    inputClassName="bg-slate-900/50 rounded-xl px-3 py-2 text-white text-sm"
                  />
                  <button
                    onClick={handleAddBudget}
                    className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-sm font-bold hover:bg-emerald-500/30"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {budgetsWithProgress.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">{t('noBudgets', lang)}</p>
                  ) : (
                    budgetsWithProgress.map((budget) => (
                      <div key={budget.id} className={`bg-white/5 border rounded-xl p-3 ${budget.isOverBudget ? 'border-rose-500/50' : 'border-white/10'}`}>
                        <div className="flex justify-between items-center text-xs text-slate-300 mb-2">
                          <span className="font-medium">{categoryLabel(budget.category)}</span>
                          <span className={budget.isOverBudget ? 'text-rose-300' : ''}>
                            {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all ${budget.pct > 90 ? 'bg-rose-400' : budget.pct > 70 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                            style={{ width: `${Math.min(100, budget.pct)}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-[10px] text-slate-400">
                            {budget.isOverBudget 
                              ? `${t('overBudgetBy', lang)} ${formatCurrency(budget.spent - budget.amount)}`
                              : `${t('remaining', lang)}: ${formatCurrency(budget.remaining)}`
                            }
                          </span>
                          <button
                            onClick={async () => {
                              await db.financeBudgets.delete(budget.id);
                              setBudgets(await db.financeBudgets.list(user.id));
                            }}
                            className="text-[10px] text-rose-300 hover:text-rose-200"
                          >
                            {t('delete', lang)}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Goals */}
            <div className="glass-panel rounded-3xl p-5 md:p-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Target size={18} className="text-sky-300" /> {t('goals', lang)}
                {goals.length > 0 && (
                  <span className="text-xs font-normal text-slate-400 ml-2">
                    {formatCurrency(stats.totalSaved)} / {formatCurrency(stats.totalGoalTarget)}
                  </span>
                )}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                    <RequiredInput
                      value={goalName}
                      onChange={setGoalName}
                      error={goalNameError}
                      onErrorClear={() => setGoalNameError(false)}
                      label={t('goalName', lang)}
                      labelClassName="text-slate-400"
                      className="flex flex-col gap-1"
                      inputClassName="bg-slate-900/50 rounded-xl px-3 py-2 text-white text-sm"
                      placeholder={t('goalName', lang)}
                    />
                    <input
                      value={goalEmoji}
                      onChange={(e) => setGoalEmoji(e.target.value)}
                      placeholder="🎯"
                      className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm w-16 text-center"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <RequiredNumberInput
                      value={goalTarget}
                      onChange={setGoalTarget}
                      error={goalTargetError}
                      onErrorClear={() => setGoalTargetError(false)}
                      label={t('goalTarget', lang)}
                      labelClassName="text-slate-400"
                      className="flex flex-col gap-1"
                      step={0.01}
                      placeholder={t('goalTarget', lang)}
                      lang={lang}
                      inputClassName="bg-slate-900/50 rounded-xl px-3 py-2 text-white text-sm"
                    />
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">{t('goalCurrent', lang)}</label>
                      <NumberInput
                        value={goalCurrent}
                        onChange={setGoalCurrent}
                        step={0.01}
                        placeholder={t('goalCurrent', lang)}
                        lang={lang}
                        inputClassName="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-slate-400">{t('date', lang)}</label>
                      <DatePicker
                        value={goalDate}
                        onChange={setGoalDate}
                        lang={lang}
                        placeholder={t('date', lang)}
                        inputClassName="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddGoal}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white text-sm font-bold shadow-lg shadow-sky-500/30 hover:scale-[1.01] transition-transform flex items-center justify-center gap-2"
                  >
                    <Plus size={14} /> {t('addGoal', lang)}
                  </button>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                  {goalsWithProgress.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">{t('noGoals', lang)}</p>
                  ) : (
                    goalsWithProgress.map((goal) => (
                      <div key={goal.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="flex justify-between items-center text-sm text-white mb-1">
                          <span className="font-medium">{goal.emoji ? `${goal.emoji} ` : ''}{goal.name}</span>
                          <span className="text-xs text-slate-300">{goal.pct.toFixed(0)}%</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mb-2">
                          <span>{formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}</span>
                          {goal.daysRemaining !== null && goal.daysRemaining > 0 && (
                            <span>{goal.daysRemaining} {t('daysLeft', lang)}</span>
                          )}
                        </div>
                        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div 
                            className={`h-full transition-all ${goal.pct >= 100 ? 'bg-emerald-400' : 'bg-sky-400'}`} 
                            style={{ width: `${goal.pct}%` }} 
                          />
                        </div>
                        {goal.monthlyNeeded && goal.monthlyNeeded > 0 && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            {t('saveMonthly', lang)}: {formatCurrency(goal.monthlyNeeded)}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2 gap-1">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleAddGoalContribution(goal, 10)}
                              className="text-[10px] px-2 py-1 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                            >
                              +{formatCurrency(10)}
                            </button>
                            <button
                              onClick={() => handleAddGoalContribution(goal, 50)}
                              className="text-[10px] px-2 py-1 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                            >
                              +{formatCurrency(50)}
                            </button>
                            <button
                              onClick={() => {
                                setGoalContributionId(goal.id);
                                setGoalContributionAmount('');
                              }}
                              className="text-[10px] px-2 py-1 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                            >
                              +{t('custom', lang)}
                            </button>
                          </div>
                          <button
                            onClick={async () => {
                              await db.financeGoals.delete(goal.id);
                              setGoals(await db.financeGoals.list(user.id));
                            }}
                            className="text-[10px] text-rose-300 hover:text-rose-200"
                          >
                            {t('delete', lang)}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Debts */}
            <div className="glass-panel rounded-3xl p-5 md:p-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <CreditCard size={18} className="text-rose-300" /> {t('debts', lang)}
                {debts.length > 0 && (
                  <span className="text-xs font-normal text-rose-300 ml-2">
                    {t('total', lang)}: {formatCurrency(stats.totalDebt)}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 -mt-2 mb-3">{t('debtFormHelp', lang)}</p>
              <div className="space-y-3">
                <RequiredInput
                  value={debtName}
                  onChange={setDebtName}
                  error={debtNameError}
                  onErrorClear={() => setDebtNameError(false)}
                  label={t('debtName', lang)}
                  placeholder={t('debtName', lang)}
                  className="space-y-1"
                  inputClassName="w-full bg-slate-900/50 rounded-xl px-3 py-2 text-white text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <RequiredNumberInput
                    value={debtBalance}
                    onChange={setDebtBalance}
                    error={debtBalanceError}
                    onErrorClear={() => setDebtBalanceError(false)}
                    label={t('debtBalance', lang)}
                    className="space-y-1"
                    step={0.01}
                    placeholder={`${t('debtBalance', lang)} (${currencyCode})`}
                    lang={lang}
                    inputClassName="bg-slate-900/50 rounded-xl px-3 py-2 text-white text-sm"
                  />
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-300">{t('debtRate', lang)}</label>
                    <NumberInput
                      value={debtRate}
                      onChange={setDebtRate}
                      step={0.1}
                      placeholder={`${t('debtRate', lang)} (%)`}
                      lang={lang}
                      inputClassName="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-300">{t('debtMin', lang)}</label>
                    <NumberInput
                      value={debtMin}
                      onChange={setDebtMin}
                      step={0.01}
                      placeholder={`${t('debtMin', lang)} (${currencyCode})`}
                      lang={lang}
                      inputClassName="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-300">{t('debtDueDay', lang)}</label>
                    <NumberInput
                      value={debtDueDay}
                      onChange={setDebtDueDay}
                      step={1}
                      min={1}
                      max={31}
                      placeholder={`${t('debtDueDay', lang)} (1-31)`}
                      lang={lang}
                      inputClassName="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAddDebt}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-rose-500 to-orange-400 text-white text-sm font-bold shadow-lg shadow-rose-500/30 hover:scale-[1.01] transition-transform flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> {t('addDebt', lang)}
                </button>

                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {debts.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">{t('noDebts', lang)}</p>
                  ) : (
                    debts.map((debt) => (
                      <div key={debt.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="flex justify-between items-center text-sm text-white">
                          <span className="font-medium">{debt.name}</span>
                          <span className="text-rose-300 font-bold">{formatCurrency(debt.balance)}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                          <span>
                            {debt.rate ? `${debt.rate}% APR` : t('noRate', lang)}
                            {debt.minPayment ? ` · ${t('min', lang)}: ${formatCurrency(debt.minPayment)}` : ''}
                          </span>
                          {debt.dueDay && <span>{t('dueDay', lang)}: {debt.dueDay}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-2 gap-1">
                          <button
                            onClick={() => {
                              setDebtPaymentId(debt.id);
                              setDebtPaymentAmount(debt.minPayment?.toString() || '');
                            }}
                            className="text-[10px] px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 flex items-center gap-1"
                          >
                            <Minus size={10} /> {t('makePayment', lang)}
                          </button>
                          <button
                            onClick={async () => {
                              await db.financeDebts.delete(debt.id);
                              setDebts(await db.financeDebts.list(user.id));
                            }}
                            className="text-[10px] text-rose-300 hover:text-rose-200"
                          >
                            {t('delete', lang)}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Recurring */}
            <div className="glass-panel rounded-3xl p-5 md:p-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                <Repeat size={18} className="text-indigo-300" /> {t('recurring', lang)}
              </h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 items-end">
                  <RequiredNumberInput
                    value={recurringAmount}
                    onChange={setRecurringAmount}
                    error={recurringAmountError}
                    onErrorClear={() => setRecurringAmountError(false)}
                    label={t('amount', lang)}
                    labelClassName="text-slate-400"
                    className="flex flex-col gap-1"
                    step={0.01}
                    placeholder={t('amount', lang)}
                    lang={lang}
                    inputClassName="bg-slate-900/50 rounded-xl px-3 py-2 text-white text-sm"
                  />
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400">{t('type', lang)}</label>
                    <select
                      value={recurringType}
                      onChange={(e) => setRecurringType(e.target.value as TxType)}
                      className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    >
                      <option value="expense">{t('expenses', lang)}</option>
                      <option value="income">{t('income', lang)}</option>
                    </select>
                  </div>
                </div>
                <RequiredInput
                  value={recurringDesc}
                  onChange={setRecurringDesc}
                  error={recurringDescError}
                  onErrorClear={() => setRecurringDescError(false)}
                  label={t('description', lang)}
                  placeholder={t('description', lang)}
                  labelClassName="text-slate-400"
                  className="flex flex-col gap-1"
                  inputClassName="w-full bg-slate-900/50 rounded-xl px-3 py-2 text-white text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={recurringCategory}
                    onChange={(e) => setRecurringCategory(e.target.value)}
                    className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={recurringFrequency}
                    onChange={(e) => setRecurringFrequency(e.target.value as Frequency)}
                    className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                  >
                    <option value="weekly">{t('weekly', lang)}</option>
                    <option value="monthly">{t('monthly', lang)}</option>
                    <option value="yearly">{t('yearly', lang)}</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <DatePicker
                      value={recurringStartDate}
                      onChange={setRecurringStartDate}
                      lang={lang}
                      placeholder={t('date', lang)}
                      allowClear={false}
                      inputClassName="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                    />
                  <input
                    value={recurringTags}
                    onChange={(e) => setRecurringTags(e.target.value)}
                    placeholder={t('tagsPlaceholder', lang)}
                    className="bg-slate-900/50 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                  />
                </div>
                <button
                  onClick={handleAddRecurring}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-500/30 hover:scale-[1.01] transition-transform flex items-center justify-center gap-2"
                >
                  <Plus size={14} /> {t('addRecurring', lang)}
                </button>

                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {recurring.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">{t('noRecurring', lang)}</p>
                  ) : (
                    recurring.map((item) => (
                      <div key={item.id} className="bg-white/5 border border-white/10 rounded-xl p-3">
                        <div className="flex justify-between items-center text-sm text-white">
                          <span className="font-medium truncate max-w-[150px]">{item.description}</span>
                          <span className={item.type === 'income' ? 'text-emerald-300' : 'text-rose-300'}>
                            {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                          <span>{categoryLabel(item.category)} · {t(item.frequency, lang)}</span>
                          <span>{t('nextRun', lang)}: {item.nextDate.slice(0, 10)}</span>
                        </div>
                        <button
                          onClick={async () => {
                            await db.financeRecurring.delete(item.id);
                            setRecurring(await db.financeRecurring.list(user.id));
                          }}
                          className="mt-2 text-[10px] text-rose-300 hover:text-rose-200"
                        >
                          {t('delete', lang)}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Finance Info Modal */}
      {showFinanceInfo && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-slate-900/95 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Info size={18} className="text-indigo-300" />
                  {t('financeInfoTitle', lang)}
                </h3>
                <button onClick={() => setShowFinanceInfo(false)} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-line">{t('financeInfoBody', lang)}</p>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Quick Add Modal */}
      {showQuickAdd && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-slate-900/95 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus size={18} className="text-emerald-300" />
                  {editingId ? t('updateEntry', lang) : t('quickEntry', lang)}
                </h3>
                <button onClick={resetQuickAddForm} className="text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddTransaction} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <RequiredNumberInput
                    value={amount}
                    onChange={setAmount}
                    error={amountError}
                    onErrorClear={() => setAmountError(false)}
                    label={t('amount', lang)}
                    labelClassName="text-slate-300"
                    className="flex flex-col gap-1"
                    step={0.01}
                    lang={lang}
                    inputClassName="w-full bg-slate-800/50 rounded-xl px-3 py-2 text-white"
                    autoFocus
                  />
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-300">{t('date', lang)}</label>
                    <DatePicker
                      value={date}
                      onChange={setDate}
                      lang={lang}
                      allowClear={false}
                      inputClassName="w-full bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>
                <RequiredInput
                  value={desc}
                  onChange={setDesc}
                  error={descError}
                  onErrorClear={() => setDescError(false)}
                  label={t('description', lang)}
                  labelClassName="text-slate-300"
                  className="flex flex-col gap-1"
                  inputClassName="w-full bg-slate-800/50 rounded-xl px-3 py-2 text-white"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-300">{t('type', lang)}</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as TxType)}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-white"
                    >
                      <option value="expense">{t('expenses', lang)}</option>
                      <option value="income">{t('income', lang)}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-300">{t('category', lang)}</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-white"
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-300">{t('tags', lang)}</label>
                  <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder={t('tagsPlaceholder', lang)}
                    className="w-full bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetQuickAddForm}
                    className="flex-1 py-2.5 rounded-xl bg-white/10 text-slate-200 font-bold"
                  >
                    {t('cancel', lang)}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 text-white font-bold shadow-lg shadow-emerald-500/30"
                  >
                    {editingId ? t('updateEntry', lang) : t('addEntry', lang)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Goal Contribution Modal */}
      {goalContributionId && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-slate-900/95 border border-white/10 rounded-2xl p-6 w-full max-w-xs">
              <h3 className="text-lg font-bold text-white mb-4">{t('addContribution', lang)}</h3>
              <NumberInput
                value={goalContributionAmount}
                onChange={setGoalContributionAmount}
                step={0.01}
                placeholder={t('amount', lang)}
                lang={lang}
                className="mb-4"
                inputClassName="w-full bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-white"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setGoalContributionId(null)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-slate-200 text-sm"
                >
                  {t('cancel', lang)}
                </button>
                <button
                  onClick={handleCustomGoalContribution}
                  className="flex-1 px-4 py-2 rounded-lg bg-sky-500 text-white text-sm"
                >
                  {t('add', lang)}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Debt Payment Modal */}
      {debtPaymentId && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-slate-900/95 border border-white/10 rounded-2xl p-6 w-full max-w-xs">
              <h3 className="text-lg font-bold text-white mb-4">{t('makePayment', lang)}</h3>
              <NumberInput
                value={debtPaymentAmount}
                onChange={setDebtPaymentAmount}
                step={0.01}
                placeholder={t('amount', lang)}
                lang={lang}
                className="mb-4"
                inputClassName="w-full bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2 text-white"
                autoFocus
              />
              <p className="text-[10px] text-slate-400 mb-4">{t('debtPaymentNote', lang)}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDebtPaymentId(null)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-slate-200 text-sm"
                >
                  {t('cancel', lang)}
                </button>
                <button
                  onClick={handleDebtPayment}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm"
                >
                  {t('pay', lang)}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <ModalPortal>
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <div className="bg-slate-900/95 border border-white/10 rounded-2xl p-6 w-full max-w-sm">
              <h3 className="text-lg font-bold text-white mb-2">{t('confirmDelete', lang)}</h3>
              <p className="text-sm text-slate-300 mb-4">{t('actionCannotBeUndone', lang)}</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 rounded-lg bg-white/10 text-slate-200 text-sm"
                >
                  {t('cancel', lang)}
                </button>
                <button
                  onClick={handleDeleteTransaction}
                  className="px-4 py-2 rounded-lg bg-rose-500 text-white text-sm"
                >
                  {t('delete', lang)}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
};

export default Finance;
