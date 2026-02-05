
import { EncryptedVault, VaultItem } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Configuration for "Extreme Security"
const PBKDF2_ITERATIONS = 300000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const ALGORITHM_NAME = 'AES-GCM';
const HASH_ALGORITHM = 'SHA-256';

// Utility to convert between ArrayBuffer and Base64
const toBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const fromBase64 = (base64: string): Uint8Array => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const getCrypto = () => {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment.');
  }
  return window.crypto;
};

/**
 * Generates a random 256-bit Master Key.
 */
const generateMasterKey = async (): Promise<CryptoKey> => {
  const crypto = getCrypto();
  return await crypto.subtle.generateKey(
    { name: ALGORITHM_NAME, length: KEY_LENGTH },
    true, // Extractable because we need to wrap it
    ['encrypt', 'decrypt']
  );
};

/**
 * Derives a Key-Wrapping Key (KWK) from a password/code.
 */
const deriveWrappingKey = async (password: string, salt: Uint8Array): Promise<CryptoKey> => {
  const crypto = getCrypto();
  const textEncoder = new TextEncoder();
  const passwordBuffer = textEncoder.encode(password);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    importedKey,
    { name: ALGORITHM_NAME, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'] // Used to encrypt/decrypt the Master Key
  );
};

/**
 * Encrypts (Wraps) the Master Key using a password.
 */
const wrapMasterKey = async (masterKey: CryptoKey, password: string) => {
  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const wrappingKey = await deriveWrappingKey(password, salt);

  // Export Master Key to raw bytes to encrypt it
  const masterKeyData = await crypto.subtle.exportKey('raw', masterKey);

  const encryptedMasterKey = await crypto.subtle.encrypt(
    { name: ALGORITHM_NAME, iv },
    wrappingKey,
    masterKeyData
  );

  return {
    salt: toBase64(salt.buffer),
    iv: toBase64(iv.buffer),
    data: toBase64(encryptedMasterKey)
  };
};

/**
 * Decrypts (Unwraps) the Master Key using a password.
 */
const unwrapMasterKey = async (
  password: string,
  saltB64: string,
  ivB64: string,
  dataB64: string
): Promise<CryptoKey> => {
  const crypto = getCrypto();
  const salt = fromBase64(saltB64);
  const iv = fromBase64(ivB64);
  const data = fromBase64(dataB64);

  const wrappingKey = await deriveWrappingKey(password, salt);

  try {
    const masterKeyData = await crypto.subtle.decrypt(
      { name: ALGORITHM_NAME, iv: iv as BufferSource },
      wrappingKey,
      data
    );

    return await crypto.subtle.importKey(
      'raw',
      masterKeyData,
      { name: ALGORITHM_NAME, length: KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  } catch (e) {
    throw new Error('Incorrect password or corrupted key data.');
  }
};

/**
 * Creates a NEW Vault.
 * Generates a Master Key, encrypts it with Password, encrypts it with Recovery Code.
 * Returns the vault structure and the generated Recovery Code (to show to user).
 */
export const createVault = async (userId: string, password: string, initialData: VaultItem[] = []) => {
  const crypto = getCrypto();
  const masterKey = await generateMasterKey();

  // 1. Generate Recovery Code
  const recoveryCode = uuidv4().toUpperCase(); // Simple UUID as recovery code for now

  // 2. Wrap Master Key with Password
  const wrappedWithPass = await wrapMasterKey(masterKey, password);

  // 3. Wrap Master Key with Recovery Code
  const wrappedWithRecovery = await wrapMasterKey(masterKey, recoveryCode);

  // 4. Encrypt Data with Master Key
  const textEncoder = new TextEncoder();
  const dataIV = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const jsonString = JSON.stringify(initialData);
  const encryptedData = await crypto.subtle.encrypt(
    { name: ALGORITHM_NAME, iv: dataIV },
    masterKey,
    textEncoder.encode(jsonString)
  );

  const vault: EncryptedVault = {
    userId,
    dataIV: toBase64(dataIV.buffer),
    data: toBase64(encryptedData),

    wrappedKeySalt: wrappedWithPass.salt,
    wrappedKeyIV: wrappedWithPass.iv,
    wrappedKey: wrappedWithPass.data,

    recoverySalt: wrappedWithRecovery.salt,
    recoveryIV: wrappedWithRecovery.iv,
    recoveryKey: wrappedWithRecovery.data
  };

  return { vault, recoveryCode };
};

/**
 * Unlocks the vault using the Password.
 */
export const unlockVault = async (vault: EncryptedVault, password: string): Promise<VaultItem[]> => {
  const crypto = getCrypto();
  const textDecoder = new TextDecoder();

  // 1. Unwrap Master Key
  const masterKey = await unwrapMasterKey(
    password,
    vault.wrappedKeySalt,
    vault.wrappedKeyIV,
    vault.wrappedKey
  );

  // 2. Decrypt Data
  const dataIV = fromBase64(vault.dataIV);
  const encryptedData = fromBase64(vault.data);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM_NAME, iv: dataIV as BufferSource },
    masterKey,
    encryptedData
  );

  return JSON.parse(textDecoder.decode(decryptedBuffer));
};

