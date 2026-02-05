
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from "../types";
import { t } from "./translations";

export interface PlaceResult {
    title: string;
    uri: string;
}

interface GroundingChunk {
    web?: { uri?: string; title?: string };
    maps?: { uri?: string; title?: string };
}

export interface ParsedCalendarEvent {
    title: string;
    start: string;
    end: string;
    location?: string | null;
    description?: string | null;
    type: string;
}

export const askGeminiPlaces = async (query: string, apiKey: string, lang: string, userLat?: number, userLon?: number): Promise<{ answer: string; places: PlaceResult[] }> => {
    if (!apiKey) return { answer: t('ai_apiKeyMissing', lang), places: [] };

    try {
        const ai = new GoogleGenAI({ apiKey });
        // NOTE: Grounding with Google Maps is currently best supported on 2.5 models.
        const model = 'gemini-2.5-flash';

        const toolConfig = (userLat && userLon) ? {
            retrievalConfig: {
                latLng: {
                    latitude: userLat,
                    longitude: userLon
                }
            }
        } : undefined;

        // Enforce language in the prompt
        const prompt = `
        System: You are a helpful location assistant. 
        IMPORTANT: You MUST answer strictly in the following language: ${lang}.
        User Query: ${query}
        `;

        const response = await ai.models.generateContent({
            model: model,
            contents: prompt,
            config: {
                tools: [{ googleMaps: {} }],
                toolConfig: toolConfig,
            }
        });

        const text = response.text || t('ai_noResponse', lang);

        // Extract grounding chunks for map links
        const candidates = response.candidates;
        const places: PlaceResult[] = [];

        if (candidates && candidates[0]?.groundingMetadata?.groundingChunks) {
            (candidates[0].groundingMetadata.groundingChunks as GroundingChunk[]).forEach((chunk) => {
                if (chunk.web?.uri && chunk.web?.title) {
                    places.push({ title: chunk.web.title, uri: chunk.web.uri });
                }
                if (chunk.maps?.uri && chunk.maps?.title) {
                    places.push({ title: chunk.maps.title, uri: chunk.maps.uri });
                }
            });
        }

        return { answer: text, places };

    } catch (error) {
        console.error("Gemini API Error:", error);
        return { answer: t('ai_apiError', lang), places: [] };
    }
};

export interface FinanceInsightContext {
    currency: string;
    range: { start: string; end: string };
    stats: {
        rangeIncome: number;
        rangeExpense: number;
        rangeBalance: number;
        savingsRate: number;
        dailyAverage: number;
        currentMonthIncome: number;
        currentMonthExpense: number;
        projectedMonthlyExpense: number;
        totalDebt: number;
        totalSaved: number;
        totalGoalTarget: number;
        debtsCount: number;
        goalsCount: number;
        budgetsCount: number;
    };
    topCategories: { label: string; total: number }[];
    budgetAlerts: { label: string; spent: number; amount: number; pct: number }[];
    recurringSummary: { count: number; incomeCount: number; expenseCount: number };
    recentTransactions: Array<Pick<Transaction, 'date' | 'type' | 'category' | 'amount' | 'description'>>;
}

