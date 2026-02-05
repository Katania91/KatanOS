const { app, BrowserWindow, ipcMain, dialog, session, screen, shell, clipboard, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

const USER_DATA_FILES = ['events', 'todos', 'transactions', 'contacts', 'habits', 'journal'];
let isQuitting = false;
const DISCORD_CLIENT_ID = '1452921961641541713';
const DISCORD_LARGE_IMAGE_KEY = 'KatanOS_Logo';
const appStartTimestamp = new Date();
const STORE_PRODUCT_ID = '9NBNSBD58DNL';
const STORE_URI = `ms-windows-store://pdp/?productid=${STORE_PRODUCT_ID}`;
const STORE_WEB_URL = `https://apps.microsoft.com/store/detail/${STORE_PRODUCT_ID}`;
const WEBSITE_URL = 'https://katania.me/katanos';
let rpcClient = null;
let rpcReady = false;
let rpcConnectAttempted = false;
let lastPresence = null;
const SECRET_PREFIX = 'enc$';

app.setName('KatanOS');
app.setAppUserModelId('com.katanos.app');
if (!app.isPackaged) {
  app.commandLine.appendSwitch('unsafely-treat-insecure-origin-as-secure', 'file://*');
}

const getAppDir = () => path.join(app.getPath('userData'), 'katanos');
const getUsersDir = () => path.join(getAppDir(), 'users');
const getUserDir = (userId) => path.join(getUsersDir(), userId);
const getLogDir = () => path.join(getAppDir(), 'logs');
const getLogFile = () => path.join(getLogDir(), 'errors.log');

const applyContentSecurityPolicy = () => {
  if (!app.isPackaged) return;
  const csp = [
    "default-src 'self' file:",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.open-meteo.com https://geocoding-api.open-meteo.com https://nominatim.openstreetmap.org https://ipapi.co https://api.coingecko.com https://generativelanguage.googleapis.com https://*.wikipedia.org https://www.googleapis.com",
    "media-src 'self'",
    "frame-src https://maps.google.com https://www.google.com",
    "worker-src 'self' blob:",
    "form-action 'self'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders || {}) };
    if (details.resourceType === 'mainFrame' && /^file:/i.test(details.url)) {
      responseHeaders['Content-Security-Policy'] = [csp];
    }
    callback({ responseHeaders });
  });
};

const safeStringify = (value) => {
  const seen = new WeakSet();
  try {
    return JSON.stringify(value, (key, val) => {
      if (val instanceof Error) {
        return { name: val.name, message: val.message, stack: val.stack };
      }
      if (typeof val === 'bigint') {
        return val.toString();
      }
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      return val;
    });
  } catch (e) {
    return JSON.stringify({ message: 'Log serialization failed', error: String(e) });
  }
};

const ensureLogDir = async () => {
  await fs.mkdir(getLogDir(), { recursive: true });
};

const ensureLogFile = async () => {
  await ensureLogDir();
  const logFile = getLogFile();
  try {
    await fs.access(logFile);
  } catch (e) {
    await fs.writeFile(logFile, '', 'utf8');
  }
};

const appendLogLine = async (entry) => {
  try {
    await ensureLogFile();
    const line = safeStringify(entry);
    await fs.appendFile(getLogFile(), `${line}\n`, 'utf8');
  } catch (e) {
    // Swallow logging errors to avoid recursive crashes.
  }
};

const normalizeError = (value) => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value === 'string') {
    return { message: value };
  }
  return { value };
};

const logError = (entry) => {
  const payload = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  void appendLogLine(payload);
};

const getAppInfo = () => ({
  appVersion: app.getVersion(),
  appName: app.getName(),
  isPackaged: app.isPackaged,
  appPath: app.getAppPath(),
  userDataPath: app.getPath('userData'),
  katanosDataPath: getAppDir(),
  logPath: getLogFile(),
  logDir: getLogDir(),
  platform: process.platform,
  arch: process.arch,
  osVersion: os.release(),
  locale: app.getLocale(),
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  nodeVersion: process.versions.node,
  v8Version: process.versions.v8,
  uptimeSec: process.uptime(),
  startedAt: appStartTimestamp.toISOString(),
  totalMemory: os.totalmem(),
  freeMemory: os.freemem(),
});

const ensureDir = async () => {
  await fs.mkdir(getAppDir(), { recursive: true });
};

