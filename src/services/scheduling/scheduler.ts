import { CronJob } from 'cron';
import { config } from '../../config';
import { adapterRegistry } from '../../adapters/registry';
import { browserManager } from '../../services/browser/browser-manager';
import { CredentialVault } from '../../services/security/credential-vault';
import { ResumeOptimizer } from '../../services/resume/optimizer';
import { JobMatcher } from '../../services/matching/job-matcher';
import { MessageGenerator } from '../../services/messaging/message-generator';
import { parsePortfolioResume } from '../../services/resume/parser';

export class JobScheduler {
  private job: CronJob | null = null;
  private isRunning = false;

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

  async runOnce(): Promise<void> {
    await this.runCycle();
  }

  private async runCycle(): Promise<void> {
    console.log('Starting application cycle...');
    const resume = parsePortfolioResume();
    
    const adapters = adapterRegistry.getEnabled(
      Object.entries(config.platforms)
        .filter(([, c]) => c.enabled)
        .map(([p]) => p as any)
    );

    for (const adapter of adapters) {
      try {
        const creds = this.vault.get(adapter.platform);
        if (!creds) {
          console.log(`No credentials for ${adapter.platform}, skipping`);
          continue;
        }

        await adapter.authenticate(creds);
        
        const jobs = await adapter.searchJobs({
          keywords: ['software engineer', 'qa engineer', 'quality assurance', 'business analyst'],
          location: 'India',
          remoteOnly: true,
        });

        const scored = await this.matcher.matchJobs(resume, jobs);
        const topJobs = scored.filter(s => s.score >= 70).slice(0, config.scheduler?.maxApplicationsPerRun || 10);

        for (const scoredJob of topJobs) {
          const jobDetail = await adapter.getJobDetails(scoredJob.job.id);
          const optimizedResume = await this.optimizer.optimize(resume, jobDetail.description || '');
          
          const application = this.buildApplication(optimizedResume, jobDetail);
          const result = await adapter.applyToJob(jobDetail, application);
          
          console.log(`Applied to ${jobDetail.title} at ${jobDetail.company}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
          
          const manager = await adapter.findHiringManager(jobDetail);
          if (manager) {
            const message = await this.messageGen.generate(resume, jobDetail, manager);
            await adapter.sendColdMessage(manager, message);
          }
        }
      } catch (error) {
        console.error(`Error processing ${adapter.platform}:`, error);
      }
    }
    
    console.log('Application cycle complete');
  }

  private buildApplication(resume: any, job: any): any {
    return {
      resume,
      coverLetter: `I'm excited to apply for ${job.title} at ${job.company}...`,
      answers: {},
      resumeFilePath: './resume.pdf',
      portfolioUrl: resume.personal.portfolio,
      linkedinUrl: resume.personal.linkedin,
    };
  }
}