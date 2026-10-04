import type { Page } from 'playwright';
import type { JobListing, JobDetail, JobSearchCriteria, ApplicationPackage, ApplyResult, HiringManager, MessageResult, RateLimitConfig, PlatformType } from '../types';
export interface PlatformAdapter {
    readonly platform: PlatformType;
    readonly baseUrl: string;
    authenticate(credentials: PlatformCredentials): Promise<AuthResult>;
    validateSession(): Promise<boolean>;
    searchJobs(criteria: JobSearchCriteria): Promise<JobListing[]>;
    getJobDetails(jobId: string): Promise<JobDetail>;
    applyToJob(job: JobDetail, application: ApplicationPackage): Promise<ApplyResult>;
    fillApplicationForm(page: Page, application: ApplicationPackage): Promise<void>;
    findHiringManager(job: JobDetail): Promise<HiringManager | null>;
    sendColdMessage(manager: HiringManager, message: string): Promise<MessageResult>;
    handleCaptcha(page: Page): Promise<boolean>;
    getRateLimits(): RateLimitConfig;
}
export interface AuthResult {
    success: boolean;
    sessionData?: Record<string, unknown>;
    error?: string;
}
export interface PlatformCredentials {
    email: string;
    password: string;
    totpSecret?: string;
}
//# sourceMappingURL=base.d.ts.map