const initDiscordRpc = () => {
  if (rpcConnectAttempted) return;
  rpcConnectAttempted = true;
  try {
    const RPC = require('discord-rpc');
    if (typeof RPC.register === 'function') {
      RPC.register(DISCORD_CLIENT_ID);
    }
    rpcClient = new RPC.Client({ transport: 'ipc' });
    rpcClient.on('ready', () => {
      rpcReady = true;
      if (lastPresence) {
        void setDiscordPresence(lastPresence);
      }
    });
    rpcClient.on('disconnected', () => {
      rpcReady = false;
    });
    rpcClient.login({ clientId: DISCORD_CLIENT_ID }).catch(() => { });
  } catch (e) {
    rpcClient = null;
    rpcReady = false;
  }
};

const setDiscordPresence = async (payload) => {
  lastPresence = payload;
  if (!rpcClient || !rpcReady) return false;
  const details = typeof payload?.details === 'string' ? payload.details : 'KatanOS';
  const state = typeof payload?.state === 'string' ? payload.state : '';
  const activity = {
    details,
    state,
    largeImageKey: DISCORD_LARGE_IMAGE_KEY,
    largeImageText: details || 'KatanOS',
    startTimestamp: appStartTimestamp,
    instance: false,
    buttons: [
      { label: 'Website', url: WEBSITE_URL },
      { label: 'Microsoft Store', url: STORE_WEB_URL },
    ],
  };
  await rpcClient.setActivity(activity);
  return true;
};

const getDefaultWindowSize = () => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const targetWidth = Math.round(width * 0.9);
  const targetHeight = Math.round(height * 0.9);
  return {
    width: Math.min(width, Math.max(1024, targetWidth)),
    height: Math.min(height, Math.max(720, targetHeight)),
  };
};

const writeJson = async (filePath, payload) => {
  const json = JSON.stringify(payload, null, 2);
  await fs.writeFile(filePath, json, 'utf8');
};

const readJson = async (filePath, fallback) => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return fallback;
  }
};

const SUPPORTED_SPLASH_LANGS = new Set(['it', 'en', 'fr', 'es', 'de']);

const normalizeSplashLang = (value) => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  if (SUPPORTED_SPLASH_LANGS.has(normalized)) return normalized;
  const base = normalized.split('-')[0];
  return SUPPORTED_SPLASH_LANGS.has(base) ? base : null;
};

const getLocaleSplashLang = () => normalizeSplashLang(app.getLocale()) || 'en';

const getStoredSplashLang = async () => {
  const meta = await readJson(path.join(getAppDir(), 'meta.json'), null);
  const userLang = normalizeSplashLang(meta?.currentUser?.language);
  if (userLang) return userLang;
  const lastLoginLang = normalizeSplashLang(meta?.extras?.appLocalStorage?.katanos_last_login_lang);
  if (lastLoginLang) return lastLoginLang;
  return null;
};

const resolveSplashLanguage = async () => {
  const stored = await getStoredSplashLang();
  return stored || getLocaleSplashLang();
};

const splitDataByUser = (data) => {
  const perUser = {};
  if (!data) return perUser;

  USER_DATA_FILES.forEach((key) => {
    const items = Array.isArray(data[key]) ? data[key] : [];
    items.forEach((item) => {
      if (!item || !item.userId) return;
      if (!perUser[item.userId]) perUser[item.userId] = {};
      if (!perUser[item.userId][key]) perUser[item.userId][key] = [];
      perUser[item.userId][key].push(item);
    });
  });

  return perUser;
};

const writeAutosave = async (payload) => {
  await ensureDir();
  const data = payload?.data || {};
  const users = Array.isArray(data.users) ? data.users : [];
  const perUser = splitDataByUser(data);
  const userIds = new Set([
    ...users.map((user) => user.id).filter(Boolean),
    ...Object.keys(perUser),
  ]);

  await fs.mkdir(getUsersDir(), { recursive: true });
  await writeJson(path.join(getAppDir(), 'users.json'), users);

  const meta = {
    version: payload?.version || '1.0',
    timestamp: payload?.timestamp || new Date().toISOString(),
    userId: payload?.userId || null,
    currentUser: payload?.currentUser || null,
    extras: payload?.extras || {},
  };
  await writeJson(path.join(getAppDir(), 'meta.json'), meta);

  for (const userId of userIds) {
    const userDir = getUserDir(userId);
    await fs.mkdir(userDir, { recursive: true });
    for (const key of USER_DATA_FILES) {
      const items = perUser[userId]?.[key] || [];
      await writeJson(path.join(userDir, `${key}.json`), items);
    }
  }
};

