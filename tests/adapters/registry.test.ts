import { adapterRegistry } from '@/adapters/registry';
import { PlatformAdapter } from '@/adapters/base';
import { PlatformType, ApplyResult, MessageResult, RateLimitConfig, JobListing, JobDetail, JobSearchCriteria, ApplicationPackage, HiringManager } from '@/types';
import { Page } from 'playwright';

class LinkedInMockAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'linkedin';
  readonly baseUrl = 'https://www.linkedin.com';

  authenticate() { return Promise.resolve({ success: true }); }
  validateSession() { return Promise.resolve(true); }
  searchJobs() { return Promise.resolve([] as JobListing[]); }
  getJobDetails() { return Promise.resolve({} as JobDetail); }
  applyToJob() { return Promise.resolve({ success: true, appliedAt: new Date(), platform: 'linkedin', jobId: '1' } as ApplyResult); }
  fillApplicationForm() { return Promise.resolve(); }
  findHiringManager() { return Promise.resolve(null); }
  sendColdMessage() { return Promise.resolve({ success: true, sentAt: new Date() } as MessageResult); }
  handleCaptcha() { return Promise.resolve(false); }
  getRateLimits() { return { requestsPerMinute: 10, daily: 100 } as RateLimitConfig; }
}

class NaukriMockAdapter implements PlatformAdapter {
  readonly platform: PlatformType = 'naukri';
  readonly baseUrl = 'https://www.naukri.com';

  authenticate() { return Promise.resolve({ success: true }); }
  validateSession() { return Promise.resolve(true); }
  searchJobs() { return Promise.resolve([] as JobListing[]); }
  getJobDetails() { return Promise.resolve({} as JobDetail); }
  applyToJob() { return Promise.resolve({ success: true, appliedAt: new Date(), platform: 'naukri', jobId: '1' } as ApplyResult); }
  fillApplicationForm() { return Promise.resolve(); }
  findHiringManager() { return Promise.resolve(null); }
  sendColdMessage() { return Promise.resolve({ success: true, sentAt: new Date() } as MessageResult); }
  handleCaptcha() { return Promise.resolve(false); }
  getRateLimits() { return { requestsPerMinute: 10, daily: 100 } as RateLimitConfig; }
}

describe('AdapterRegistry', () => {
  beforeEach(() => {
    (adapterRegistry as any).adapters.clear();
  });

  test('registers and retrieves an adapter', () => {
    const adapter = new LinkedInMockAdapter();
    adapterRegistry.register(adapter);

    const retrieved = adapterRegistry.get('linkedin');
    expect(retrieved).toBe(adapter);
  });

  test('returns undefined for unknown platform', () => {
    const retrieved = adapterRegistry.get('naukri');
    expect(retrieved).toBeUndefined();
  });

  test('getAll returns all registered adapters', () => {
    const adapter1 = new LinkedInMockAdapter();
    const adapter2 = new NaukriMockAdapter();
    
    adapterRegistry.register(adapter1);
    adapterRegistry.register(adapter2);

    const all = adapterRegistry.getAll();
    expect(all).toHaveLength(2);
  });

  test('getEnabled returns only enabled platforms', () => {
    const adapter1 = new LinkedInMockAdapter();
    const adapter2 = new NaukriMockAdapter();
    
    adapterRegistry.register(adapter1);
    adapterRegistry.register(adapter2);

    const enabled = adapterRegistry.getEnabled(['linkedin']);
    expect(enabled).toHaveLength(1);
    expect(enabled[0].platform).toBe('linkedin');
  });
});