# Docs examples

This folder contains runnable Vitest example tests that demonstrate common developer flows used in the documentation:

- `auth.example.test.ts` — register + login flow using `db.auth`.
- `backup.example.test.ts` — trigger a backup with a mocked `window.katanos` bridge.
- `vault.example.test.ts` — create and unlock an encrypted vault.

Run a single example locally with:

```bash
npm run test -- docs/examples/*.example.test.ts
```

If your environment needs a browser-like `window` or `localStorage`, run Vitest with `--env=jsdom`.
