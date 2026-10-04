export type PlatformType = 'linkedin' | 'naukri' | 'indeed' | 'remote';

export interface PlatformConfig {
  enabled: boolean;
  rateLimit: { requestsPerMinute: number; daily: number };
  credentials?: string;
  baseUrl: string;
  selectors: SelectorMap;
}

export interface SelectorMap {
  loginForm: string;
  jobCard: string;
  jobTitle: string;
  companyName: string;
  location: string;
  applyButton: string;
  easyApplyModal: string;
  nextButton: string;
  submitButton: string;
}

export interface AppConfig {
  app: {
    name: string;
    version: string;
    env: string;
    logLevel: string;
  };
  platforms: Record<PlatformType, PlatformConfig>;
}