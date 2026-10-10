import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { config } from '../../config';
import type { PlatformType } from '../../types';
import * as fs from 'fs';
import * as path from 'path';
import { applyStealth } from './stealth';

export class BrowserManager {
  private browsers: Map<string, Browser> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();
  private userDataDir: string;

  constructor(userDataDir: string = '.browser-profiles') {
    this.userDataDir = userDataDir;
  }

  async getContext(platform: PlatformType, profileName?: string): Promise<BrowserContext> {
    const key = `${platform}-${profileName || 'default'}`;
    if (this.contexts.has(key)) return this.contexts.get(key)!;

    const browser = await this.getBrowser();
    const context = await browser.newContext({
      storageState: await this.getStorageState(platform, profileName),
      userAgent: this.getUserAgent(),
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
    });

    await applyStealth(context);

    this.contexts.set(key, context);
    return context;
  }

  async saveContextStorageState(platform: PlatformType, profileName?: string): Promise<void> {
    const key = `${platform}-${profileName || 'default'}`;
    const context = this.contexts.get(key);
    if (context) {
      await this.saveStorageState(platform, profileName, context);
    }
  }

  async newPage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);
    return page;
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browsers.has('chromium')) {
      this.browsers.set('chromium', await chromium.launch({
        headless: config.browser?.headless ?? false,
        args: config.browser?.args ?? ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
      }));
    }
    return this.browsers.get('chromium')!;
  }

  private async getStorageState(platform: PlatformType, profileName?: string): Promise<string | undefined> {
    const profileDir = path.join(this.userDataDir, 'profiles');
    const filePath = path.join(profileDir, `${platform}-${profileName || 'default'}.json`);
    return fs.existsSync(filePath) ? filePath : undefined;
  }

  private async saveStorageState(platform: PlatformType, profileName: string | undefined, context: BrowserContext): Promise<void> {
    const profileDir = path.join(this.userDataDir, 'profiles');
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }
    const filePath = path.join(profileDir, `${platform}-${profileName || 'default'}.json`);
    await context.storageState({ path: filePath });
  }

  private getUserAgent(): string {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  async close(): Promise<void> {
    for (const [key, context] of this.contexts.entries()) {
      const [platform, profileName] = key.split('-');
      await this.saveStorageState(platform as any, profileName || 'default', context);
      await context.close();
    }
    for (const browser of this.browsers.values()) await browser.close();
    this.contexts.clear();
    this.browsers.clear();
  }
}

export const browserManager = new BrowserManager();