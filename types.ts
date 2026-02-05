
export interface Book {
  id: string;
  userId: string;
  title: string;
  author: string;
  cover?: string;
  status: 'tobuy' | 'toread' | 'read';
  rating?: number; // 1-5
  addedAt: string; // ISO string
  notes?: string; // Personal notes/comments
  pageCount?: number;
  currentPage?: number; // Current reading progress
  description?: string;
  categories?: string[];
  startedAt?: string; // ISO string - when user started reading
  finishedAt?: string; // ISO string - when user finished reading
  sortOrder?: number; // Manual order within status list (lower = higher in list)
}

export interface CalendarCategory {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  icon?: string; // Legacy icon id for older data
  isDefault?: boolean;
}

export type BackupInterval = '30m' | '1h' | '6h' | '12h' | '24h' | 'daily' | 'weekly' | 'monthly';

export interface BackupSettings {
  enabled: boolean;
  folderPath: string;
  interval: BackupInterval;
  retentionMode: 'count' | 'days';
  retentionValue: number;
  runOnStartup: boolean;
  lastBackupAt: string | null;
  lastBackupStatus: 'success' | 'failed' | null;
}

export type ModuleId =
  | 'calendar'
  | 'contacts'
  | 'todo'
  | 'journal'
  | 'habits'
  | 'finance'
  | 'bookshelf'
  | 'vault'
  | 'games';

export type WidgetId =
  | 'clock'
  | 'weather'
  | 'quote'
  | 'nextEvent'
  | 'todayEvents'
  | 'favorites'
  | 'financeOverview'
  | 'pomodoro';

export interface WidgetConfig {
  id: WidgetId;
  enabled: boolean;
  order: number;
}

export interface DashboardLayout {
  version: string;
  widgets: WidgetConfig[];
}

export interface User {
  id: string;
  username: string;
  password?: string;
  securityQuestionId?: string;
  securityAnswer?: string;
  avatar?: string;
  currency?: string; // e.g., 'EUR', 'USD'
  language?: string; // e.g., 'it', 'en', 'fr'
  apiKey?: string; // Google Gemini API Key
  notificationAdvance?: number; // Minutes before event to notify
  soundEnabled?: boolean; // Master switch for all app sounds
  clockUse12h?: boolean; // Show clock in 12h format with AM/PM
  seasonalEffect?: 'none' | 'snow' | 'leaves' | 'blossom' | 'fireflies';
  theme?: string; // Visual theme preset id
  lockEnabled?: boolean; // Require PIN on startup/idle
  lockPin?: string; // Hashed PIN
  lockTimeoutMinutes?: number; // Minutes of inactivity before lock
  financeCategories?: string[]; // Custom finance categories
  calendarCategories?: CalendarCategory[]; // Custom calendar categories
  journalMoods?: JournalMood[]; // Custom journal moods
  appBackground?: string; // Custom background image for the app
  loginBackground?: string; // Custom background image for the login screen
  // Module Configuration (per-profile)
  modulesConfig?: Record<ModuleId, boolean>;
  // Dashboard Layout Configuration
  dashboardLayout?: DashboardLayout;
  // Backup Settings (per-profile)
  backupSettings?: BackupSettings;
}

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  location?: string;
  start: string; // ISO string
  end: string; // ISO string
  type: string;
  color: string;
}

export interface TodoItem {
  id: string;
  userId: string;
  text: string;
  isCompleted: boolean;
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  createdAt: string;
  x: number; // Required for drag/drop
  y: number; // Required for drag/drop
  rotation?: number;
}

export interface ChecklistItem {
  id: string;
  text: string;
  isChecked: boolean;
  order: number;
}

export interface Checklist {
  id: string;
  userId: string;
  title: string;
  items: ChecklistItem[];
  color: 'yellow' | 'blue' | 'green' | 'pink' | 'purple';
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  date: string;
  description: string;
  tags?: string[];
}

export interface FinanceBudget {
  id: string;
  userId: string;
  category: string;
  amount: number;
  period: 'monthly';
  startMonth?: string; // YYYY-MM
}

export interface FinanceGoal {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  emoji?: string;
}

export interface FinanceDebt {
  id: string;
  userId: string;
  name: string;
  balance: number;
  rate?: number;
  minPayment?: number;
  dueDay?: number;
}

export interface FinanceRecurring {
  id: string;
  userId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  frequency: 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  nextDate: string;
  tags?: string[];
}

export interface Contact {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email: string;
  isFavorite: boolean;
  avatar?: string;
  tags?: string[];
  notes?: string;
  birthday?: string; // ISO string YYYY-MM-DD
  address?: string;
  socials?: {
    linkedin?: string;
    instagram?: string;
    twitter?: string;
    website?: string;
  };
  lastInteraction?: string; // ISO string
  createdAt?: string;
  updatedAt?: string;
}

export interface Habit {
  id: string;
  userId: string;
  title: string;
  color: string;
  logs: string[]; // Array of ISO date strings (YYYY-MM-DD) representing completion
  skips?: string[]; // Array of ISO date strings (YYYY-MM-DD) representing skipped days
  createdAt: string;
  icon?: string;
}

export interface JournalEntry {
  id: string;
  userId: string;
  date: string; // ISO string
  content: string;
  mood?: string; // Mood id (defaults or custom)
  aiReflection?: string;
}

export interface JournalMood {
  id: string;
  label: string;
  emoji: string;
}

export interface DailyForecast {
  date: string;
  maxTemp: number;
  minTemp: number;
  weatherCode: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherData {
  currentTemp: number;
  currentCode: number;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  daily: DailyForecast[];
  city?: string;
  isDay?: number; // 0 = Night, 1 = Day
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'alert' | 'success';
}

export interface VaultItem {
  id: string;
  type: 'login' | 'note' | 'card';
  name: string;
  username?: string;
  password?: string;
  url?: string;
  notes?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
  cardPin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedVault {
  userId: string;
  // The actual data encrypted with the Master Key
  dataIV: string;   // Base64
  data: string;     // Base64 (Encrypted JSON of VaultItem[])

  // The Master Key encrypted with the User's Password
  wrappedKeySalt: string; // Base64
  wrappedKeyIV: string;   // Base64
  wrappedKey: string;     // Base64

  // The Master Key encrypted with the Recovery Code
  recoverySalt: string; // Base64
  recoveryIV: string;   // Base64
  recoveryKey: string;  // Base64
}
