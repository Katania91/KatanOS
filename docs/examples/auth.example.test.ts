import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../services/db';

describe('Auth examples (docs)', () => {
  beforeAll(async () => {
    await db.init();
  });

  it('registers and logs in a user', async () => {
    const username = `doc_user_${Date.now()}`;
    const { user: created, error: regErr } = await db.auth.register(username, 'testpass');
    expect(regErr).toBeUndefined();
    expect(created).toBeDefined();
    expect(created?.username).toBe(username);

    const { user, error } = await db.auth.login(username, 'testpass');
    expect(error).toBeUndefined();
    expect(user).toBeDefined();
    expect(user?.username).toBe(username);
  });
});