const writeUserExport = async (targetDir, payload) => {
  const data = payload?.data || {};
  const users = Array.isArray(data.users) ? data.users : [];

  const meta = {
    version: payload?.version || '1.0',
    timestamp: payload?.timestamp || new Date().toISOString(),
    userId: payload?.userId || null,
    currentUser: payload?.currentUser || users[0] || null,
    extras: payload?.extras || {},
    scope: 'user',
  };

  await fs.mkdir(targetDir, { recursive: true });
  await writeJson(path.join(targetDir, 'meta.json'), meta);
  await writeJson(path.join(targetDir, 'users.json'), users);

  for (const key of USER_DATA_FILES) {
    const items = Array.isArray(data[key]) ? data[key] : [];
    await writeJson(path.join(targetDir, `${key}.json`), items);
  }
};

const createWindow = async () => {
  const { width, height } = getDefaultWindowSize();
  const splashLang = await resolveSplashLanguage();

  // Create splash window first
  const splash = new BrowserWindow({
    width: 400,
    height: 450,
    frame: false,
    resizable: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0f172a',
    show: true,
    center: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splash.loadURL(`file://${path.join(__dirname, 'splash.html')}?lang=${splashLang}`);

  // Create main window (hidden initially)
  const win = new BrowserWindow({
    width,
    height,
    frame: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    fullscreenable: true,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: false,
    },
  });

  const isDev = !app.isPackaged;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || (isDev ? 'http://localhost:3000' : null);
  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show main window after splash duration (5 seconds)
  const SPLASH_DURATION = 5000;

  const showMainWindow = () => {
    if (!win.isDestroyed()) {
      win.show();
    }
    if (!splash.isDestroyed()) {
      splash.close();
    }
  };

  // Timer for splash duration
  const splashTimeout = setTimeout(showMainWindow, SPLASH_DURATION);

  // Also listen for app ready signal (in case app loads faster)
  ipcMain.handleOnce('katanos:signalReady', () => {
    // Don't show early - wait for splash to complete
    // But if splash already done, this won't matter
  });

  // Fallback: show window after 10s if something goes wrong
  const showTimeout = setTimeout(() => {
    clearTimeout(splashTimeout);
    showMainWindow();
  }, 10000);

  // Clean up fallback timeout when splash completes normally
  splash.on('closed', () => {
    clearTimeout(showTimeout);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:|^mailto:/i.test(url)) {
      shell.openExternal(url).catch((error) => {
        logError({ source: 'main', type: 'open-external-failed', url, error: normalizeError(error) });
      });
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (/^https?:|^mailto:/i.test(url)) {
      event.preventDefault();
      shell.openExternal(url).catch((error) => {
        logError({ source: 'main', type: 'open-external-failed', url, error: normalizeError(error) });
      });
    }
  });
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level >= 2) {
      logError({
        source: 'renderer',
        type: 'console-message',
        level,
        message,
        line,
        sourceId,
        url: win.webContents.getURL(),
      });
    }
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    logError({
      source: 'main',
      type: 'render-process-gone',
      details,
      url: win.webContents.getURL(),
    });
  });
  win.webContents.on('unresponsive', () => {
    logError({
      source: 'main',
      type: 'renderer-unresponsive',
      url: win.webContents.getURL(),
    });
  });

  win.setMenuBarVisibility(false);

  win.on('close', (event) => {
    if (isQuitting) return;
    if (win.webContents.isDestroyed()) return;
    event.preventDefault();
    win.webContents.send('katanos:requestClose');
  });
};

ipcMain.handle('katanos:saveSnapshot', async (_event, payload) => {
  await writeAutosave(payload);
  return { path: getAppDir() };
});

ipcMain.handle('katanos:exportSnapshot', async (_event, payload, suggestedName) => {
  await ensureDir();
  const defaultName = suggestedName || 'katanos_backup.json';
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export KatanOS Backup',
    defaultPath: path.join(getAppDir(), defaultName),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (canceled || !filePath) {
    return { canceled: true };
  }

  await writeJson(filePath, payload);
  return { canceled: false, path: filePath };
});

