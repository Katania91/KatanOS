
import { User, CalendarEvent, TodoItem, Checklist, Transaction, Contact, Habit, JournalEntry, Book, EncryptedVault, FinanceBudget, FinanceGoal, FinanceDebt, FinanceRecurring } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { buildAvatarDataUri } from './avatar';
import { encryptSecretValue, isEncryptedSecret } from './secrets';
import { t } from './translations';
import { initStorage, storageGetRaw, storageRemoveRaw, storageSetRaw } from './storage';

/** Backup payload type for restore() */
export interface BackupPayload {
  version?: string;
  timestamp?: string;
  userId?: string | null;
  currentUser?: User | null;
  scope?: 'all' | 'user';
  data?: {
    users?: User[];
    events?: CalendarEvent[];
    todos?: TodoItem[];
    checklists?: Checklist[];
    transactions?: Transaction[];
    financeBudgets?: FinanceBudget[];
    financeGoals?: FinanceGoal[];
    financeDebts?: FinanceDebt[];
    financeRecurring?: FinanceRecurring[];
    contacts?: Contact[];
    habits?: Habit[];
    journal?: JournalEntry[];
    books?: Book[];
    vault?: EncryptedVault[];
  };
  extras?: {
    weatherLocations?: Record<string, unknown>;
    cloudBackups?: Record<string, unknown>;
    appLocalStorage?: Record<string, unknown>;
  };
}

const DATA_KEYS = {
  USERS: 'chronos_users',
  EVENTS: 'chronos_events',
  TODOS: 'chronos_todos',
  CHECKLISTS: 'chronos_checklists',
  TRANSACTIONS: 'chronos_transactions',
  FINANCE_BUDGETS: 'chronos_finance_budgets',
  FINANCE_GOALS: 'chronos_finance_goals',
  FINANCE_DEBTS: 'chronos_finance_debts',
  FINANCE_RECURRING: 'chronos_finance_recurring',
  CONTACTS: 'chronos_contacts',
  HABITS: 'chronos_habits',
  JOURNAL: 'chronos_journal',
  BOOKS: 'chronos_books',
  VAULT: 'chronos_vault',
  CURRENT_USER: 'chronos_current_user'
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const PASSWORD_HASH_PREFIX = 'pbkdf2';
const PBKDF2_ITERATIONS = 150000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_HASH_BYTES = 32;
const textEncoder = new TextEncoder();
let lastStorageFullNotifyAt = 0;

const notifyStorageFull = () => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastStorageFullNotifyAt < 8000) return;
  lastStorageFullNotifyAt = now;
  const lang = getCurrentUserValue()?.language || 'it';
  window.dispatchEvent(
    new CustomEvent('katanos:notify', {
      detail: {
        title: t('storageFullTitle', lang) || 'Storage full',
        message: t('storageFullMessage', lang) || 'Storage is full.',
        type: 'warning',
        duration: 9000,
      },
    })
  );
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const fromBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const isHashedValue = (value?: string) => typeof value === 'string' && value.startsWith(`${PASSWORD_HASH_PREFIX}$`);

const normalizeSecurityAnswer = (value: string) => value.trim().toLowerCase();
const normalizePin = (value: string) => value.replace(/\D/g, '');

const getCryptoSubtle = () => {
  if (typeof window === 'undefined') return null;
  if (!window.crypto?.subtle || typeof window.crypto.getRandomValues !== 'function') return null;
  return window.crypto.subtle;
};

const timingSafeEqual = (left: Uint8Array, right: Uint8Array) => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) {
    diff |= left[i] ^ right[i];
  }
  return diff === 0;
};

