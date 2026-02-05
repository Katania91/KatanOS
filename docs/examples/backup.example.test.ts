import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../services/db';
import backupService from '../../services/backup';

// Minimal window.katanos mock used by backupService during tests
globalThis.window = globalThis.window || ({} as any);
globalThis.window.katanos = {
  checkFolderWritable: async (path: string) => ({ writable: true }),
  writeBackupFile: async ({ folderPath, fileName }: any) => ({ success: true, path: `${folderPath}/${fileName}` }),
  listBackupFiles: async (folderPath: string) => [],
  deleteBackupFile: async (p: string) => ({ success: true }),
};

describe('Backup examples (docs)', () => {
  beforeAll(async () => {
    await db.init();
  });

  it('creates a user backup using the backupService', async () => {
    const { user } = await db.auth.register(`backup_user_${Date.now()}`, 'bpw');
    expect(user).toBeDefined();

    const settings = backupService.getDefaultSettings();
    settings.enabled = true;
    settings.folderPath = '/tmp/katanos-tests';

    const result = await backupService.triggerBackupNow(user!.id, settings);
    expect(result.success).toBe(true);
    expect(result.path).toBeDefined();
  });
});