ipcMain.handle('katanos:exportUserFolder', async (_event, payload, suggestedName) => {
  await ensureDir();
  const date = new Date().toISOString().slice(0, 10);
  const userId = payload?.userId || payload?.currentUser?.id || 'user';
  const defaultName = suggestedName || `katanos_backup_${date}_${userId}`;

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Export KatanOS Backup Folder',
    properties: ['openDirectory'],
  });

  if (canceled || !filePaths || !filePaths[0]) {
    return { canceled: true };
  }

  const targetDir = path.join(filePaths[0], defaultName);
  await writeUserExport(targetDir, payload);
  return { canceled: false, path: targetDir };
});

ipcMain.handle('katanos:setFullScreen', async (event, enabled) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  if (enabled) {
    win.setFullScreen(true);
  } else {
    win.setFullScreen(false);
  }
  return win.isFullScreen();
});

ipcMain.handle('katanos:isFullScreen', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return win ? win.isFullScreen() : false;
});

ipcMain.handle('katanos:minimize', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return false;
  win.minimize();
  return true;
});

ipcMain.handle('katanos:confirmClose', async () => {
  isQuitting = true;
  app.quit();
  return true;
});

ipcMain.handle('katanos:setRichPresence', async (_event, payload) => {
  initDiscordRpc();
  try {
    return await setDiscordPresence(payload);
  } catch (e) {
    return false;
  }
});