export const askGeminiFinance = async (
    apiKey: string,
    lang: string,
    context: FinanceInsightContext
): Promise<string> => {
    if (!apiKey) return "";

    try {
        const ai = new GoogleGenAI({ apiKey });
        const currency = context.currency;
        const notAvailable = t('notAvailable', lang);
        const insufficient = t('insufficientData', lang);
        const hasData =
            context.stats.rangeIncome > 0 ||
            context.stats.rangeExpense > 0 ||
            context.stats.totalDebt > 0 ||
            context.stats.totalSaved > 0 ||
            context.stats.totalGoalTarget > 0 ||
            context.stats.debtsCount > 0 ||
            context.stats.goalsCount > 0 ||
            context.stats.budgetsCount > 0 ||
            context.recurringSummary.count > 0 ||
            context.recentTransactions.length > 0;

        if (!hasData) {
            return t('advisorStatic', lang);
        }

        const formatAmount = (value: number) => Number.isFinite(value) ? value.toFixed(2) : '0.00';
        const formatPct = (value: number) => Number.isFinite(value) ? value.toFixed(1) : '0.0';
        const truncate = (value: string, max = 40) => {
            if (!value) return '';
            return value.length > max ? `${value.slice(0, max - 3)}...` : value;
        };

        const topCategories = context.topCategories.length > 0
            ? context.topCategories.map((item) => `${item.label} ${formatAmount(item.total)} ${currency}`).join('; ')
            : notAvailable;

        const budgetAlerts = context.budgetAlerts.length > 0
            ? context.budgetAlerts.map((item) => `${item.label} ${formatPct(item.pct)}% (${formatAmount(item.spent)}/${formatAmount(item.amount)} ${currency})`).join('; ')
            : notAvailable;

        const recentTx = context.recentTransactions.length > 0
            ? context.recentTransactions
                .map((tx) => `${tx.date.slice(0, 10)} ${tx.type} ${tx.category} ${formatAmount(tx.amount)} ${currency} - ${truncate(tx.description)}`)
                .join('; ')
            : notAvailable;

        const prompt = `
You are "KatanOS Finance Coach".
Output language: ${lang} (it/en/fr/es/de). Reply only in that language.
Your job: produce professional, concrete coaching suggestions based strictly on the data provided below.

Output format (strict):
- Return a single line.
- Produce 3 to 5 suggestions (default 4 unless rules force fewer).
- Separate suggestions with " | ".
- Each suggestion must include: Action + Reason (explicitly tied to the provided data) + Next step (specific and time-bound).
- Keep each suggestion concise (one sentence, max ~25–30 words). No “papelli”, but not “mezza riga”.
- Use ${currency} for all money amounts.
- Use numbers only when they directly justify the advice (negative balance, overspend gap, debt/goal gap, projection delta, alert amount, recurring count).
- Do not provide a recap. Do not list all numbers. Do not add headings, bullets, or extra sections. Do not ask questions.
- No jokes, no emojis. Do not mention you are an AI.
- If data is insufficient to give actionable advice, reply exactly: "${insufficient}".

Decision & relevance rules (apply in order, do not skip):
1) If rangeBalance < 0 OR savingsRate < 0: first suggestion must focus on immediate cashflow correction (cut expenses and/or increase income), referencing the top spending drivers from ${topCategories} and/or recurring expenses.
2) If budget alerts exist: include one suggestion that targets the single highest alert category from ${budgetAlerts}, with a concrete cap/rule/substitution.
3) If projectedMonthlyExpense > currentMonthExpense: include one suggestion to set a remaining-month spending cap and add a tracking step tied to daily/weekly behavior (use dailyAverage only if it strengthens the reasoning).
4) If totalDebt > 0: include one suggestion for debt payoff with a clear method and a concrete extra-payment rule (amount or % tied to available cashflow).
5) If totalGoalTarget > totalSaved: include one suggestion for goal contributions with an automatic transfer rule (amount + trigger like payday/weekly), tied to the gap.
6) If recurringSummary.count is high OR recurringSummary.expenseCount is high: include one suggestion to audit recurring items (cancel/downgrade/annualize), with a concrete next action and deadline.
7) If more than 5 suggestions would be triggered, prioritize in this order: (1) cashflow, (2) highest budget alert, (3) projection control, (4) debt, (5) goals, (6) recurring audit.

Quality constraints (must follow):
- Be decisive and practical: start each suggestion with a strong verb (“Imposta”, “Riduci”, “Automatizza”, “Rinegozia”, “Estingui”).
- Tie each Reason to at least one specific provided field (rangeBalance, savingsRate, projected vs current, totalDebt, goals gap, alerts, recurring count, top categories, recentTx).
- When referencing categories, use the exact names as provided in ${topCategories} or ${budgetAlerts}.
- You may reference a single standout from ${recentTx} only if it clearly indicates a controllable driver (fee, duplicate, subscription, spike); do not summarize the list.

Data range: ${context.range.start} to ${context.range.end}
Range income: ${formatAmount(context.stats.rangeIncome)} ${currency}
Range expense: ${formatAmount(context.stats.rangeExpense)} ${currency}
Range balance: ${formatAmount(context.stats.rangeBalance)} ${currency}
Savings rate: ${formatPct(context.stats.savingsRate)}%
Daily avg expense: ${formatAmount(context.stats.dailyAverage)} ${currency}
Current month income: ${formatAmount(context.stats.currentMonthIncome)} ${currency}
Current month expense: ${formatAmount(context.stats.currentMonthExpense)} ${currency}
Projected month expense: ${formatAmount(context.stats.projectedMonthlyExpense)} ${currency}
Debts total: ${formatAmount(context.stats.totalDebt)} ${currency} (count ${context.stats.debtsCount})
Goals saved/target: ${formatAmount(context.stats.totalSaved)}/${formatAmount(context.stats.totalGoalTarget)} ${currency} (count ${context.stats.goalsCount})
Budgets count: ${context.stats.budgetsCount}; Alerts: ${budgetAlerts}
Top expense categories: ${topCategories}
Recurring: ${context.recurringSummary.incomeCount} income, ${context.recurringSummary.expenseCount} expense (total ${context.recurringSummary.count})
Recent transactions: ${recentTx}
`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
        });

        return response.text || t('ai_adviceUnavailable', lang);
    } catch (error) {
        console.error("Gemini Finance Error", error);
        return t('ai_connectionError', lang);
    }
};

export const analyzeJournalEntry = async (apiKey: string, lang: string, text: string): Promise<{ mood: string, reflection: string }> => {
    if (!apiKey) return { mood: 'neutral', reflection: t('ai_apiKeyMissing', lang) };

    try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Analyze this journal entry. Output JSON.
            1. 'mood': one of ['happy', 'neutral', 'sad', 'stressed', 'energetic'].
            2. 'reflection': A short, philosophical, deep insight or question based on the text (max 20 words).
            LANGUAGE: ${lang}.
            Entry: "${text}"`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        mood: { type: Type.STRING },
                        reflection: { type: Type.STRING }
                    }
                }
            }
        });

        const result = JSON.parse(response.text || '{}');
        return {
            mood: result.mood || 'neutral',
            reflection: result.reflection || '...'
        };
    } catch (e) {
        console.error("Journal AI Error", e);
        return { mood: 'neutral', reflection: t('ai_journalError', lang) };
    }
};

export const parseCalendarEvent = async (apiKey: string, lang: string, text: string): Promise<ParsedCalendarEvent | null> => {
    if (!apiKey) return null;

    try {
        const ai = new GoogleGenAI({ apiKey });
        const now = new Date().toISOString();

        const prompt = `
            Extract calendar event details from this text: "${text}".
            Current Date/Time: ${now}.
            Output JSON ONLY with these fields:
            - title (string)
            - start (ISO 8601 string, e.g. 2024-01-01T10:00:00)
            - end (ISO 8601 string). If duration not specified, assume 1 hour.
            - location (string or null)
            - description (string or null)
            - type (one of: 'meeting', 'work', 'personal', 'vacation', 'health'). Default to 'personal'.
            
            Language: ${lang}.
        `;

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
            config: {
                responseMimeType: "application/json"
            }
        });

        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Gemini Event Parse Error", error);
        return null;
    }
};
