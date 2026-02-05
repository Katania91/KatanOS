import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../services/db';
import { createVault, unlockVault } from '../../services/vault';

describe('Vault examples (docs)', () => {
  beforeAll(async () => {
    await db.init();
  });

  it('creates and unlocks a vault', async () => {
    const { user } = await db.auth.register(`vault_user_${Date.now()}`, 'vpass');
    expect(user).toBeDefined();

    const password = 'strong-doc-pass';
    const { vault, recoveryCode } = await createVault(user!.id, password, []);
    expect(vault).toBeDefined();
    expect(typeof recoveryCode).toBe('string');

    const items = await unlockVault(vault, password);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
  });
});
