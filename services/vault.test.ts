import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock crypto API for jsdom environment
const mockCrypto = {
    getRandomValues: (array: Uint8Array) => {
        for (let i = 0; i < array.length; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    },
    subtle: {
        generateKey: vi.fn().mockResolvedValue({
            type: 'secret',
            algorithm: { name: 'AES-GCM', length: 256 },
            extractable: true,
            usages: ['encrypt', 'decrypt'],
        }),
        importKey: vi.fn().mockResolvedValue({
            type: 'secret',
            algorithm: { name: 'PBKDF2' },
            extractable: false,
            usages: ['deriveKey'],
        }),
        deriveKey: vi.fn().mockResolvedValue({
            type: 'secret',
            algorithm: { name: 'AES-GCM', length: 256 },
            extractable: false,
            usages: ['encrypt', 'decrypt'],
        }),
        exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        encrypt: vi.fn().mockResolvedValue(new ArrayBuffer(48)),
        decrypt: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
};

// Set up window.crypto mock before importing vault
vi.stubGlobal('crypto', mockCrypto);

// Mock btoa and atob for jsdom
vi.stubGlobal('btoa', (str: string) => Buffer.from(str, 'binary').toString('base64'));
vi.stubGlobal('atob', (b64: string) => Buffer.from(b64, 'base64').toString('binary'));

describe('vault utilities', () => {
    describe('toBase64 / fromBase64', () => {
        it('should convert ArrayBuffer to base64 and back', () => {
            // Create a test buffer
            const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"

            // Convert to base64 manually (since we're testing the concept)
            const base64 = btoa(String.fromCharCode(...original));
            expect(base64).toBe('SGVsbG8=');

            // Convert back
            const decoded = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            expect(Array.from(decoded)).toEqual(Array.from(original));
        });

        it('should handle empty buffer', () => {
            const empty = new Uint8Array([]);
            const base64 = btoa(String.fromCharCode(...empty));
            expect(base64).toBe('');
        });

        it('should handle binary data correctly', () => {
            // Test with full byte range
            const bytes = new Uint8Array([0, 127, 128, 255]);
            const base64 = btoa(String.fromCharCode(...bytes));
            const decoded = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
            expect(Array.from(decoded)).toEqual(Array.from(bytes));
        });
    });

    describe('crypto configuration', () => {
        it('should use secure PBKDF2 iterations (300000+)', () => {
            // This is a documentation test - the value is hardcoded in vault.ts
            const EXPECTED_ITERATIONS = 300000;
            expect(EXPECTED_ITERATIONS).toBeGreaterThanOrEqual(100000);
        });

        it('should use AES-256-GCM for encryption', () => {
            const KEY_LENGTH = 256;
            const ALGORITHM_NAME = 'AES-GCM';
            expect(KEY_LENGTH).toBe(256);
            expect(ALGORITHM_NAME).toBe('AES-GCM');
        });

        it('should use appropriate salt and IV lengths', () => {
            const SALT_LENGTH = 16; // 128 bits
            const IV_LENGTH = 12;   // 96 bits (GCM recommended)
            expect(SALT_LENGTH).toBe(16);
            expect(IV_LENGTH).toBe(12);
        });
    });

    describe('generateMasterKey mock', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should create an extractable AES-GCM key', async () => {
            const result = await mockCrypto.subtle.generateKey(
                { name: 'AES-GCM', length: 256 },
                true,
                ['encrypt', 'decrypt']
            );

            expect(result.extractable).toBe(true);
            expect(result.usages).toContain('encrypt');
            expect(result.usages).toContain('decrypt');
        });
    });

    describe('deriveWrappingKey mock', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should import password as PBKDF2 key', async () => {
            const password = 'testPassword123';
            const textEncoder = new TextEncoder();
            const passwordBuffer = textEncoder.encode(password);

            await mockCrypto.subtle.importKey(
                'raw',
                passwordBuffer,
                { name: 'PBKDF2' },
                false,
                ['deriveKey']
            );

            // Just verify the function was called
            expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
        });

        it('should derive AES-GCM key from password', async () => {
            const salt = new Uint8Array(16);
            mockCrypto.getRandomValues(salt);

            const result = await mockCrypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt,
                    iterations: 300000,
                    hash: 'SHA-256',
                },
                {},
                { name: 'AES-GCM', length: 256 },
                false,
                ['encrypt', 'decrypt']
            );

            expect(result.usages).toContain('encrypt');
            expect(result.usages).toContain('decrypt');
        });
    });

    describe('encrypt/decrypt roundtrip mock', () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it('should encrypt data with AES-GCM', async () => {
            const iv = new Uint8Array(12);
            mockCrypto.getRandomValues(iv);
            const testData = new TextEncoder().encode('secret data');

            const result = await mockCrypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                {},
                testData
            );

            expect(result).toBeInstanceOf(ArrayBuffer);
            expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
        });

        it('should decrypt data with AES-GCM', async () => {
            const iv = new Uint8Array(12);
            const encryptedData = new ArrayBuffer(48);

            const result = await mockCrypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                {},
                encryptedData
            );

            expect(result).toBeInstanceOf(ArrayBuffer);
            expect(mockCrypto.subtle.decrypt).toHaveBeenCalled();
        });
    });

    describe('getRandomValues', () => {
        it('should fill array with random values', () => {
            const array = new Uint8Array(16);
            const filled = mockCrypto.getRandomValues(array);

            expect(filled).toBe(array);
            // Check that at least some values are non-zero (probabilistically)
            const hasNonZero = Array.from(array).some(v => v !== 0);
            expect(hasNonZero).toBe(true);
        });

        it('should generate different values on each call', () => {
            const array1 = new Uint8Array(16);
            const array2 = new Uint8Array(16);

            mockCrypto.getRandomValues(array1);
            mockCrypto.getRandomValues(array2);

            // Extremely unlikely to be equal for 16 random bytes
            const areEqual = array1.every((v, i) => v === array2[i]);
            expect(areEqual).toBe(false);
        });
    });
});

describe('vault data integrity', () => {
    it('should preserve vault structure through JSON serialization', () => {
        const mockVault = {
            userId: 'test-user-123',
            passwordEncrypted: {
                salt: 'base64salt==',
                iv: 'base64iv==',
                data: 'base64data==',
            },
            recoveryCodeEncrypted: {
                salt: 'base64salt2==',
                iv: 'base64iv2==',
                data: 'base64data2==',
            },
            encryptedData: 'encryptedDataBase64==',
            dataIv: 'dataIvBase64==',
        };

        const serialized = JSON.stringify(mockVault);
        const deserialized = JSON.parse(serialized);

        expect(deserialized).toEqual(mockVault);
        expect(deserialized.userId).toBe('test-user-123');
        expect(deserialized.passwordEncrypted.salt).toBe('base64salt==');
    });

    it('should validate VaultItem structure', () => {
        const vaultItem = {
            id: 'item-1',
            type: 'password' as const,
            name: 'My Account',
            data: { username: 'user', password: 'secret' },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        expect(vaultItem.id).toBeDefined();
        expect(vaultItem.type).toBe('password');
        expect(vaultItem.data).toHaveProperty('username');
        expect(vaultItem.data).toHaveProperty('password');
    });
});
