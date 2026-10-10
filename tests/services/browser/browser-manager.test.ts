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
    // Don't manually close - let afterEach handle it
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

  test('saves storage state on context close', async () => {
    const context = await browserManager.getContext('linkedin', 'storage-test');
    await browserManager.saveContextStorageState('linkedin', 'storage-test');

    const profileDir = path.join(testUserDataDir, 'profiles');
    const storageFile = path.join(profileDir, 'linkedin-storage-test.json');
    expect(fs.existsSync(storageFile)).toBe(true);
  });

  test('applies stealth scripts to context', async () => {
    const context = await browserManager.getContext('naukri');
    const page = await browserManager.newPage(context);

    const webdriver = await page.evaluate(`() => navigator.webdriver`);
    expect(webdriver).toBeUndefined();

    await page.close();
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
});