ipcMain.handle('katanos:openExternal', async (_event, url) => {
  if (!url || typeof url !== 'string') return false;
  if (!/^https?:|^mailto:/i.test(url)) return false;
  try {
    await shell.openExternal(url);
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('katanos:encryptSecret', async (_event, value) => {
  if (typeof value !== 'string') return { ok: false, error: 'invalid' };
  if (!value) return { ok: true, value: '' };
  if (value.startsWith(SECRET_PREFIX)) return { ok: true, value };
  if (!safeStorage.isEncryptionAvailable()) {
    logError({ source: 'main', type: 'secret-encryption-unavailable' });
    return { ok: false, error: 'unavailable' };
  }
  try {
    const encrypted = safeStorage.encryptString(value).toString('base64');
    return { ok: true, value: `${SECRET_PREFIX}${encrypted}` };
  } catch (error) {
    logError({ source: 'main', type: 'secret-encryption-failed', error: normalizeError(error) });
    return { ok: false, error: 'failed' };
  }
});

ipcMain.handle('katanos:decryptSecret', async (_event, value) => {
  if (typeof value !== 'string') return { ok: false, error: 'invalid' };
  if (!value) return { ok: true, value: '' };
  if (!value.startsWith(SECRET_PREFIX)) return { ok: true, value };
  if (!safeStorage.isEncryptionAvailable()) {
    logError({ source: 'main', type: 'secret-decryption-unavailable' });
    return { ok: false, error: 'unavailable' };
  }
  try {
    const payload = value.slice(SECRET_PREFIX.length);
    const decrypted = safeStorage.decryptString(Buffer.from(payload, 'base64'));
    return { ok: true, value: decrypted };
  } catch (error) {
    logError({ source: 'main', type: 'secret-decryption-failed', error: normalizeError(error) });
    return { ok: false, error: 'failed' };
  }
});

ipcMain.handle('katanos:copyText', async (_event, text) => {
  if (!text || typeof text !== 'string') return false;
  try {
    clipboard.writeText(text);
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('katanos:deleteUserData', async (_event, userId) => {
  if (!userId) return false;
  try {
    await fs.rm(getUserDir(userId), { recursive: true, force: true });
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.handle('katanos:importUserFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import KatanOS Backup Folder',
    properties: ['openDirectory'],
  });

  if (canceled || !filePaths || !filePaths[0]) {
    return { canceled: true };
  }

  const folder = filePaths[0];
  const meta = await readJson(path.join(folder, 'meta.json'), {});
  const users = await readJson(path.join(folder, 'users.json'), []);
  const data = {};

  for (const key of USER_DATA_FILES) {
    data[key] = await readJson(path.join(folder, `${key}.json`), []);
  }

  const payload = {
    version: meta.version || '1.0',
    timestamp: meta.timestamp || new Date().toISOString(),
    userId: meta.userId || meta.currentUser?.id || users[0]?.id || null,
    currentUser: meta.currentUser || users[0] || null,
    scope: 'user',
    extras: meta.extras || {},
    data: {
      users,
      ...data,
    },
  };

  return { canceled: false, payload };
});

ipcMain.handle('katanos:openStorePage', async () => {
  try {
    if (process.platform === 'win32') {
      await shell.openExternal(STORE_URI);
      return true;
    }
    await shell.openExternal(STORE_WEB_URL);
    return true;
  } catch (e) {
    try {
      await shell.openExternal(STORE_WEB_URL);
      return true;
    } catch (err) {
      return false;
    }
  }
});

// === BACKUP SYSTEM IPC HANDLERS ===

ipcMain.handle('katanos:selectBackupFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Backup Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  return { canceled, path: filePaths?.[0] || null };
});

ipcMain.handle('katanos:writeBackupFile', async (_event, { folderPath, fileName, data }) => {
  // Atomic write: write to .tmp then rename
  const tempPath = path.join(folderPath, `${fileName}.tmp`);
  const finalPath = path.join(folderPath, fileName);

  try {
    // Ensure folder exists
    await fs.mkdir(folderPath, { recursive: true });

    // Write to temp file first
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(tempPath, json, 'utf8');

    // Atomic rename
    await fs.rename(tempPath, finalPath);

    return { success: true, path: finalPath };
  } catch (error) {
    // Cleanup temp file if exists
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('katanos:listBackupFiles', async (_event, folderPath) => {
  try {
    const files = await fs.readdir(folderPath);
    const backups = files.filter(
      (f) => f.startsWith('katanos-backup-') && f.endsWith('.json')
    );

    const results = [];
    for (const f of backups) {
      try {
        const filePath = path.join(folderPath, f);
        const stat = await fs.stat(filePath);
        results.push({
          name: f,
          path: filePath,
          size: stat.size,
          mtime: stat.mtimeMs,
        });
      } catch {
        // Skip files we can't stat
      }
    }

    return results;
  } catch (error) {
    return [];
  }
});

ipcMain.handle('katanos:deleteBackupFile', async (_event, filePath) => {
  try {
    // Security: only delete files that match our backup pattern
    const fileName = path.basename(filePath);
    if (!fileName.startsWith('katanos-backup-') || !fileName.endsWith('.json')) {
      return false;
    }
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('katanos:checkFolderWritable', async (_event, folderPath) => {
  try {
    // Ensure folder exists
    await fs.mkdir(folderPath, { recursive: true });

    // Try to write a test file
    const testFile = path.join(folderPath, '.katanos_write_test');
    await fs.writeFile(testFile, 'test', 'utf8');
    await fs.unlink(testFile);
    return { writable: true };
  } catch {
    return { writable: false };
  }
});

ipcMain.handle('katanos:logError', async (_event, payload) => {
  const data = payload && typeof payload === 'object' ? payload : { message: String(payload) };
  logError({
    ...data,
    source: data.source || 'renderer',
  });
  return true;
});

ipcMain.handle('katanos:getAppInfo', async () => {
  return getAppInfo();
});

ipcMain.handle('katanos:openLogFolder', async () => {
  try {
    await ensureLogDir();
    const logFile = getLogFile();
    try {
      await fs.access(logFile);
      shell.showItemInFolder(logFile);
      return { ok: true };
    } catch (e) {
      const result = await shell.openPath(getLogDir());
      if (result) {
        logError({ source: 'main', type: 'open-path-failed', message: result, path: getLogDir() });
        return { ok: false, error: result };
      }
      return { ok: true };
    }
  } catch (e) {
    logError({ source: 'main', type: 'open-log-folder-failed', error: normalizeError(e) });
    return { ok: false, error: 'open-log-folder-failed' };
  }
});

app.whenReady().then(() => {
  applyContentSecurityPolicy();
  const isTrustedOrigin = (url) => {
    if (!url) return false;
    return (
      url.startsWith('file://') ||
      url.startsWith('app://') ||
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1')
    );
  };
  const allowPermission = (permission, url) => permission === 'geolocation' && isTrustedOrigin(url);
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestUrl = details?.requestingUrl || webContents.getURL();
    callback(allowPermission(permission, requestUrl));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
    const requestUrl = requestingOrigin || webContents.getURL();
    return allowPermission(permission, requestUrl);
  });

  void ensureLogFile();
  initDiscordRpc();
  void createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

process.on('uncaughtException', (error) => {
  logError({ source: 'main', type: 'uncaughtException', error: normalizeError(error) });
});

process.on('unhandledRejection', (reason) => {
  logError({ source: 'main', type: 'unhandledRejection', error: normalizeError(reason) });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
