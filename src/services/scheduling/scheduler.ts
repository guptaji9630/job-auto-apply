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

  constructor(
    private vault: CredentialVault,
    private optimizer: ResumeOptimizer,
    private matcher: JobMatcher,
    private messageGen: MessageGenerator
  ) {}

  start(cronExpression: string = config.scheduler?.cron || '0 9 * * 1-5'): void {
    if (this.job) return;
    
    this.job = new CronJob(cronExpression, async () => {
      if (this.isRunning) return;
      this.isRunning = true;
      await this.runCycle();
      this.isRunning = false;
    });
    
    this.job.start();
    console.log(`Scheduler started: ${cronExpression}`);
  }

  stop(): void {
    this.job?.stop();
    this.job = null;
  }

  async runOnce(platforms?: PlatformType[], maxApplications = 10): Promise<void> {
    this.totalApplications = 0;
    await this.runCycle(platforms, maxApplications);
  }

  private async runCycle(platforms?: PlatformType[], maxApplications = 10): Promise<void> {
    console.log('Starting application cycle...');
    parsePortfolioResume();
    
    const enabledPlatforms = Object.entries(config.platforms)
      .filter(([, c]) => c.enabled)
      .map(([p]) => p as PlatformType);
    
    const targetPlatforms = platforms ? platforms.filter(p => enabledPlatforms.includes(p)) : enabledPlatforms;

    for (const platform of targetPlatforms) {
      if (this.totalApplications >= maxApplications) {
        console.log(`Reached max applications limit (${maxApplications}), stopping`);
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
          keywords: ['software engineer', 'qa engineer', 'quality assurance', 'business analyst'],
          location: 'India',
          remoteOnly: true,
        });

        const scored = await this.matcher.matchJobs(parsePortfolioResume(), jobs);
        const remainingSlots = maxApplications - this.totalApplications;
        const topJobs = scored.filter(s => s.score >= 70).slice(0, remainingSlots);

        for (const scoredJob of topJobs) {
          if (this.totalApplications >= maxApplications) break;
          
          const jobDetail = await adapter.getJobDetails(scoredJob.job.id);
          const optimizedResume = await this.optimizer.optimize(parsePortfolioResume(), jobDetail.description || '');
          
          const application = this.buildApplication(optimizedResume, jobDetail);
          const result = await adapter.applyToJob(jobDetail, application);
          
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