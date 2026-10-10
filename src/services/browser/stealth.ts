import type { Page, BrowserContext } from 'playwright';

const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  window.chrome = { runtime: {} };
  Object.defineProperty(navigator, 'permissions', {
    get: () => ({ query: () => Promise.resolve({ state: 'granted' }) })
  });
`;

export async function applyStealth(context: BrowserContext): Promise<void> {
  await context.addInitScript(STEALTH_SCRIPT);
}

export async function applyStealthToPage(page: Page): Promise<void> {
  await page.addInitScript(STEALTH_SCRIPT);
}

export function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

export function getDefaultViewport() {
  return { width: 1366, height: 768 };
}

export function getDefaultLocale(): string {
  return 'en-US';
}

export function getDefaultTimezone(): string {
  return 'America/New_York';
}

export function getDefaultGeolocation() {
  return { latitude: 40.7128, longitude: -74.0060 };
}