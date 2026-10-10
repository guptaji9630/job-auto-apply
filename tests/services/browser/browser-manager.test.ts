import { BrowserManager } from '../../../src/services/browser/browser-manager';
import { PlatformType } from '../../../src/types';
import * as fs from 'fs';
import * as path from 'path';

describe('BrowserManager', () => {
  let browserManager: BrowserManager;
  const testUserDataDir = '.test-browser-profiles';

  beforeEach(() => {
    browserManager = new BrowserManager(testUserDataDir);
  });

  afterEach(async () => {
    await browserManager.close();
    if (fs.existsSync(testUserDataDir)) {
      fs.rmSync(testUserDataDir, { recursive: true, force: true });
    }
  });

  test('creates browser context for platform', async () => {
    const context = await browserManager.getContext('linkedin');
    expect(context).toBeDefined();
  });

  test('creates browser context with profile name', async () => {
    const context = await browserManager.getContext('linkedin', 'test-profile');
    expect(context).toBeDefined();
  });

  test('reuses existing context for same platform and profile', async () => {
    const context1 = await browserManager.getContext('linkedin');
    const context2 = await browserManager.getContext('linkedin');
    expect(context1).toBe(context2);
  });

  test('creates new page from context', async () => {
    const context = await browserManager.getContext('linkedin');
    const page = await browserManager.newPage(context);
    expect(page).toBeDefined();
    await page.close();
  });

  test('saves storage state on explicit call', async () => {
    const context = await browserManager.getContext('linkedin', 'storage-test');
    await browserManager.saveContextStorageState('linkedin', 'storage-test');

    const profileDir = path.join(testUserDataDir, 'profiles');
    const storageFile = path.join(profileDir, 'linkedin-storage-test.json');
    expect(fs.existsSync(storageFile)).toBe(true);
  });

  test('applies stealth scripts to context', async () => {
    const context = await browserManager.getContext('naukri');
    const page = await browserManager.newPage(context);

    // Use function evaluation with type assertion for browser APIs
    const webdriver = await page.evaluate(() => {
      const nav = (globalThis as any).navigator;
      return nav?.webdriver;
    });
    expect(webdriver).toBeUndefined();

    await page.close();
  });

  test('evicts closed context from cache and allows reacquire', async () => {
    const context1 = await browserManager.getContext('linkedin', 'evict-test');
    await context1.close(); // Caller closes context directly
    
    // Wait for close event to process
    await new Promise(r => setImmediate(r));
    await new Promise(r => setTimeout(r, 100));

    // Should be evicted from cache
    const context2 = await browserManager.getContext('linkedin', 'evict-test');
    expect(context2).not.toBe(context1);
    
    // New context should be usable
    const page = await browserManager.newPage(context2);
    expect(page).toBeDefined();
    await page.close();
  });

  test('handles concurrent getContext for same profile', async () => {
    const [ctx1, ctx2] = await Promise.all([
      browserManager.getContext('linkedin', 'concurrent-test'),
      browserManager.getContext('linkedin', 'concurrent-test'),
    ]);
    
    // Both should resolve to the same context
    expect(ctx1).toBe(ctx2);
  });

  test('handles concurrent getContext for different platforms', async () => {
    const [li, naukri] = await Promise.all([
      browserManager.getContext('linkedin'),
      browserManager.getContext('naukri'),
    ]);
    
    expect(li).not.toBe(naukri);
  });

  test('closes all contexts and browsers', async () => {
    await browserManager.getContext('linkedin');
    await browserManager.getContext('naukri');
    await browserManager.close();

    const contexts = (browserManager as any).contexts;
    const browsers = (browserManager as any).browsers;
    expect(contexts.size).toBe(0);
    expect(browsers.size).toBe(0);
  });

  test('session round-trip: cookies and localStorage persist after close/reopen', async () => {
    // Create context and add cookie/localStorage
    const context1 = await browserManager.getContext('linkedin', 'roundtrip-test');
    const page1 = await browserManager.newPage(context1);
    
    // Use httpbin.org for cookie testing (supports cookies on data-like responses)
    await page1.goto('https://httpbin.org/cookies/set/test_cookie/roundtrip_value');
    await page1.evaluate(() => {
      (globalThis as any).localStorage.setItem('test_key', 'roundtrip_value');
    });
    await page1.close();

    // Save and close via manager
    await browserManager.saveContextStorageState('linkedin', 'roundtrip-test');
    await browserManager.close();

    // Create new manager instance
    const newManager = new BrowserManager(testUserDataDir);
    const context2 = await newManager.getContext('linkedin', 'roundtrip-test');
    const page2 = await newManager.newPage(context2);
    
    await page2.goto('https://httpbin.org/cookies');
    
    const cookie = await page2.evaluate(() => (globalThis as any).document?.cookie ?? '');
    const localStorageValue = await page2.evaluate(() => (globalThis as any).localStorage?.getItem('test_key') ?? null);
    
    expect(cookie).toContain('test_cookie=roundtrip_value');
    expect(localStorageValue).toBe('roundtrip_value');
    
    await page2.close();
    await newManager.close();
  }, 30000);
});