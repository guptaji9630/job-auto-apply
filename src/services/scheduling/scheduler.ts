import { CronJob } from 'cron';
import { config } from '../../config';
import { adapterRegistry } from '../../adapters/registry';
import type { CredentialVault } from '../../services/security/credential-vault';
import type { ResumeOptimizer } from '../../services/resume/optimizer';
import type { JobMatcher } from '../../services/matching/job-matcher';
import type { MessageGenerator } from '../../services/messaging/message-generator';
import { parsePortfolioResume } from '../../services/resume/parser';
import type { PlatformType, Resume, JobDetail, ApplicationPackage } from '../../types';

export class JobScheduler {
  private job: CronJob | null = null;
  private isRunning = false;
  private totalApplications = 0;
  private totalAttempts = 0;

  constructor(
    private vault: CredentialVault,
    private optimizer: ResumeOptimizer,
    private matcher: JobMatcher,
    private messageGen: MessageGenerator
  ) {}

  start(cronExpression: string = config.scheduler?.cron || '0 9 * * 1-5'): void {
    if (this.job) return;
    
    const maxApps = config.scheduler?.maxApplicationsPerRun || 10;
    
    this.job = new CronJob(cronExpression, async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      await this.runCycle(undefined, maxApps);
      this.isRunning = false;
    });
    
    this.job.start();
    console.log(`Scheduler started: ${cronExpression} (max applications per run: ${maxApps})`);
  }

  stop(): void {
    this.job?.stop();
    this.job = null;
  }

  async runOnce(platforms?: PlatformType[], maxApplications = 10, role?: string): Promise<void> {
    this.totalApplications = 0;
    this.totalAttempts = 0;
    await this.runCycle(platforms, maxApplications, role);
  }

  private async runCycle(platforms?: PlatformType[], maxApplications = 10, role?: string): Promise<void> {
    console.log('Starting application cycle...');
    this.totalApplications = 0;
    this.totalAttempts = 0;
    parsePortfolioResume();
    
    const enabledPlatforms = Object.entries(config.platforms)
      .filter(([, c]) => c.enabled)
      .map(([p]) => p as PlatformType);
    
    const targetPlatforms = platforms ? platforms.filter(p => enabledPlatforms.includes(p)) : enabledPlatforms;

    // Determine job keywords based on role
    const keywords = this.getKeywordsForRole(role);

    for (const platform of targetPlatforms) {
      if (this.totalAttempts >= maxApplications) {
        console.log(`Reached max attempts limit (${maxApplications}), stopping`);
        break;
      }

      const adapter = adapterRegistry.get(platform);
      if (!adapter) {
        console.log(`Adapter not found for ${platform}, skipping`);
        continue;
      }

      try {
        const creds = this.vault.get(platform);
        if (!creds) {
          console.log(`No credentials for ${platform}, skipping`);
          continue;
        }

        await adapter.authenticate(creds);
        
        const jobs = await adapter.searchJobs({
          keywords,
          location: 'India',
          remoteOnly: true,
        });

        const scored = await this.matcher.matchJobs(parsePortfolioResume(), jobs);
        const remainingSlots = maxApplications - this.totalAttempts;
        const topJobs = scored.filter(s => s.score >= 70).slice(0, remainingSlots);

        for (const scoredJob of topJobs) {
          if (this.totalAttempts >= maxApplications) break;
          
          const jobDetail = await adapter.getJobDetails(scoredJob.job.id);
          const optimizedResume = await this.optimizer.optimize(parsePortfolioResume(), jobDetail.description || '');
          
          const application = this.buildApplication(optimizedResume, jobDetail);
          const result = await adapter.applyToJob(jobDetail, application);
          
          this.totalAttempts++;
          
          if (result.success) {
            this.totalApplications++;
          }
          
          console.log(`Applied to ${jobDetail.title} at ${jobDetail.company}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
          
          const manager = await adapter.findHiringManager(jobDetail);
          if (manager) {
            const message = await this.messageGen.generate(parsePortfolioResume(), jobDetail, manager);
            await adapter.sendColdMessage(manager, message);
          }
        }
      } catch (error) {
        console.error(`Error processing ${platform}:`, error);
      }
    }
    
    console.log(`Application cycle complete. Total applications: ${this.totalApplications}`);
  }

  private getKeywordsForRole(role?: string): string[] {
    const roleLower = role?.toLowerCase() || '';
    
    if (roleLower.includes('qa') || roleLower.includes('quality') || roleLower.includes('test')) {
      return ['qa engineer', 'quality assurance', 'test engineer', 'software test', 'automation test'];
    }
    if (roleLower.includes('ba') || roleLower.includes('business analyst') || roleLower.includes('analyst')) {
      return ['business analyst', 'systems analyst', 'product analyst', 'data analyst'];
    }
    // Default to software engineer roles
    return ['software engineer', 'frontend engineer', 'backend engineer', 'full stack engineer', 'web developer'];
  }

  private buildApplication(resume: Resume, job: JobDetail): ApplicationPackage {
    return {
      resume,
      coverLetter: `I'm excited to apply for ${job.title} at ${job.company}...`,
      answers: {},
      resumePath: './resume.pdf',
      portfolioUrl: resume.personal.portfolio,
      linkedinUrl: resume.personal.linkedin,
    };
  }
}