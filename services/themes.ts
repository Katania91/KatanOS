export type ThemeOption = {
  id: string;
  labelKey: string;
  preview: string;
  primary: string;
  secondary: string;
};

export const DEFAULT_THEME_ID = 'default';

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'default',
    labelKey: 'themeDefault',
    preview: 'linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #111827 100%)',
    primary: '#6366f1',
    secondary: '#ec4899',
  },
  {
    id: 'cyberpunk',
    labelKey: 'themeCyberpunk',
    preview: 'linear-gradient(135deg, #0b1020 0%, #1e1b4b 45%, #db2777 100%)',
    primary: '#db2777',
    secondary: '#22d3ee',
  },
  {
    id: 'zen',
    labelKey: 'themeZen',
    preview: 'linear-gradient(135deg, #0f172a 0%, #0f766e 50%, #22c55e 100%)',
    primary: '#22c55e',
    secondary: '#14b8a6',
  },
  {
    id: 'space',
    labelKey: 'themeSpace',
    preview: 'radial-gradient(circle at 20% 20%, #312e81 0%, #0f172a 55%, #020617 100%)',
    primary: '#3b82f6',
    secondary: '#a855f7',
  },
  {
    id: 'sunset',
    labelKey: 'themeSunset',
    preview: 'linear-gradient(135deg, #4c1d95 0%, #c026d3 50%, #f97316 100%)',
    primary: '#f97316',
    secondary: '#fb7185',
  },
  {
    id: 'ocean',
    labelKey: 'themeOcean',
    preview: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 50%, #22d3ee 100%)',
    primary: '#22d3ee',
    secondary: '#38bdf8',
  },
  {
    id: 'royal',
    labelKey: 'themeRoyal',
    preview: 'linear-gradient(135deg, #2e1065 0%, #7e22ce 35%, #fbbf24 100%)',
    primary: '#a855f7',
    secondary: '#fbbf24',
  },
  {
    id: 'crimson',
    labelKey: 'themeCrimson',
    preview: 'linear-gradient(135deg, #450a0a 0%, #991b1b 50%, #ef4444 100%)',
    primary: '#ef4444',
    secondary: '#f87171',
  },
];

export const getThemeOption = (id?: string) =>
  THEME_OPTIONS.find((option) => option.id === id) || THEME_OPTIONS[0];
