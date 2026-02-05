import { User, BackupSettings, BackupInterval } from '../types';
import { db } from './db';
import { t } from './translations';

export interface BackupResult {
  success: boolean;
  path?: string;
  timestamp: string;
  error?: string;
  sizeBytes?: number;
}

export interface BackupFileInfo {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

export interface BackupManifest {
  schemaVersion: string;
  appVersion: string;
  timestamp: string;
  backupId: string;
  scope: 'user' | 'all';
  userId: string | null;
  currentUser: User | null;
  data: ReturnType<typeof db.createUserBackupPayload>['data'];
  extras: Record<string, any>;
}

const INTERVAL_MS: Record<BackupInterval, number> = {
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

const normalizeInterval = (interval: string): BackupInterval => {
  if (interval === 'hourly') return '1h';
  if (interval === 'monthly') return 'monthly';
  if (interval === 'daily' || interval === 'weekly') return interval;
  if (interval === '30m' || interval === '1h' || interval === '6h' || interval === '12h' || interval === '24h') {
    return interval;
  }
  return '24h';
};

const generateBackupId = (): string => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`;
};

const formatTimestamp = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
};

class BackupScheduler {
  private intervalId: number | null = null;
  private userId: string | null = null;
  private settings: BackupSettings | null = null;

  start(userId: string, settings: BackupSettings) {
    this.stop();
    this.userId = userId;
    this.settings = settings;

    if (!settings.enabled || !settings.folderPath) {
      return;
    }

    // Check if backup needed on startup
    if (settings.runOnStartup && settings.lastBackupAt) {
      const lastBackup = new Date(settings.lastBackupAt).getTime();
      const intervalMs = INTERVAL_MS[normalizeInterval(settings.interval)];
      const elapsed = Date.now() - lastBackup;

      if (elapsed > intervalMs) {
        // Run backup after a short delay to let app fully initialize
        setTimeout(() => this.runBackup(), 5000);
      }
    } else if (settings.runOnStartup && !settings.lastBackupAt) {
      // Never backed up, run on startup
      setTimeout(() => this.runBackup(), 5000);
    }

    // Schedule recurring backups
    const intervalMs = INTERVAL_MS[normalizeInterval(settings.interval)];
    this.intervalId = window.setInterval(() => this.runBackup(), intervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.userId = null;
    this.settings = null;
  }

  async runBackup(): Promise<BackupResult> {
    if (!this.userId || !this.settings?.folderPath) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        error: 'No user or folder configured',
      };
    }

    return backupService.triggerBackupNow(this.userId, this.settings);
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  getCurrentUserId(): string | null {
    return this.userId;
  }
}

export const backupScheduler = new BackupScheduler();

export const backupService = {
  getNotificationLang(): string {
    const currentUser = db.auth.getCurrentUser();
    return currentUser?.language || 'en';
  },
  /**
   * Get default backup settings
   */
  getDefaultSettings(): BackupSettings {
    return {
      enabled: false,
      folderPath: '',
      interval: '24h',
      retentionMode: 'count',
      retentionValue: 10,
      runOnStartup: true,
      lastBackupAt: null,
      lastBackupStatus: null,
    };
  },

  /**
   * Trigger an immediate backup
   */
  async triggerBackupNow(userId: string, settings: BackupSettings): Promise<BackupResult> {
    const timestamp = new Date();
    const isoTimestamp = timestamp.toISOString();
    const retentionValue = Number.isFinite(settings.retentionValue) ? settings.retentionValue : 10;
    const retentionMode = settings.retentionMode || 'count';

    if (!settings.folderPath) {
      return {
        success: false,
        timestamp: isoTimestamp,
        error: 'No backup folder configured',
      };
    }

    try {
      // Check if folder is writable
      if (window.katanos?.checkFolderWritable) {
        const { writable } = await window.katanos.checkFolderWritable(settings.folderPath);
        if (!writable) {
          await this.updateBackupStatus(userId, settings, isoTimestamp, 'failed');
          this.notifyBackupFailure('backupFolderNotWritable');
          return {
            success: false,
            timestamp: isoTimestamp,
            error: 'Folder not writable',
          };
        }
      }

      // Build backup payload
      const userPayload = db.createUserBackupPayload(userId);
      const manifest: BackupManifest = {
        schemaVersion: '2.0',
        appVersion: '1.0.9',
        timestamp: isoTimestamp,
        backupId: generateBackupId(),
        scope: 'user',
        userId,
        currentUser: userPayload.currentUser,
        data: userPayload.data,
        extras: userPayload.extras || {},
      };

      // Generate filename
      const shortUserId = userId.substring(0, 6);
      const fileName = `katanos-backup-${formatTimestamp(timestamp)}_${shortUserId}.json`;

      // Write backup file atomically
      if (window.katanos?.writeBackupFile) {
        const result = await window.katanos.writeBackupFile({
          folderPath: settings.folderPath,
          fileName,
          data: manifest,
        });

        if (!result.success) {
          await this.updateBackupStatus(userId, settings, isoTimestamp, 'failed');
          this.notifyBackupFailure('backupWriteFailed');
          return {
            success: false,
            timestamp: isoTimestamp,
            error: result.error || 'Write failed',
          };
        }

        // Apply retention policy
        await this.applyRetentionPolicy({
          ...settings,
          retentionMode,
          retentionValue,
          interval: normalizeInterval(settings.interval) as BackupInterval,
        });

        await this.updateBackupStatus(userId, settings, isoTimestamp, 'success');
        // Notify success
        this.notifyBackupSuccess();

        return {
          success: true,
          path: result.path,
          timestamp: isoTimestamp,
          sizeBytes: JSON.stringify(manifest).length,
        };
      } else {
        // Fallback for browser/web version - download file
        const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        await this.updateBackupStatus(userId, settings, isoTimestamp, 'success');
        return {
          success: true,
          timestamp: isoTimestamp,
          sizeBytes: blob.size,
        };
      }
    } catch (error) {
      await this.updateBackupStatus(userId, settings, isoTimestamp, 'failed');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.notifyBackupFailure('backupError');
      return {
        success: false,
        timestamp: isoTimestamp,
        error: errorMessage,
      };
    }
  },

  /**
   * Apply retention policy - delete old backups
   */
  async applyRetentionPolicy(settings: BackupSettings): Promise<string[]> {
    if (!settings.folderPath || !window.katanos?.listBackupFiles) {
      return [];
    }

    try {
      const files = await window.katanos.listBackupFiles(settings.folderPath);
      if (!files || files.length === 0) return [];

      // Sort by modification time, newest first
      const sorted = [...files].sort((a, b) => b.mtime - a.mtime);

      let toDelete: BackupFileInfo[] = [];

      const retentionValue = Number.isFinite(settings.retentionValue) ? settings.retentionValue : 10;
      if (settings.retentionMode === 'count') {
        // Keep last N backups
        toDelete = sorted.slice(retentionValue);
      } else {
        // Keep backups from last N days
        const cutoff = Date.now() - retentionValue * 24 * 60 * 60 * 1000;
        toDelete = sorted.filter((f) => f.mtime < cutoff);
      }

      const deletedPaths: string[] = [];
      for (const file of toDelete) {
        if (window.katanos?.deleteBackupFile) {
          try {
            await window.katanos.deleteBackupFile(file.path);
            deletedPaths.push(file.path);
          } catch {
            // Ignore individual delete failures
          }
        }
      }

      return deletedPaths;
    } catch {
      return [];
    }
  },

  /**
   * Get list of existing backup files
   */
  async getBackupHistory(folderPath: string): Promise<BackupFileInfo[]> {
    if (!folderPath || !window.katanos?.listBackupFiles) {
      return [];
    }

    try {
      const files = await window.katanos.listBackupFiles(folderPath);
      return [...files].sort((a, b) => b.mtime - a.mtime);
    } catch {
      return [];
    }
  },

  /**
   * Start the backup scheduler for a user
   */
  startScheduler(user: User) {
    const settings = user.backupSettings;
    if (!settings?.enabled) {
      backupScheduler.stop();
      return;
    }
    backupScheduler.start(user.id, settings);
  },

  /**
   * Stop the backup scheduler
   */
  stopScheduler() {
    backupScheduler.stop();
  },

  async updateBackupStatus(
    userId: string,
    settings: BackupSettings,
    isoTimestamp: string,
    status: 'success' | 'failed'
  ) {
    try {
      const normalizedInterval = normalizeInterval(settings.interval);
      await db.auth.updateSettings(userId, {
        backupSettings: {
          ...settings,
          interval: normalizedInterval as BackupInterval,
          retentionMode: settings.retentionMode || 'count',
          retentionValue: Number.isFinite(settings.retentionValue) ? settings.retentionValue : 10,
          lastBackupAt: isoTimestamp,
          lastBackupStatus: status,
        },
      });
    } catch (error) {
      console.warn('Failed to persist backup status', error);
    }
  },

  /**
   * Notify backup success
   */
  notifyBackupSuccess() {
    const lang = this.getNotificationLang();
    window.dispatchEvent(
      new CustomEvent('katanos:notify', {
        detail: {
          title: t('backupSuccess', lang) || 'Backup exported successfully!',
          message: t('backupNowSuccess', lang) || 'Backup completed successfully!',
          type: 'success',
          silent: true,
        },
      })
    );
  },

  /**
   * Notify backup failure
   */
  notifyBackupFailure(messageKey: string) {
    const lang = this.getNotificationLang();
    const messageMap: Record<string, string> = {
      backupFolderNotWritable: t('backupFolderNotWritable', lang),
      backupWriteFailed: t('backupWriteFailed', lang),
      backupError: t('backupError', lang),
    };
    const message = messageMap[messageKey] || t('backupError', lang) || messageKey;
    window.dispatchEvent(
      new CustomEvent('katanos:notify', {
        detail: {
          title: t('error', lang) || 'Error',
          message,
          type: 'warning',
        },
      })
    );
  },

  /**
   * Select backup folder (opens native dialog)
   */
  async selectBackupFolder(): Promise<string | null> {
    if (!window.katanos?.selectBackupFolder) {
      return null;
    }
    const result = await window.katanos.selectBackupFolder();
    if (result.canceled || !result.path) {
      return null;
    }
    return result.path;
  },

  /**
   * Convert interval to human-readable label
   */
  getIntervalLabel(interval: BackupInterval, lang: string): string {
    const labels: Record<BackupInterval, Record<string, string>> = {
      '30m': { it: 'Ogni 30 minuti', en: 'Every 30 minutes', fr: 'Toutes les 30 minutes', es: 'Cada 30 minutos', de: 'Alle 30 Minuten' },
      '1h': { it: 'Ogni ora', en: 'Every hour', fr: 'Toutes les heures', es: 'Cada hora', de: 'Jede Stunde' },
      '6h': { it: 'Ogni 6 ore', en: 'Every 6 hours', fr: 'Toutes les 6 heures', es: 'Cada 6 horas', de: 'Alle 6 Stunden' },
      '12h': { it: 'Ogni 12 ore', en: 'Every 12 hours', fr: 'Toutes les 12 heures', es: 'Cada 12 horas', de: 'Alle 12 Stunden' },
      '24h': { it: 'Ogni 24 ore', en: 'Every 24 hours', fr: 'Toutes les 24 heures', es: 'Cada 24 horas', de: 'Alle 24 Stunden' },
      daily: { it: 'Giornaliero', en: 'Daily', fr: 'Quotidien', es: 'Diario', de: 'Täglich' },
      weekly: { it: 'Settimanale', en: 'Weekly', fr: 'Hebdomadaire', es: 'Semanal', de: 'Wöchentlich' },
      monthly: { it: 'Mensile', en: 'Monthly', fr: 'Mensuel', es: 'Mensual', de: 'Monatlich' },
    };
    return labels[interval]?.[lang] || labels[interval]?.en || interval;
  },
};

export default backupService;

