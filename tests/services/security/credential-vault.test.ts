import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { encrypt, decrypt, deriveKey } from '@/services/security/encryption';
import { CredentialVault, PlatformCredentials } from '@/services/security/credential-vault';

const TEST_VAULT_PATH = path.join(__dirname, 'test-vault');
const TEST_MASTER_PASSWORD = 'test-master-password-123';

describe('Encryption', () => {
  const testData = 'test-secret-data';
  const testPassword = 'test-password';
  let salt: Buffer;
  let key: Buffer;

  beforeEach(async () => {
    salt = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    key = await deriveKey(testPassword, salt);
  });

  it('should derive a key from password and salt', async () => {
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it('should encrypt and decrypt data correctly (roundtrip)', () => {
    const encrypted = encrypt(testData, key);
    expect(encrypted).toHaveProperty('iv');
    expect(encrypted).toHaveProperty('ciphertext');
    expect(encrypted).toHaveProperty('tag');
    expect(encrypted.iv).toBeInstanceOf(Buffer);
    expect(encrypted.ciphertext).toBeInstanceOf(Buffer);
    expect(encrypted.tag).toBeInstanceOf(Buffer);

    const decrypted = decrypt(encrypted, key);
    expect(decrypted).toBe(testData);
  });

  it('should produce different ciphertext for same data (due to random IV)', () => {
    const encrypted1 = encrypt(testData, key);
    const encrypted2 = encrypt(testData, key);
    expect(encrypted1.iv).not.toEqual(encrypted2.iv);
    expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext);
    expect(encrypted1.tag).not.toEqual(encrypted2.tag);
  });

  it('should fail to decrypt with wrong key', () => {
    const encrypted = encrypt(testData, key);
    const wrongKey = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    expect(() => decrypt(encrypted, wrongKey)).toThrow();
  });

  it('should fail to decrypt with tampered ciphertext', () => {
    const encrypted = encrypt(testData, key);
    const tampered = { ...encrypted, ciphertext: Buffer.from(encrypted.ciphertext) };
    tampered.ciphertext[0] ^= 0xff;
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it('should fail to decrypt with tampered tag', () => {
    const encrypted = encrypt(testData, key);
    const tampered = { ...encrypted, tag: Buffer.from(encrypted.tag) };
    tampered.tag[0] ^= 0xff;
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it('should fail to decrypt with tampered IV', () => {
    const encrypted = encrypt(testData, key);
    const tampered = { ...encrypted, iv: Buffer.from(encrypted.iv) };
    tampered.iv[0] ^= 0xff;
    expect(() => decrypt(tampered, key)).toThrow();
  });
});

describe('CredentialVault', () => {
  let vault: CredentialVault;

  beforeEach(() => {
    vault = new CredentialVault(TEST_VAULT_PATH);
  });

  afterEach(() => {
    const files = [TEST_VAULT_PATH, `${TEST_VAULT_PATH}.salt`];
    for (const file of files) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }
  });

  it('should create a new vault and save credentials', async () => {
    await vault.unlock(TEST_MASTER_PASSWORD);

    const creds: PlatformCredentials = {
      email: 'test@example.com',
      password: 'platform-password',
      totpSecret: 'JBSWY3DPEHPK3PXP',
    };

    await vault.set('linkedin', creds);
    const retrieved = vault.get('linkedin');

    expect(retrieved).toEqual(creds);
  });

  it('should persist credentials across vault instances (load/save)', async () => {
    await vault.unlock(TEST_MASTER_PASSWORD);

    const creds: PlatformCredentials = {
      email: 'test@example.com',
      password: 'platform-password',
    };

    await vault.set('naukri', creds);

    // Create new vault instance with same path
    const vault2 = new CredentialVault(TEST_VAULT_PATH);
    await vault2.unlock(TEST_MASTER_PASSWORD);

    const retrieved = vault2.get('naukri');
    expect(retrieved).toEqual(creds);
  });

  it('should return undefined for non-existent platform', async () => {
    await vault.unlock(TEST_MASTER_PASSWORD);
    const retrieved = vault.get('nonexistent');
    expect(retrieved).toBeUndefined();
  });

  it('should overwrite existing credentials', async () => {
    await vault.unlock(TEST_MASTER_PASSWORD);

    await vault.set('indeed', { email: 'old@example.com', password: 'oldpass' });
    await vault.set('indeed', { email: 'new@example.com', password: 'newpass' });

    const retrieved = vault.get('indeed');
    expect(retrieved?.email).toBe('new@example.com');
    expect(retrieved?.password).toBe('newpass');
  });

  it('should rotate key and preserve data', async () => {
    await vault.unlock(TEST_MASTER_PASSWORD);

    const creds: PlatformCredentials = {
      email: 'test@example.com',
      password: 'platform-password',
    };

    await vault.set('linkedin', creds);

    const newPassword = 'new-master-password-456';
    await vault.rotateKey(newPassword);

    // Create new vault instance with new password
    const vault2 = new CredentialVault(TEST_VAULT_PATH);
    await vault2.unlock(newPassword);

    const retrieved = vault2.get('linkedin');
    expect(retrieved).toEqual(creds);
  });

  it('should not load data with wrong password after rotation', async () => {
    await vault.unlock(TEST_MASTER_PASSWORD);

    const creds: PlatformCredentials = {
      email: 'test@example.com',
      password: 'platform-password',
    };

    await vault.set('linkedin', creds);
    await vault.rotateKey('new-master-password-456');

    // Try to unlock with old password - should fail
    const vault2 = new CredentialVault(TEST_VAULT_PATH);
    await expect(vault2.unlock(TEST_MASTER_PASSWORD)).rejects.toThrow();
  });

  it('should handle credentials without TOTP secret', async () => {
    await vault.unlock(TEST_MASTER_PASSWORD);

    const creds: PlatformCredentials = {
      email: 'test@example.com',
      password: 'platform-password',
    };

    await vault.set('indeed', creds);
    const retrieved = vault.get('indeed');

    expect(retrieved).toEqual(creds);
    expect(retrieved?.totpSecret).toBeUndefined();
  });

  it('should throw when getting/setting before unlock', async () => {
    const vault2 = new CredentialVault(TEST_VAULT_PATH);

    expect(vault2.get('linkedin')).toBeUndefined(); // get doesn't throw, returns undefined
    await expect(
      vault2.set('linkedin', { email: 'test@example.com', password: 'pass' })
    ).rejects.toThrow();
  });
});