/**
 * Recovers the vault using the Recovery Code.
 * Returns the data so the user can see it, but usually followed by a password reset.
 */
export const recoverVault = async (vault: EncryptedVault, recoveryCode: string): Promise<VaultItem[]> => {
  const crypto = getCrypto();
  const textDecoder = new TextDecoder();

  // 1. Unwrap Master Key using Recovery Block
  const masterKey = await unwrapMasterKey(
    recoveryCode,
    vault.recoverySalt,
    vault.recoveryIV,
    vault.recoveryKey
  );

  // 2. Decrypt Data
  const dataIV = fromBase64(vault.dataIV);
  const encryptedData = fromBase64(vault.data);

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM_NAME, iv: dataIV as BufferSource },
    masterKey,
    encryptedData
  );

  return JSON.parse(textDecoder.decode(decryptedBuffer));
};

/**
 * Saves the vault (re-encrypts data with existing Master Key).
 * NOTE: This requires the Master Key to be present in memory (passed as arg or managed in context).
 * For statelessness, we usually re-unlock or keep the decrypted data in memory and re-encrypt on save.
 * 
 * To avoid re-asking password on every save, we need to keep the Master Key in memory in the App state.
 */
export const saveVault = async (data: VaultItem[], masterKey: CryptoKey, originalVault: EncryptedVault): Promise<EncryptedVault> => {
  const crypto = getCrypto();
  const textEncoder = new TextEncoder();

  // Encrypt new data with SAME Master Key
  const dataIV = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const jsonString = JSON.stringify(data);
  const encryptedData = await crypto.subtle.encrypt(
    { name: ALGORITHM_NAME, iv: dataIV },
    masterKey,
    textEncoder.encode(jsonString)
  );

  return {
    ...originalVault, // Keep the wrapped keys as they are (password hasn't changed)
    dataIV: toBase64(dataIV.buffer),
    data: toBase64(encryptedData)
  };
};

/**
 * Resets password using Recovery Code.
 */
export const resetVaultPassword = async (vault: EncryptedVault, recoveryCode: string, newPassword: string): Promise<EncryptedVault> => {
  // 1. Unwrap Master Key using Recovery Code
  const masterKey = await unwrapMasterKey(
    recoveryCode,
    vault.recoverySalt,
    vault.recoveryIV,
    vault.recoveryKey
  );

  // 2. Re-wrap with new password
  const newWrapped = await wrapMasterKey(masterKey, newPassword);

  return {
    ...vault,
    wrappedKeySalt: newWrapped.salt,
    wrappedKeyIV: newWrapped.iv,
    wrappedKey: newWrapped.data
  };
};

// Helper to get Master Key from password (for session state)
export const getMasterKey = async (vault: EncryptedVault, password: string): Promise<CryptoKey> => {
  return await unwrapMasterKey(
    password,
    vault.wrappedKeySalt,
    vault.wrappedKeyIV,
    vault.wrappedKey
  );
};
