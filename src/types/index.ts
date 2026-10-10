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

export interface BrowserConfig {
  headless?: boolean;
  args?: string[];
}

export interface SchedulerConfig {
  cron: string;
  maxApplicationsPerRun: number;
}

export interface AppConfig {
  app: {
    name: string;
    version: string;
    env: string;
    logLevel: string;
  };
  browser?: BrowserConfig;
  scheduler?: SchedulerConfig;
  platforms: Record<PlatformType, PlatformConfig>;
}

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  platform: PlatformType;
  postedDate?: Date;
  salaryRange?: string;
  isRemote?: boolean;
  remoteType?: 'remote' | 'hybrid' | 'onsite';
  description?: string;
  requirements?: string[];
}

export interface JobDetail extends JobListing {
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits?: string[];
  companySize?: string;
  industry?: string;
  hiringManager?: HiringManager;
}

export interface JobSearchCriteria {
  keywords: string[];
  location?: string;
  remoteOnly?: boolean;
  experienceLevels?: string[];
  salaryMin?: number;
}

export interface ApplicationPackage {
  resumePath: string;
  coverLetter?: string;
  answers: Record<string, string>;
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

export interface ApplyResult {
  success: boolean;
  applicationId?: string;
  error?: string;
  appliedAt: Date;
  platform: PlatformType;
  jobId: string;
}

export interface HiringManager {
  name: string;
  title: string;
  company: string;
  profileUrl?: string;
  email?: string;
  linkedinUrl?: string;
}

export interface MessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  sentAt: Date;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  daily: number;
  cooldownMs?: number;
}

export interface AuthResult {
  success: boolean;
  sessionData?: any;
  error?: string;
}

export interface PlatformCredentials {
  email: string;
  password: string;
  totpSecret?: string;
}

export interface Resume {
  personal: PersonalInfo;
  professionalSummary: string;
  education: Education[];
  experience: Experience[];
  projects: Project[];
  skills: SkillCategory[];
  certifications: string[];
  languages: string[];
}

export interface PersonalInfo {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
}

export interface Education {
  degree: string;
  institution: string;
  location: string;
  cgpa?: string;
  period: string;
}

export interface Experience {
  title: string;
  company: string;
  period: string;
  items: string[];
}

export interface Project {
  title: string;
  items: string[];
}

export interface SkillCategory {
  label: string;
  skills: string;
}