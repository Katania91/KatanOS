const SECRET_PREFIX = 'enc$';

export const isEncryptedSecret = (value?: string) =>
  typeof value === 'string' && value.startsWith(SECRET_PREFIX);

export const encryptSecretValue = async (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (isEncryptedSecret(trimmed)) return trimmed;
  if (typeof window !== 'undefined' && window.katanos?.encryptSecret) {
    try {
      const result = await window.katanos.encryptSecret(trimmed);
      if (result?.ok && result.value) {
        return result.value;
      }
    } catch (error) {
      console.warn('Secret encryption failed.', error);
    }
  }
  console.warn('Secret encryption unavailable; storing plain text.');
  return trimmed;
};

export const decryptSecretValue = async (value?: string) => {
  if (!value) return '';
  if (!isEncryptedSecret(value)) return value;
  if (typeof window !== 'undefined' && window.katanos?.decryptSecret) {
    try {
      const result = await window.katanos.decryptSecret(value);
      if (result?.ok && typeof result.value === 'string') {
        return result.value;
      }
    } catch (error) {
      console.warn('Secret decryption failed.', error);
    }
  }
  console.warn('Secret decryption unavailable.');
  return '';
};

export const resolveSecretValue = async (value?: string) => {
  return await decryptSecretValue(value);
};
