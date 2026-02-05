export {};

interface BackupFileInfo {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

declare global {
  interface Window {
    katanos?: {
      saveSnapshot: (payload: unknown) => Promise<{ path?: string }>;
      exportSnapshot: (
        payload: unknown,
        suggestedName?: string
      ) => Promise<{ canceled?: boolean; path?: string }>;
      exportUserFolder: (
        payload: unknown,
        suggestedName?: string
      ) => Promise<{ canceled?: boolean; path?: string }>;
      importUserFolder: () => Promise<{ canceled?: boolean; payload?: unknown }>;
      setFullScreen: (enabled: boolean) => Promise<boolean>;
      isFullScreen: () => Promise<boolean>;
      minimize: () => Promise<boolean>;
      confirmClose: () => Promise<boolean>;
      deleteUserData: (userId: string) => Promise<boolean>;
      openExternal: (url: string) => Promise<boolean>;
      copyText: (text: string) => Promise<boolean>;
      openStorePage: () => Promise<boolean>;
      setRichPresence: (payload: { details?: string; state?: string }) => Promise<boolean>;
      logError: (payload: unknown) => Promise<boolean>;
      encryptSecret: (value: string) => Promise<{ ok?: boolean; value?: string; error?: string }>;
      decryptSecret: (value: string) => Promise<{ ok?: boolean; value?: string; error?: string }>;
      getAppInfo: () => Promise<{
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
      }>;
      openLogFolder: () => Promise<{ ok?: boolean; error?: string }>;
      signalReady: () => Promise<void>;
      onRequestClose: (callback: () => void) => () => void;
      // Backup system APIs
      selectBackupFolder: () => Promise<{ canceled: boolean; path: string | null }>;
      writeBackupFile: (options: {
        folderPath: string;
        fileName: string;
        data: unknown;
      }) => Promise<{ success: boolean; path?: string; error?: string }>;
      listBackupFiles: (folderPath: string) => Promise<BackupFileInfo[]>;
      deleteBackupFile: (filePath: string) => Promise<boolean>;
      checkFolderWritable: (folderPath: string) => Promise<{ writable: boolean }>;
    };
  }
}
