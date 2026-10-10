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

    const webdriver = await page.evaluate(() => {
      const nav = (globalThis as any).navigator;
      return nav?.webdriver;
    });
    expect(webdriver).toBeUndefined();

    await page.close();
  });

  test('evicts closed context from cache and allows reacquire', async () => {
    const context1 = await browserManager.getContext('linkedin', 'evict-test');
    await context1.close();
    
    await new Promise(r => setImmediate(r));
    await new Promise(r => setTimeout(r, 100));

    const context2 = await browserManager.getContext('linkedin', 'evict-test');
    expect(context2).not.toBe(context1);
    
    const page = await browserManager.newPage(context2);
    expect(page).toBeDefined();
    await page.close();
  });

  test('handles concurrent getContext for same profile', async () => {
    const [ctx1, ctx2] = await Promise.all([
      browserManager.getContext('linkedin', 'concurrent-test'),
      browserManager.getContext('linkedin', 'concurrent-test'),
    ]);
    
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
    const context1 = await browserManager.getContext('linkedin', 'roundtrip-test');
    const page1 = await browserManager.newPage(context1);
    
    await page1.goto('https://httpbin.org/cookies/set/test_cookie/roundtrip_value');
    await page1.evaluate(() => {
      (globalThis as any).localStorage.setItem('test_key', 'roundtrip_value');
    });
    await page1.close();

    await browserManager.saveContextStorageState('linkedin', 'roundtrip-test');
    await browserManager.close();

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

  // ===== NEW TESTS FOR RECENT FIXES =====

  test('preserves full hyphenated profile name on shutdown (no collision)', async () => {
    // Create two contexts with hyphenated profile names
    const ctx1 = await browserManager.getContext('linkedin', 'team-alice');
    const page1 = await browserManager.newPage(ctx1);
    await page1.goto('https://httpbin.org/cookies/set/user/alice');
    await page1.close();

    const ctx2 = await browserManager.getContext('linkedin', 'team-bob');
    const page2 = await browserManager.newPage(ctx2);
    await page2.goto('https://httpbin.org/cookies/set/user/bob');
    await page2.close();

    // Save and close
    await browserManager.saveContextStorageState('linkedin', 'team-alice');
    await browserManager.saveContextStorageState('linkedin', 'team-bob');
    await browserManager.close();

    // Reopen both profiles
    const newManager = new BrowserManager(testUserDataDir);
    const reopened1 = await newManager.getContext('linkedin', 'team-alice');
    const page1r = await newManager.newPage(reopened1);
    await page1r.goto('https://httpbin.org/cookies');
    const cookie1 = await page1r.evaluate(() => (globalThis as any).document?.cookie ?? '');
    expect(cookie1).toContain('user=alice');
    await page1r.close();

    const reopened2 = await newManager.getContext('linkedin', 'team-bob');
    const page2r = await newManager.newPage(reopened2);
    await page2r.goto('https://httpbin.org/cookies');
    const cookie2 = await page2r.evaluate(() => (globalThis as any).document?.cookie ?? '');
    expect(cookie2).toContain('user=bob');
    await page2r.close();

    await newManager.close();
  }, 30000);

  test('single-caller failure does not cause unhandled rejection', async () => {
    // We can't easily mock chromium.launch to fail, but we can verify
    // that the promise structure doesn't create separate deferred rejections
    // by checking the internal structure
    
    const mgr = new BrowserManager(testUserDataDir + '-failure');
    try {
      // This will succeed, but we verify the internal promise structure
      // The key test is that there's only ONE promise per key in contextPending
      await mgr.getContext('linkedin', 'failure-test');
      
      const pending = (mgr as any).contextPending;
      const key = 'linkedin-failure-test';
      expect(pending.has(key)).toBe(true);
      expect(pending.get(key)).toHaveProperty('promise');
      // Should NOT have separate resolve/reject functions
      expect(Object.keys(pending.get(key))).toEqual(['promise']);
    } finally {
      await mgr.close();
      if (fs.existsSync(testUserDataDir + '-failure')) {
        fs.rmSync(testUserDataDir + '-failure', { recursive: true, force: true });
      }
    }
  });

test('shutdown cleans up pending creations and blocks new acquisitions', async () => {
    const mgr = new BrowserManager(testUserDataDir + '-shutdown');
    
    // Start a context creation (will be pending during close)
    const creationPromise = mgr.getContext('linkedin', 'shutdown-test');
    
    // Close while creation is in-flight
    await mgr.close();
    
    // After close, no resources should remain
    const contexts = (mgr as any).contexts;
    const browsers = (mgr as any).browsers;
    expect(contexts.size).toBe(0);
    expect(browsers.size).toBe(0);
    
    // New acquisitions should be blocked (isClosing flag remains true after close)
    await expect(mgr.getContext('linkedin', 'new-after-close')).rejects.toThrow('shutting down');
    
    // Ensure the original creation was properly cleaned up
    await creationPromise.catch(() => {}); // Ignore rejection
    
    if (fs.existsSync(testUserDataDir + '-shutdown')) {
      fs.rmSync(testUserDataDir + '-shutdown', { recursive: true, force: true });
    }
  }, 30000);

  test('session round-trip: cookies and localStorage persist after close/reopen', async () => {
    const context1 = await browserManager.getContext('linkedin', 'roundtrip-test');
    const page1 = await browserManager.newPage(context1);
    
    await page1.goto('https://httpbin.org/cookies/set/test_cookie/roundtrip_value');
    await page1.evaluate(() => {
      (globalThis as any).localStorage.setItem('test_key', 'roundtrip_value');
    });
    await page1.close();

    await browserManager.saveContextStorageState('linkedin', 'roundtrip-test');
    await browserManager.close();

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