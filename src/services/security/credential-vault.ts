import { encrypt, decrypt, deriveKey } from './encryption';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';

export interface PlatformCredentials {
  email: string;
  password: string;
  totpSecret?: string;
}

export class CredentialVault {
  private vaultPath: string;
  private key: Buffer | null = null;
  private data: Record<string, PlatformCredentials> = {};

  constructor(vaultPath: string = '.credentials.vault') {
    this.vaultPath = path.resolve(vaultPath);
  }

  async unlock(masterPassword: string): Promise<void> {
    const salt = fs.existsSync(this.vaultPath + '.salt')
      ? fs.readFileSync(this.vaultPath + '.salt')
      : crypto.randomBytes(32);
    if (!fs.existsSync(this.vaultPath + '.salt')) {
      fs.writeFileSync(this.vaultPath + '.salt', salt);
    }
    this.key = await deriveKey(masterPassword, salt);
    await this.load();
  }

  async load(): Promise<void> {
    if (!fs.existsSync(this.vaultPath)) return;
    const encrypted = JSON.parse(fs.readFileSync(this.vaultPath, 'utf8'));
    this.data = JSON.parse(decrypt(encrypted, this.key!));
  }

  async save(): Promise<void> {
    const encrypted = encrypt(JSON.stringify(this.data), this.key!);
    fs.writeFileSync(this.vaultPath, JSON.stringify(encrypted));
  }

  get(platform: string): PlatformCredentials | undefined {
    return this.data[platform];
  }

  async set(platform: string, creds: PlatformCredentials): Promise<void> {
    this.data[platform] = creds;
    await this.save();
  }

  async rotateKey(newPassword: string): Promise<void> {
    const oldData = { ...this.data };
    const newSalt = crypto.randomBytes(32);
    this.key = await deriveKey(newPassword, newSalt);
    fs.writeFileSync(this.vaultPath + '.salt', newSalt);
    this.data = oldData;
    await this.save();
  }
}
