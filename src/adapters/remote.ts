import type { PlatformAdapter } from '../adapters/base';
import type { AuthResult, PlatformCredentials, JobListing, JobDetail, JobSearchCriteria, ApplicationPackage, ApplyResult, HiringManager, MessageResult, RateLimitConfig } from '../types';

export class RemoteAdapter implements PlatformAdapter {
  readonly platform = 'remote' as const;
  readonly baseUrl = 'https://wellfound.com';

  async authenticate(_credentials: PlatformCredentials): Promise<AuthResult> { return { success: false, error: 'Not implemented' }; }
  async validateSession(): Promise<boolean> { return false; }
  async searchJobs(_criteria: JobSearchCriteria): Promise<JobListing[]> { return []; }
  async getJobDetails(_jobId: string): Promise<JobDetail> { return {} as JobDetail; }
  async applyToJob(job: JobDetail, _application: ApplicationPackage): Promise<ApplyResult> { 
    return { success: false, error: 'Not implemented', appliedAt: new Date(), platform: 'remote', jobId: job.id }; 
  }
  async fillApplicationForm(_page: unknown, _application: ApplicationPackage): Promise<void> {}
  async findHiringManager(_job: JobDetail): Promise<HiringManager | null> { return null; }
  async sendColdMessage(_manager: HiringManager, _message: string): Promise<MessageResult> { 
    return { success: false, error: 'Not implemented', sentAt: new Date() }; 
  }
  async handleCaptcha(_page: unknown): Promise<boolean> { return false; }
  getRateLimits(): RateLimitConfig { return { requestsPerMinute: 15, daily: 200 }; }
}