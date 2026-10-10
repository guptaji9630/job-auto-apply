import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import { config } from '../../config';
import type { PlatformType } from '../../types';
import * as fs from 'fs';
import * as path from 'path';
import { applyStealth } from './stealth';

interface PendingContext {
  promise: Promise<BrowserContext>;
  resolve: (ctx: BrowserContext) => void;
  reject: (err: Error) => void;
}

export class BrowserManager {
  private browsers: Map<string, Browser> = new Map();
  private browserPending: Map<string, Promise<Browser>> = new Map();
  private contexts: Map<string, BrowserContext> = new Map();
  private contextPending: Map<string, PendingContext> = new Map();
  private closingContexts: Set<string> = new Set();
  private userDataDir: string;

  constructor(userDataDir: string = '.browser-profiles') {
    this.userDataDir = userDataDir;
  }

  async getContext(platform: PlatformType, profileName?: string): Promise<BrowserContext> {
    const key = `${platform}-${profileName || 'default'}`;

    // Check if context is being closed - if so, wait for it to be removed
    if (this.closingContexts.has(key)) {
      await new Promise(r => setTimeout(r, 50));
      return this.getContext(platform, profileName);
    }

    // Return existing valid context
    const existing = this.contexts.get(key);
    if (existing) {
      if (!this.isClosed(existing)) {
        return existing;
      }
      // Context is closed but still in map - remove it
      this.contexts.delete(key);
    }

    // Return pending creation if in flight
    const pending = this.contextPending.get(key);
    if (pending) {
      return pending.promise;
    }

    // Create new pending context
    const newPending: PendingContext = {
      promise: null as any,
      resolve: null as any,
      reject: null as any,
    };
    newPending.promise = new Promise((resolve, reject) => {
      newPending.resolve = resolve;
      newPending.reject = reject;
    });
    this.contextPending.set(key, newPending);

    try {
      const browser = await this.getOrCreateBrowser();
      const context = await this.createContextWithStorage(browser, platform, profileName);
      
      await applyStealth(context);
      
      // Add close handler - synchronous map deletion, async storage save
      context.on('close', () => {
        this.contexts.delete(key);  // synchronous eviction
        this.contextPending.delete(key); // clean up pending promise
        this.closingContexts.add(key);
        this.handleContextClose(key, platform, profileName || 'default', context)
          .finally(() => {
            this.closingContexts.delete(key);
          });
      });

      this.contexts.set(key, context);
      newPending.resolve(context);
      return context;
    } catch (err) {
      this.contextPending.delete(key);
      newPending.reject(err as Error);
      throw err;
    }
  }

  private async handleContextClose(key: string, platform: PlatformType, profileName: string, context: BrowserContext): Promise<void> {
    // Context is already deleted from contexts map
    // Save storage state (context is already closed at this point, so this may fail)
    try {
      await this.saveStorageState(platform, profileName, context);
    } catch (err) {
      // Context already closed, storage state cannot be saved
      // This is expected when caller calls context.close() directly
    }
  }

  private isClosed(context: BrowserContext): boolean {
    try {
      context.pages();
      return false;
    } catch {
      return true;
    }
  }

  private async createContextWithStorage(browser: Browser, platform: PlatformType, profileName?: string): Promise<BrowserContext> {
    const storageStatePath = await this.getStorageState(platform, profileName);
    return browser.newContext({
      storageState: storageStatePath,
      userAgent: this.getUserAgent(),
      viewport: { width: 1366, height: 768 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      permissions: ['geolocation'],
      geolocation: { latitude: 40.7128, longitude: -74.0060 },
    });
  }

  async saveContextStorageState(platform: PlatformType, profileName?: string): Promise<void> {
    const key = `${platform}-${profileName || 'default'}`;
    const context = this.contexts.get(key);
    if (context && !this.isClosed(context)) {
      await this.saveStorageState(platform, profileName, context);
    }
  }

  async newPage(context: BrowserContext): Promise<Page> {
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(60000);
    return page;
  }

  private async getOrCreateBrowser(): Promise<Browser> {
    const key = 'chromium';
    
    if (this.browsers.has(key)) {
      return this.browsers.get(key)!;
    }

    const pending = this.browserPending.get(key);
    if (pending) {
      return pending;
    }

    const launchPromise = chromium.launch({
      headless: config.browser?.headless ?? false,
      args: config.browser?.args ?? ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    }).then(browser => {
      this.browsers.set(key, browser);
      this.browserPending.delete(key);
      
      browser.on('disconnected', () => {
        this.browsers.delete(key);
        // Invalidate all contexts using this browser
        for (const [ctxKey, ctx] of this.contexts.entries()) {
          if (ctx.browser() === browser) {
            this.contexts.delete(ctxKey);
          }
        }
      });
      
      return browser;
    }).catch(err => {
      this.browserPending.delete(key);
      throw err;
    });

    this.browserPending.set(key, launchPromise);
    return launchPromise;
  }

  private async getStorageState(platform: PlatformType, profileName?: string): Promise<string | undefined> {
    const profileDir = path.join(this.userDataDir, 'profiles');
    const filePath = path.join(profileDir, `${platform}-${profileName || 'default'}.json`);
    return fs.existsSync(filePath) ? filePath : undefined;
  }

  private async saveStorageState(platform: PlatformType, profileName: string | undefined, context: BrowserContext): Promise<void> {
    if (this.isClosed(context)) return;
    
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
    // Save storage state for all active contexts BEFORE closing
    for (const [key, context] of this.contexts.entries()) {
      if (!this.isClosed(context)) {
        const [platform, profileName] = key.split('-');
        try {
          await this.saveStorageState(platform as any, profileName || 'default', context);
        } catch (err) {
          console.error(`Failed to save storage state for ${key}:`, err);
        }
      }
    }

    // Close all contexts
    for (const context of this.contexts.values()) {
      try {
        await context.close();
      } catch (err) {
        console.error('Error closing context:', err);
      }
    }

    // Close all browsers
    for (const browser of this.browsers.values()) {
      try {
        await browser.close();
      } catch (err) {
        console.error('Error closing browser:', err);
      }
    }

    this.contexts.clear();
    this.browsers.clear();
    this.browserPending.clear();
    this.contextPending.clear();
  }
}

export const browserManager = new BrowserManager();