const hashWithWebCrypto = async (secret: string) => {
  const subtle = getCryptoSubtle();
  if (!subtle || !window.crypto?.getRandomValues) {
    throw new Error('WebCrypto unavailable');
  }
  const salt = window.crypto.getRandomValues(new Uint8Array(PBKDF2_SALT_BYTES));
  const key = await subtle.importKey('raw', textEncoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    PBKDF2_HASH_BYTES * 8
  );
  const hash = new Uint8Array(bits);
  return `${PASSWORD_HASH_PREFIX}$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
};

const verifyWithWebCrypto = async (secret: string, stored: string) => {
  const subtle = getCryptoSubtle();
  if (!subtle) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== PASSWORD_HASH_PREFIX) return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64(parts[2]);
  const expected = fromBase64(parts[3]);
  const key = await subtle.importKey('raw', textEncoder.encode(secret), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    expected.length * 8
  );
  const derived = new Uint8Array(bits);
  return timingSafeEqual(derived, expected);
};

const hashSecret = async (secret: string) => {
  const subtle = getCryptoSubtle();
  if (subtle) {
    try {
      return await hashWithWebCrypto(secret);
    } catch (error) {
      console.warn('WebCrypto hash failed, falling back.', error);
    }
  }
  console.warn('Hashing unavailable, storing plain text.');
  return secret;
};

const verifySecret = async (secret: string, stored: string) => {
  if (!isHashedValue(stored)) return secret === stored;
  const subtle = getCryptoSubtle();
  if (subtle) {
    try {
      return await verifyWithWebCrypto(secret, stored);
    } catch (error) {
      console.warn('WebCrypto verify failed, falling back.', error);
    }
  }
  console.warn('Verification unavailable for stored hash.');
  return false;
};

const getCurrentUserValue = (): User | null => {
  try {
    const u = storageGetRaw(DATA_KEYS.CURRENT_USER);
    return u ? JSON.parse(u) : null;
  } catch (e) {
    return null;
  }
};

const dumpAll = () => {
  return {
    users: get<User>(DATA_KEYS.USERS),
    events: get<CalendarEvent>(DATA_KEYS.EVENTS),
    todos: get<TodoItem>(DATA_KEYS.TODOS),
    checklists: get<Checklist>(DATA_KEYS.CHECKLISTS),
    transactions: get<Transaction>(DATA_KEYS.TRANSACTIONS),
    financeBudgets: get<FinanceBudget>(DATA_KEYS.FINANCE_BUDGETS),
    financeGoals: get<FinanceGoal>(DATA_KEYS.FINANCE_GOALS),
    financeDebts: get<FinanceDebt>(DATA_KEYS.FINANCE_DEBTS),
    financeRecurring: get<FinanceRecurring>(DATA_KEYS.FINANCE_RECURRING),
    contacts: get<Contact>(DATA_KEYS.CONTACTS),
    habits: get<Habit>(DATA_KEYS.HABITS),
    journal: get<JournalEntry>(DATA_KEYS.JOURNAL),
    books: get<Book>(DATA_KEYS.BOOKS),
    vault: get<EncryptedVault>(DATA_KEYS.VAULT),
  };
};

const parseLocalStorageValue = (value: string) => {
  try {
    return JSON.parse(value);
  } catch (e) {
    return value;
  }
};

const collectLocalExtras = () => {
  const weatherLocations: Record<string, any> = {};
  const cloudBackups: Record<string, any> = {};
  const appLocalStorage: Record<string, any> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('katanos_weather_loc_')) {
      const value = localStorage.getItem(key);
      if (value !== null) weatherLocations[key] = parseLocalStorageValue(value);
      continue;
    }
    if (key.startsWith('chronos_cloud_backup_')) {
      const value = localStorage.getItem(key);
      if (value !== null) cloudBackups[key] = parseLocalStorageValue(value);
      continue;
    }
    if (key.startsWith('katanos_')) {
      const value = localStorage.getItem(key);
      if (value !== null) appLocalStorage[key] = parseLocalStorageValue(value);
    }
  }

  return { weatherLocations, cloudBackups, appLocalStorage };
};

const filterExtrasForUser = (
  extras: {
    weatherLocations?: Record<string, any>;
    cloudBackups?: Record<string, any>;
    appLocalStorage?: Record<string, any>;
  },
  userId: string
) => {
  const weatherLocations: Record<string, any> = {};
  const cloudBackups: Record<string, any> = {};
  const appLocalStorage: Record<string, any> = {};
  const globalKeys = new Set([
    'katanos_emoji_recent',
    'katanos_last_login_lang',
    'katanos_last_login_theme',
    'katanos_login_bg',
    'katanos_idb_migrated_v1',
  ]);

  Object.entries(extras.weatherLocations || {}).forEach(([key, value]) => {
    if (key.endsWith(userId)) weatherLocations[key] = value;
  });

  Object.entries(extras.cloudBackups || {}).forEach(([key, value]) => {
    if (key.endsWith(userId)) cloudBackups[key] = value;
  });

  Object.entries(extras.appLocalStorage || {}).forEach(([key, value]) => {
    if (key.endsWith(userId) || globalKeys.has(key)) {
      appLocalStorage[key] = value;
    }
  });

  return { weatherLocations, cloudBackups, appLocalStorage };
};

const filterDataByUser = (data: ReturnType<typeof dumpAll>, userId: string) => {
  return {
    users: data.users.filter(user => user.id === userId),
    events: data.events.filter(event => event.userId === userId),
    todos: data.todos.filter(todo => todo.userId === userId),
    checklists: data.checklists.filter(cl => cl.userId === userId),
    transactions: data.transactions.filter(tx => tx.userId === userId),
    financeBudgets: data.financeBudgets.filter(item => item.userId === userId),
    financeGoals: data.financeGoals.filter(item => item.userId === userId),
    financeDebts: data.financeDebts.filter(item => item.userId === userId),
    financeRecurring: data.financeRecurring.filter(item => item.userId === userId),
    contacts: data.contacts.filter(contact => contact.userId === userId),
    habits: data.habits.filter(habit => habit.userId === userId),
    journal: data.journal.filter(entry => entry.userId === userId),
    vault: data.vault.filter(v => v.userId === userId),
    books: data.books.filter(book => book.userId === userId),
  };
};

const writeLocalStorageValue = (key: string, value: any) => {
  if (typeof value === 'string') {
    localStorage.setItem(key, value);
  } else {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const restoreLocalExtras = (extras?: {
  weatherLocations?: Record<string, any>;
  cloudBackups?: Record<string, any>;
  appLocalStorage?: Record<string, any>;
}) => {
  if (!extras) return;
  if (extras.weatherLocations) {
    Object.entries(extras.weatherLocations).forEach(([key, value]) => {
      writeLocalStorageValue(key, value);
    });
  }
  if (extras.cloudBackups) {
    Object.entries(extras.cloudBackups).forEach(([key, value]) => {
      writeLocalStorageValue(key, value);
    });
  }
  if (extras.appLocalStorage) {
    Object.entries(extras.appLocalStorage).forEach(([key, value]) => {
      writeLocalStorageValue(key, value);
    });
  }
};

const buildBackupPayload = (userId?: string) => {
  const currentUser = getCurrentUserValue();
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    userId: userId || currentUser?.id || null,
    currentUser,
    data: dumpAll(),
    extras: collectLocalExtras(),
    scope: 'all',
  };
};

const buildUserBackupPayload = (userId: string) => {
  const currentUser = getCurrentUserValue();
  const data = dumpAll();
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    userId,
    currentUser,
    data: filterDataByUser(data, userId),
    extras: filterExtrasForUser(collectLocalExtras(), userId),
    scope: 'user',
  };
};

const persistSnapshot = (userId?: string) => {
  if (typeof window === 'undefined' || !window.katanos?.saveSnapshot) return;
  try {
    void window.katanos.saveSnapshot(buildBackupPayload(userId));
  } catch (e) {
    console.warn("Auto-save failed", e);
  }
};

const setCurrentUserValue = (user: User | null) => {
  if (user) {
    storageSetRaw(DATA_KEYS.CURRENT_USER, JSON.stringify(user));
  } else {
    storageRemoveRaw(DATA_KEYS.CURRENT_USER);
  }
  persistSnapshot(user?.id);
};

const get = <T>(key: string): T[] => {
  try {
    const data = storageGetRaw(key);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error(`Error reading key ${key}`, e);
    return [];
  }
};

const set = <T>(key: string, data: T[]) => {
  try {
    storageSetRaw(key, JSON.stringify(data));
    persistSnapshot();
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      notifyStorageFull();
    } else {
      console.error("Storage save failed", e);
    }
  }
};

export const db = {
  init: async () => {
    await initStorage(Object.values(DATA_KEYS));
  },
  auth: {
    login: async (username: string, password?: string): Promise<{ user?: User, error?: string }> => {
      await delay(800);
      const users = get<User>(DATA_KEYS.USERS);
      const index = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());

      if (index === -1) {
        return { error: "Utente non trovato." };
      }

      let user = users[index];
      if (user.password) {
        if (!password) {
          return { error: "Password non valida." };
        }
        if (isHashedValue(user.password)) {
          const valid = await verifySecret(password, user.password);
          if (!valid) {
            return { error: "Password non valida." };
          }
        } else if (user.password !== password) {
          return { error: "Password non valida." };
        } else {
          const hashed = await hashSecret(password);
          if (hashed !== user.password) {
            user = { ...user, password: hashed };
            users[index] = user;
            set(DATA_KEYS.USERS, users);
          }
        }
      }
      if (user.apiKey && !isEncryptedSecret(user.apiKey)) {
        const encryptedApiKey = await encryptSecretValue(user.apiKey);
        if (encryptedApiKey && encryptedApiKey !== user.apiKey) {
          user = { ...user, apiKey: encryptedApiKey };
          users[index] = user;
          set(DATA_KEYS.USERS, users);
        }
      }

      // Ensure defaults
      if (!user.currency) user.currency = 'EUR';
      if (!user.language) user.language = 'it';
      if (!user.notificationAdvance) user.notificationAdvance = 30;
      if (typeof user.clockUse12h !== 'boolean') user.clockUse12h = false;
      const legacyTheme = (user as { wallpaper?: string }).wallpaper;
      if (!user.theme) user.theme = legacyTheme || 'default';
      if (typeof user.lockEnabled !== 'boolean') user.lockEnabled = false;
      if (!Number.isFinite(user.lockTimeoutMinutes) || (user.lockTimeoutMinutes ?? 0) <= 0) {
        user.lockTimeoutMinutes = 5;
      }

      setCurrentUserValue(user);
      return { user };
    },
    register: async (
      username: string,
      password?: string,
      language: string = 'it',
      securityQuestionId?: string,
      securityAnswer?: string
    ): Promise<{ user?: User, error?: string }> => {
      await delay(800);
      const users = get<User>(DATA_KEYS.USERS);

      if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return { error: "Nome utente già in uso." };
      }

      const normalizedAnswer = securityAnswer ? normalizeSecurityAnswer(securityAnswer) : undefined;
      const hashedPassword = password ? await hashSecret(password) : undefined;
      const hashedAnswer = normalizedAnswer ? await hashSecret(normalizedAnswer) : undefined;

      const newUser: User = {
        id: uuidv4(),
        username,
        password: hashedPassword,
        securityQuestionId,
        securityAnswer: hashedAnswer,
        avatar: buildAvatarDataUri(username),
        currency: 'EUR',
        language: language,
        notificationAdvance: 30,
        clockUse12h: false,
        theme: 'default',
        lockEnabled: false,
        lockTimeoutMinutes: 5
      };

      users.push(newUser);
      set(DATA_KEYS.USERS, users);

      setCurrentUserValue(newUser);
      return { user: newUser };
    },
    updateSettings: async (userId: string, settings: Partial<User>): Promise<User> => {
      const users = get<User>(DATA_KEYS.USERS);
      const index = users.findIndex(u => u.id === userId);
      if (index === -1) throw new Error("User not found");

      const updatedSettings: Partial<User> = { ...settings };
      if (typeof updatedSettings.password === 'string') {
        if (!updatedSettings.password) {
          updatedSettings.password = undefined;
        } else if (!isHashedValue(updatedSettings.password)) {
          updatedSettings.password = await hashSecret(updatedSettings.password);
        }
      }
      if (typeof updatedSettings.securityAnswer === 'string') {
        if (!updatedSettings.securityAnswer) {
          updatedSettings.securityAnswer = undefined;
        } else if (!isHashedValue(updatedSettings.securityAnswer)) {
          const normalized = normalizeSecurityAnswer(updatedSettings.securityAnswer);
          updatedSettings.securityAnswer = await hashSecret(normalized);
        }
      }
      if (typeof updatedSettings.apiKey === 'string') {
        const trimmed = updatedSettings.apiKey.trim();
        if (!trimmed) {
          updatedSettings.apiKey = undefined;
        } else {
          updatedSettings.apiKey = await encryptSecretValue(trimmed);
        }
      }
      if (typeof updatedSettings.lockPin === 'string') {
        if (isHashedValue(updatedSettings.lockPin)) {
          // Keep hashed PIN as-is.
        } else {
          const normalized = normalizePin(updatedSettings.lockPin);
          if (!normalized) {
            updatedSettings.lockPin = undefined;
          } else {
            updatedSettings.lockPin = await hashSecret(normalized);
          }
        }
      }
      if (typeof updatedSettings.lockTimeoutMinutes === 'number') {
        if (!Number.isFinite(updatedSettings.lockTimeoutMinutes) || updatedSettings.lockTimeoutMinutes <= 0) {
          updatedSettings.lockTimeoutMinutes = 5;
        }
      }

      const updatedUser = { ...users[index], ...updatedSettings };
      users[index] = updatedUser;
      set(DATA_KEYS.USERS, users);
      setCurrentUserValue(updatedUser);
      return updatedUser;
    },
    getCurrentUser: (): User | null => {
      return getCurrentUserValue();
    },
    getSecurityQuestion: async (username: string): Promise<{ questionId?: string; error?: 'not_found' | 'missing_question' }> => {
      await delay(300);
      const users = get<User>(DATA_KEYS.USERS);
      const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      if (!user) return { error: 'not_found' };
      if (!user.securityQuestionId) return { error: 'missing_question' };
      return { questionId: user.securityQuestionId };
    },
    resetPassword: async (username: string, answer: string, newPassword: string): Promise<{ ok?: boolean; error?: 'not_found' | 'missing_question' | 'invalid_answer' }> => {
      await delay(800);
      const users = get<User>(DATA_KEYS.USERS);
      const index = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
      if (index === -1) return { error: 'not_found' };
      const user = users[index];
      if (!user.securityQuestionId || !user.securityAnswer) return { error: 'missing_question' };
      const normalized = normalizeSecurityAnswer(answer);
      const answerValid = isHashedValue(user.securityAnswer)
        ? await verifySecret(normalized, user.securityAnswer)
        : normalized === user.securityAnswer;
      if (!answerValid) return { error: 'invalid_answer' };
      const hashedPassword = await hashSecret(newPassword);
      const hashedAnswer = isHashedValue(user.securityAnswer)
        ? user.securityAnswer
        : await hashSecret(normalized);
      users[index] = { ...user, password: hashedPassword, securityAnswer: hashedAnswer };
      set(DATA_KEYS.USERS, users);
      return { ok: true };
    },
    verifyLockPin: async (storedPin: string | undefined, attempt: string): Promise<boolean> => {
      if (!storedPin) return false;
      const normalized = normalizePin(attempt);
      if (!normalized) return false;
      if (isHashedValue(storedPin)) {
        return verifySecret(normalized, storedPin);
      }
      return normalized === storedPin;
    },
    logout: () => {
      setCurrentUserValue(null);
    },
    deleteUserData: (userId: string) => {
      if (!userId) return false;

      const users = get<User>(DATA_KEYS.USERS).filter(user => user.id !== userId);
      const events = get<CalendarEvent>(DATA_KEYS.EVENTS).filter(event => event.userId !== userId);
      const todos = get<TodoItem>(DATA_KEYS.TODOS).filter(todo => todo.userId !== userId);
      const checklists = get<Checklist>(DATA_KEYS.CHECKLISTS).filter(cl => cl.userId !== userId);
      const transactions = get<Transaction>(DATA_KEYS.TRANSACTIONS).filter(tx => tx.userId !== userId);
      const financeBudgets = get<FinanceBudget>(DATA_KEYS.FINANCE_BUDGETS).filter(item => item.userId !== userId);
      const financeGoals = get<FinanceGoal>(DATA_KEYS.FINANCE_GOALS).filter(item => item.userId !== userId);
      const financeDebts = get<FinanceDebt>(DATA_KEYS.FINANCE_DEBTS).filter(item => item.userId !== userId);
      const financeRecurring = get<FinanceRecurring>(DATA_KEYS.FINANCE_RECURRING).filter(item => item.userId !== userId);
      const contacts = get<Contact>(DATA_KEYS.CONTACTS).filter(contact => contact.userId !== userId);
      const habits = get<Habit>(DATA_KEYS.HABITS).filter(habit => habit.userId !== userId);
      const journal = get<JournalEntry>(DATA_KEYS.JOURNAL).filter(entry => entry.userId !== userId);
      const books = get<Book>(DATA_KEYS.BOOKS).filter(book => book.userId !== userId);

      set(DATA_KEYS.USERS, users);
      set(DATA_KEYS.EVENTS, events);
      set(DATA_KEYS.TODOS, todos);
      set(DATA_KEYS.CHECKLISTS, checklists);
      set(DATA_KEYS.TRANSACTIONS, transactions);
      set(DATA_KEYS.FINANCE_BUDGETS, financeBudgets);
      set(DATA_KEYS.FINANCE_GOALS, financeGoals);
      set(DATA_KEYS.FINANCE_DEBTS, financeDebts);
      set(DATA_KEYS.FINANCE_RECURRING, financeRecurring);
      set(DATA_KEYS.CONTACTS, contacts);
      set(DATA_KEYS.HABITS, habits);
      // Vault is currently global or single-user in this context, so we might not delete it or we delete it all?
      // For now, let's assume vault is tied to the user implicitly if we only have one vault.
      // If we want per-user vault, we need to structure it differently.
      // Let's just remove the vault key if we are deleting the user data and it's a single user app effectively.
      storageRemoveRaw(DATA_KEYS.VAULT);
      set(DATA_KEYS.JOURNAL, journal);
      set(DATA_KEYS.BOOKS, books);

      const currentUser = getCurrentUserValue();
      if (currentUser?.id === userId) {
        storageRemoveRaw(DATA_KEYS.CURRENT_USER);
      }

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (key.startsWith('katanos_weather_loc_') && key.endsWith(userId)) {
          keysToRemove.push(key);
        }
        if (key.startsWith('chronos_cloud_backup_') && key.endsWith(userId)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      persistSnapshot();
      return true;
    }
  },

  events: {
    list: async (userId: string): Promise<CalendarEvent[]> => {
      return get<CalendarEvent>(DATA_KEYS.EVENTS).filter(e => e.userId === userId);
    },
    add: async (event: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
      const events = get<CalendarEvent>(DATA_KEYS.EVENTS);
      const newEvent = { ...event, id: uuidv4() };
      events.push(newEvent);
      set(DATA_KEYS.EVENTS, events);
      return newEvent;
    },
    update: async (id: string, updates: Partial<CalendarEvent>) => {
      const events = get<CalendarEvent>(DATA_KEYS.EVENTS);
      const index = events.findIndex(e => e.id === id);
      if (index !== -1) {
        events[index] = { ...events[index], ...updates };
        set(DATA_KEYS.EVENTS, events);
      }
    },
    delete: async (id: string) => {
      const events = get<CalendarEvent>(DATA_KEYS.EVENTS);
      set(DATA_KEYS.EVENTS, events.filter(e => e.id !== id));
    }
  },

  todos: {
    list: async (userId: string): Promise<TodoItem[]> => {
      return get<TodoItem>(DATA_KEYS.TODOS).filter(t => t.userId === userId);
    },
    save: async (todos: TodoItem[]) => {
      const allTodos = get<TodoItem>(DATA_KEYS.TODOS);
      const currentUserId = todos.length > 0 ? todos[0].userId : null;
      if (!currentUserId) return;

      const otherTodos = allTodos.filter(t => t.userId !== currentUserId);
      set(DATA_KEYS.TODOS, [...otherTodos, ...todos]);
    },
    add: async (todo: Omit<TodoItem, 'id'>): Promise<TodoItem> => {
      const todos = get<TodoItem>(DATA_KEYS.TODOS);
      const newTodo = { ...todo, id: uuidv4() };
      todos.push(newTodo);
      set(DATA_KEYS.TODOS, todos);
      return newTodo;
    },
    delete: async (id: string) => {
      const todos = get<TodoItem>(DATA_KEYS.TODOS);
      set(DATA_KEYS.TODOS, todos.filter(t => t.id !== id));
    }
  },

  checklists: {
    list: async (userId: string): Promise<Checklist[]> => {
      return get<Checklist>(DATA_KEYS.CHECKLISTS).filter(c => c.userId === userId);
    },
    add: async (checklist: Omit<Checklist, 'id'>): Promise<Checklist> => {
      const checklists = get<Checklist>(DATA_KEYS.CHECKLISTS);
      const newChecklist = { ...checklist, id: uuidv4() };
      checklists.push(newChecklist);
      set(DATA_KEYS.CHECKLISTS, checklists);
      return newChecklist;
    },
    update: async (id: string, updates: Partial<Checklist>) => {
      const checklists = get<Checklist>(DATA_KEYS.CHECKLISTS);
      const index = checklists.findIndex(c => c.id === id);
      if (index !== -1) {
        checklists[index] = { ...checklists[index], ...updates };
        set(DATA_KEYS.CHECKLISTS, checklists);
      }
    },
    delete: async (id: string) => {
      const checklists = get<Checklist>(DATA_KEYS.CHECKLISTS);
      set(DATA_KEYS.CHECKLISTS, checklists.filter(c => c.id !== id));
    }
  },

  transactions: {
    list: async (userId: string): Promise<Transaction[]> => {
      return get<Transaction>(DATA_KEYS.TRANSACTIONS).filter(t => t.userId === userId);
    },
    addMany: async (items: Omit<Transaction, 'id'>[]): Promise<Transaction[]> => {
      if (!items.length) return [];
      const txs = get<Transaction>(DATA_KEYS.TRANSACTIONS);
      const newTxs = items.map(item => ({ ...item, id: uuidv4() }));
      txs.push(...newTxs);
      set(DATA_KEYS.TRANSACTIONS, txs);
      return newTxs;
    },
    add: async (tx: Omit<Transaction, 'id'>): Promise<Transaction> => {
      const txs = get<Transaction>(DATA_KEYS.TRANSACTIONS);
      const newTx = { ...tx, id: uuidv4() };
      txs.push(newTx);
      set(DATA_KEYS.TRANSACTIONS, txs);
      return newTx;
    },
    update: async (id: string, updates: Partial<Transaction>) => {
      const txs = get<Transaction>(DATA_KEYS.TRANSACTIONS);
      const index = txs.findIndex(t => t.id === id);
      if (index !== -1) {
        txs[index] = { ...txs[index], ...updates };
        set(DATA_KEYS.TRANSACTIONS, txs);
      }
    },
    delete: async (id: string) => {
      const txs = get<Transaction>(DATA_KEYS.TRANSACTIONS);
      set(DATA_KEYS.TRANSACTIONS, txs.filter(t => t.id !== id));
    }
  },

  financeBudgets: {
    list: async (userId: string): Promise<FinanceBudget[]> => {
      return get<FinanceBudget>(DATA_KEYS.FINANCE_BUDGETS).filter(item => item.userId === userId);
    },
    add: async (item: Omit<FinanceBudget, 'id'>): Promise<FinanceBudget> => {
      const items = get<FinanceBudget>(DATA_KEYS.FINANCE_BUDGETS);
      const newItem = { ...item, id: uuidv4() };
      items.push(newItem);
      set(DATA_KEYS.FINANCE_BUDGETS, items);
      return newItem;
    },
    update: async (id: string, updates: Partial<FinanceBudget>) => {
      const items = get<FinanceBudget>(DATA_KEYS.FINANCE_BUDGETS);
      const index = items.findIndex(item => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...updates };
        set(DATA_KEYS.FINANCE_BUDGETS, items);
      }
    },
    delete: async (id: string) => {
      const items = get<FinanceBudget>(DATA_KEYS.FINANCE_BUDGETS);
      set(DATA_KEYS.FINANCE_BUDGETS, items.filter(item => item.id !== id));
    }
  },

  financeGoals: {
    list: async (userId: string): Promise<FinanceGoal[]> => {
      return get<FinanceGoal>(DATA_KEYS.FINANCE_GOALS).filter(item => item.userId === userId);
    },
    add: async (item: Omit<FinanceGoal, 'id'>): Promise<FinanceGoal> => {
      const items = get<FinanceGoal>(DATA_KEYS.FINANCE_GOALS);
      const newItem = { ...item, id: uuidv4() };
      items.push(newItem);
      set(DATA_KEYS.FINANCE_GOALS, items);
      return newItem;
    },
    update: async (id: string, updates: Partial<FinanceGoal>) => {
      const items = get<FinanceGoal>(DATA_KEYS.FINANCE_GOALS);
      const index = items.findIndex(item => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...updates };
        set(DATA_KEYS.FINANCE_GOALS, items);
      }
    },
    delete: async (id: string) => {
      const items = get<FinanceGoal>(DATA_KEYS.FINANCE_GOALS);
      set(DATA_KEYS.FINANCE_GOALS, items.filter(item => item.id !== id));
    }
  },

  financeDebts: {
    list: async (userId: string): Promise<FinanceDebt[]> => {
      return get<FinanceDebt>(DATA_KEYS.FINANCE_DEBTS).filter(item => item.userId === userId);
    },
    add: async (item: Omit<FinanceDebt, 'id'>): Promise<FinanceDebt> => {
      const items = get<FinanceDebt>(DATA_KEYS.FINANCE_DEBTS);
      const newItem = { ...item, id: uuidv4() };
      items.push(newItem);
      set(DATA_KEYS.FINANCE_DEBTS, items);
      return newItem;
    },
    update: async (id: string, updates: Partial<FinanceDebt>) => {
      const items = get<FinanceDebt>(DATA_KEYS.FINANCE_DEBTS);
      const index = items.findIndex(item => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...updates };
        set(DATA_KEYS.FINANCE_DEBTS, items);
      }
    },
    delete: async (id: string) => {
      const items = get<FinanceDebt>(DATA_KEYS.FINANCE_DEBTS);
      set(DATA_KEYS.FINANCE_DEBTS, items.filter(item => item.id !== id));
    }
  },

  financeRecurring: {
    list: async (userId: string): Promise<FinanceRecurring[]> => {
      return get<FinanceRecurring>(DATA_KEYS.FINANCE_RECURRING).filter(item => item.userId === userId);
    },
    add: async (item: Omit<FinanceRecurring, 'id'>): Promise<FinanceRecurring> => {
      const items = get<FinanceRecurring>(DATA_KEYS.FINANCE_RECURRING);
      const newItem = { ...item, id: uuidv4() };
      items.push(newItem);
      set(DATA_KEYS.FINANCE_RECURRING, items);
      return newItem;
    },
    update: async (id: string, updates: Partial<FinanceRecurring>) => {
      const items = get<FinanceRecurring>(DATA_KEYS.FINANCE_RECURRING);
      const index = items.findIndex(item => item.id === id);
      if (index !== -1) {
        items[index] = { ...items[index], ...updates };
        set(DATA_KEYS.FINANCE_RECURRING, items);
      }
    },
    delete: async (id: string) => {
      const items = get<FinanceRecurring>(DATA_KEYS.FINANCE_RECURRING);
      set(DATA_KEYS.FINANCE_RECURRING, items.filter(item => item.id !== id));
    }
  },

  contacts: {
    list: async (userId: string): Promise<Contact[]> => {
      return get<Contact>(DATA_KEYS.CONTACTS).filter(c => c.userId === userId);
    },
    add: async (contact: Omit<Contact, 'id'>): Promise<Contact> => {
      const contacts = get<Contact>(DATA_KEYS.CONTACTS);
      const newContact = { ...contact, id: uuidv4() };
      contacts.push(newContact);
      set(DATA_KEYS.CONTACTS, contacts);
      return newContact;
    },
    toggleFavorite: async (id: string) => {
      const contacts = get<Contact>(DATA_KEYS.CONTACTS);
      const index = contacts.findIndex(c => c.id === id);
      if (index !== -1) {
        contacts[index].isFavorite = !contacts[index].isFavorite;
        set(DATA_KEYS.CONTACTS, contacts);
      }
    },
    update: async (id: string, updates: Partial<Contact>) => {
      const contacts = get<Contact>(DATA_KEYS.CONTACTS);
      const index = contacts.findIndex(c => c.id === id);
      if (index !== -1) {
        contacts[index] = { ...contacts[index], ...updates };
        set(DATA_KEYS.CONTACTS, contacts);
      }
    },
    delete: async (id: string) => {
      const contacts = get<Contact>(DATA_KEYS.CONTACTS);
      set(DATA_KEYS.CONTACTS, contacts.filter(c => c.id !== id));
    }
  },

  habits: {
    list: async (userId: string): Promise<Habit[]> => {
      return get<Habit>(DATA_KEYS.HABITS).filter(h => h.userId === userId);
    },
    add: async (habit: Omit<Habit, 'id'>): Promise<Habit> => {
      const habits = get<Habit>(DATA_KEYS.HABITS);
      const newHabit = { ...habit, id: uuidv4() };
      habits.push(newHabit);
      set(DATA_KEYS.HABITS, habits);
      return newHabit;
    },
    toggleLog: async (habitId: string, date: string) => {
      const habits = get<Habit>(DATA_KEYS.HABITS);
      const index = habits.findIndex(h => h.id === habitId);
      if (index !== -1) {
        const logs = new Set(habits[index].logs);
        const skips = new Set(habits[index].skips || []);

        if (logs.has(date)) {
          logs.delete(date);
        } else {
          logs.add(date);
          skips.delete(date); // Cannot be both logged and skipped
        }
        habits[index].logs = Array.from(logs);
        habits[index].skips = Array.from(skips);
        set(DATA_KEYS.HABITS, habits);
      }
    },
    toggleSkip: async (habitId: string, date: string) => {
      const habits = get<Habit>(DATA_KEYS.HABITS);
      const index = habits.findIndex(h => h.id === habitId);
      if (index !== -1) {
        const skips = new Set(habits[index].skips || []);
        const logs = new Set(habits[index].logs);

        if (skips.has(date)) {
          skips.delete(date);
        } else {
          skips.add(date);
          logs.delete(date); // Cannot be both skipped and logged
        }
        habits[index].skips = Array.from(skips);
        habits[index].logs = Array.from(logs);
        set(DATA_KEYS.HABITS, habits);
      }
    },
    delete: async (id: string) => {
      const habits = get<Habit>(DATA_KEYS.HABITS);
      set(DATA_KEYS.HABITS, habits.filter(h => h.id !== id));
    }
  },

  journal: {
    list: async (userId: string): Promise<JournalEntry[]> => {
      return get<JournalEntry>(DATA_KEYS.JOURNAL).filter(j => j.userId === userId);
    },
    save: async (entry: JournalEntry) => {
      const entries = get<JournalEntry>(DATA_KEYS.JOURNAL);
      const index = entries.findIndex(e => e.id === entry.id);
      if (index !== -1) {
        entries[index] = entry;
      } else {
        entries.push(entry);
      }
      set(DATA_KEYS.JOURNAL, entries);
      return entry;
    },
    add: async (entry: Omit<JournalEntry, 'id'>): Promise<JournalEntry> => {
      const entries = get<JournalEntry>(DATA_KEYS.JOURNAL);
      const newEntry = { ...entry, id: uuidv4() };
      entries.push(newEntry);
      set(DATA_KEYS.JOURNAL, entries);
      return newEntry;
    },
    delete: async (id: string) => {
      const entries = get<JournalEntry>(DATA_KEYS.JOURNAL);
      set(DATA_KEYS.JOURNAL, entries.filter(j => j.id !== id));
    }
  },

  books: {
    list: async (userId: string): Promise<Book[]> => {
      return get<Book>(DATA_KEYS.BOOKS).filter(b => b.userId === userId);
    },
    add: async (book: Omit<Book, 'id'>): Promise<Book> => {
      const books = get<Book>(DATA_KEYS.BOOKS);
      const newBook = { ...book, id: uuidv4() };
      books.push(newBook);
      set(DATA_KEYS.BOOKS, books);
      return newBook;
    },
    update: async (id: string, updates: Partial<Book>) => {
      const books = get<Book>(DATA_KEYS.BOOKS);
      const index = books.findIndex(b => b.id === id);
      if (index !== -1) {
        books[index] = { ...books[index], ...updates };
        set(DATA_KEYS.BOOKS, books);
      }
    },
    delete: async (id: string) => {
      const books = get<Book>(DATA_KEYS.BOOKS);
      set(DATA_KEYS.BOOKS, books.filter(b => b.id !== id));
    }
  },

  vault: {
    get: (): EncryptedVault | null => {
      const currentUser = getCurrentUserValue();
      if (!currentUser) return null;
      const vaults = get<EncryptedVault>(DATA_KEYS.VAULT);

      // Migration: If there is a legacy vault (no userId), assign it to current user
      const legacyVaultIndex = vaults.findIndex(v => !v.userId);
      if (legacyVaultIndex !== -1) {
        vaults[legacyVaultIndex].userId = currentUser.id;
        set(DATA_KEYS.VAULT, vaults);
        return vaults[legacyVaultIndex];
      }

      return vaults.find(v => v.userId === currentUser.id) || null;
    },
    save: (vault: EncryptedVault) => {
      const currentUser = getCurrentUserValue();
      if (!currentUser) return;

      // Ensure vault has userId
      if (!vault.userId) vault.userId = currentUser.id;

      const vaults = get<EncryptedVault>(DATA_KEYS.VAULT);
      const index = vaults.findIndex(v => v.userId === vault.userId);

      if (index !== -1) {
        vaults[index] = vault;
      } else {
        vaults.push(vault);
      }
      set(DATA_KEYS.VAULT, vaults);
    },
    delete: () => {
      const currentUser = getCurrentUserValue();
      if (!currentUser) return;
      const vaults = get<EncryptedVault>(DATA_KEYS.VAULT);
      const newVaults = vaults.filter(v => v.userId !== currentUser.id);
      set(DATA_KEYS.VAULT, newVaults);
    }
  },

  autosave: (userId?: string) => {
    persistSnapshot(userId);
  },

  createUserBackupPayload: (userId: string) => {
    return buildUserBackupPayload(userId);
  },

  restore: (dump: BackupPayload) => {
    const payload = dump || {};
    const data = payload.data ?? {} as NonNullable<BackupPayload['data']>;
    const targetUserId = payload.userId || payload.currentUser?.id;

    if (payload.scope === 'user' && targetUserId) {
      const mergeByUser = <T extends { userId: string }>(key: string, items: T[]) => {
        const existing = get<T>(key);
        const kept = existing.filter(item => item.userId !== targetUserId);
        // Vault cannot be merged easily because it's encrypted. We overwrite it if it exists in backup.
        if ('vault' in data && Array.isArray(data.vault) && data.vault.length > 0) {
          set(DATA_KEYS.VAULT, data.vault);
        }
        set(key, [...kept, ...(items || [])]);
      };

      if ('users' in data || payload.currentUser) {
        const existingUsers = get<User>(DATA_KEYS.USERS);
        const importedUsers = Array.isArray(data?.users) && data.users.length > 0
          ? data.users
          : (payload.currentUser ? [payload.currentUser] : []);
        if (importedUsers.length > 0) {
          const kept = existingUsers.filter(u => u.id !== targetUserId);
          set(DATA_KEYS.USERS, [...kept, ...importedUsers]);
        }
      }
      if ('vault' in data) set(DATA_KEYS.VAULT, data.vault || []);
      if ('events' in data) mergeByUser(DATA_KEYS.EVENTS, data.events || []);
      if ('todos' in data) mergeByUser(DATA_KEYS.TODOS, data.todos || []);
      if ('checklists' in data) mergeByUser(DATA_KEYS.CHECKLISTS, data.checklists || []);
      if ('transactions' in data) mergeByUser(DATA_KEYS.TRANSACTIONS, data.transactions || []);
      if ('financeBudgets' in data) mergeByUser(DATA_KEYS.FINANCE_BUDGETS, data.financeBudgets || []);
      if ('financeGoals' in data) mergeByUser(DATA_KEYS.FINANCE_GOALS, data.financeGoals || []);
      if ('financeDebts' in data) mergeByUser(DATA_KEYS.FINANCE_DEBTS, data.financeDebts || []);
      if ('financeRecurring' in data) mergeByUser(DATA_KEYS.FINANCE_RECURRING, data.financeRecurring || []);
      if ('contacts' in data) mergeByUser(DATA_KEYS.CONTACTS, data.contacts || []);
      if ('habits' in data) mergeByUser(DATA_KEYS.HABITS, data.habits || []);
      if ('journal' in data) mergeByUser(DATA_KEYS.JOURNAL, data.journal || []);
      if ('books' in data) mergeByUser(DATA_KEYS.BOOKS, data.books || []);

      if (payload.currentUser) {
        setCurrentUserValue(payload.currentUser);
      }
      if (payload.extras) restoreLocalExtras(payload.extras);
      persistSnapshot(targetUserId);
      return;
    }

    if ('users' in data) set(DATA_KEYS.USERS, data.users || []);
    if ('events' in data) set(DATA_KEYS.EVENTS, data.events || []);
    if ('todos' in data) set(DATA_KEYS.TODOS, data.todos || []);
    if ('checklists' in data) set(DATA_KEYS.CHECKLISTS, data.checklists || []);
    if ('transactions' in data) set(DATA_KEYS.TRANSACTIONS, data.transactions || []);
    if ('financeBudgets' in data) set(DATA_KEYS.FINANCE_BUDGETS, data.financeBudgets || []);
    if ('financeGoals' in data) set(DATA_KEYS.FINANCE_GOALS, data.financeGoals || []);
    if ('financeDebts' in data) set(DATA_KEYS.FINANCE_DEBTS, data.financeDebts || []);
    if ('financeRecurring' in data) set(DATA_KEYS.FINANCE_RECURRING, data.financeRecurring || []);
    if ('contacts' in data) set(DATA_KEYS.CONTACTS, data.contacts || []);
    if ('habits' in data) set(DATA_KEYS.HABITS, data.habits || []);
    if ('journal' in data) set(DATA_KEYS.JOURNAL, data.journal || []);
    if ('books' in data) set(DATA_KEYS.BOOKS, data.books || []);
    if (payload?.extras) restoreLocalExtras(payload.extras);
    persistSnapshot();
  }
};
