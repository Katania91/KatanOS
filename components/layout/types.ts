// Layout types - extracted from Layout.tsx

export type SettingsTab =
    | 'profile'
    | 'personalization'
    | 'preferences'
    | 'categories'
    | 'modules'
    | 'backup'
    | 'system'
    | 'info';

export interface DevInfo {
    appVersion?: string;
    appName?: string;
    isPackaged?: boolean;
    appPath?: string;
    userDataPath?: string;
    katanosDataPath?: string;
    logDir?: string;
    platform?: string;
    arch?: string;
    osVersion?: string;
    locale?: string;
    logPath?: string;
    electronVersion?: string;
    chromeVersion?: string;
    nodeVersion?: string;
    v8Version?: string;
    uptimeSec?: number;
    startedAt?: string;
    totalMemory?: number;
    freeMemory?: number;
}

export interface BackupHistoryItem {
    name: string;
    mtime: number;
    size: number;
}

export type BackupStatus = 'idle' | 'running' | 'success' | 'error';

export type BackupInterval = '30m' | '1h' | '6h' | '12h' | '24h' | 'weekly' | 'monthly';
