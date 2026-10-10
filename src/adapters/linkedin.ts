import type { PlatformAdapter } from './base';
import type { 
  AuthResult, 
  PlatformCredentials, 
  JobListing, 
  JobDetail, 
  JobSearchCriteria, 
  ApplicationPackage, 
  ApplyResult, 
  HiringManager, 
  MessageResult, 
  RateLimitConfig 
} from '../types';
import { browserManager } from '../services/browser/browser-manager';
import type { Page } from 'playwright';
import { linkedinSelectors } from './linkedin-selectors';
import { config } from '@/config';

export class LinkedInAdapter implements PlatformAdapter {
  readonly platform = 'linkedin' as const;
  readonly baseUrl = 'https://www.linkedin.com';
  private context: Awaited<ReturnType<typeof browserManager.getContext>> | null = null;
  private page: Page | null = null;

  async authenticate(credentials: PlatformCredentials): Promise<AuthResult> {
    this.context = await browserManager.getContext('linkedin');
    this.page = await browserManager.newPage(this.context);
    
    await this.page.goto(`${this.baseUrl}/login`);
    await this.page.fill(linkedinSelectors.login.emailInput, credentials.email);
    await this.page.fill(linkedinSelectors.login.passwordInput, credentials.password);
    await this.page.click(linkedinSelectors.login.loginButton);
    
    await this.page.waitForURL('**/feed/**', { timeout: 30000 }).catch(() => {});
    
    const isLoggedIn = await this.validateSession();
    return { success: isLoggedIn, error: isLoggedIn ? undefined : 'Login failed' };
  }

  async validateSession(): Promise<boolean> {
    if (!this.page) return false;
    try {
      await this.page.goto(`${this.baseUrl}/feed`);
      return this.page.url().includes('/feed');
    } catch { return false; }
  }

  async searchJobs(criteria: JobSearchCriteria): Promise<JobListing[]> {
    if (!this.page) throw new Error('Not authenticated');
    
    const query = new URLSearchParams({
      keywords: criteria.keywords.join(' '),
      location: criteria.location || '',
      f_WT: criteria.remoteOnly ? '2' : '',
      f_E: criteria.experienceLevels?.join(',') || '',
    }).toString();
    
    await this.page.goto(`${this.baseUrl}/jobs/search/?${query}`);
    await this.page.waitForSelector(linkedinSelectors.jobSearch.jobCard, { timeout: 10000 });
    
    return this.page.evaluate((sel) => {
      const cards = document.querySelectorAll(sel.jobCard);
      return Array.from(cards).map(card => ({
        id: card.getAttribute('data-job-id') || card.getAttribute('data-entity-urn')?.split(':').pop() || '',
        platform: 'linkedin' as const,
        title: card.querySelector(sel.jobTitle)?.textContent?.trim() || '',
        company: card.querySelector(sel.companyName)?.textContent?.trim() || '',
        location: card.querySelector(sel.location)?.textContent?.trim() || '',
        url: (card.querySelector(sel.jobTitle) as HTMLAnchorElement)?.href || '',
      }));
    }, {
      jobCard: linkedinSelectors.jobSearch.jobCard,
      jobTitle: linkedinSelectors.jobSearch.jobTitle,
      companyName: linkedinSelectors.jobSearch.companyName,
      location: linkedinSelectors.jobSearch.location,
    });
  }

  async getJobDetails(jobId: string): Promise<JobDetail> {
    if (!this.page) throw new Error('Not authenticated');
    await this.page.goto(`${this.baseUrl}/jobs/view/${jobId}`);
    await this.page.waitForSelector(linkedinSelectors.jobDetail.description, { timeout: 10000 });
    
    // Pass jobId as argument to evaluate callback
    return this.page.evaluate((id: string) => ({
      id: id,
      platform: 'linkedin' as const,
      title: document.querySelector('.job-details-jobs-unified-top-card__job-title')?.textContent?.trim() || '',
      company: document.querySelector('.job-details-jobs-unified-top-card__company-name')?.textContent?.trim() || '',
      location: document.querySelector('.job-details-jobs-unified-top-card__bullet')?.textContent?.trim() || '',
      description: document.querySelector('.jobs-description__content')?.textContent?.trim() || '',
      requirements: Array.from(document.querySelectorAll('.jobs-description__content li')).map(el => el.textContent?.trim() || ''),
      responsibilities: [],
      benefits: [],
      postedDate: new Date(),
      url: window.location.href,
    }), jobId);
  }

  async applyToJob(job: JobDetail, application: ApplicationPackage): Promise<ApplyResult> {
    if (!this.page) throw new Error('Not authenticated');
    
    try {
      await this.page.goto(job.url);
      await this.page.waitForSelector(linkedinSelectors.jobDetail.applyButton, { timeout: 10000 });
      await this.page.click(linkedinSelectors.jobDetail.applyButton);
      await this.page.waitForSelector(linkedinSelectors.easyApply.modal, { timeout: 10000 });
      
      await this.fillApplicationForm(this.page, application);
      
      // Navigate through steps
      let continueLoop = true;
      while (continueLoop) {
        const nextBtn = this.page.locator(linkedinSelectors.easyApply.nextButton);
        const submitBtn = this.page.locator(linkedinSelectors.easyApply.submitButton);
        const reviewBtn = this.page.locator(linkedinSelectors.easyApply.reviewButton);
        
        if (await submitBtn.isVisible({ timeout: 1000 })) {
          await submitBtn.click();
          continueLoop = false;
        } else if (await reviewBtn.isVisible({ timeout: 1000 })) {
          await reviewBtn.click();
          await this.page.waitForTimeout(1000);
          const finalSubmitBtn = this.page.locator(linkedinSelectors.easyApply.submitButton);
          if (await finalSubmitBtn.isVisible({ timeout: 1000 })) {
            await finalSubmitBtn.click();
            continueLoop = false;
          }
        } else if (await nextBtn.isVisible({ timeout: 1000 })) {
          await nextBtn.click();
          await this.fillApplicationForm(this.page, application);
        } else {
          continueLoop = false;
        }
      }
      
      await this.page.waitForSelector(linkedinSelectors.toasts.success + ', ' + linkedinSelectors.easyApply.confirmationModal, { timeout: 10000 });
      return { success: true, applicationId: `linkedin-${Date.now()}`, appliedAt: new Date(), platform: 'linkedin', jobId: job.id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Application failed', appliedAt: new Date(), platform: 'linkedin', jobId: job.id };
    }
  }

  async fillApplicationForm(page: Page, application: ApplicationPackage): Promise<void> {
    // Resume upload (optional - only if file exists)
    const fs = await import('fs');
    const fileInput = page.locator(linkedinSelectors.easyApply.fileUpload);
    if (await fileInput.count() > 0 && application.resumePath && fs.existsSync(application.resumePath)) {
      await fileInput.setInputFiles(application.resumePath);
    }
    
    // Common fields
    const fields = [
      { selector: linkedinSelectors.easyApply.phoneInput, value: application.answers?.phone || '' },
      { selector: linkedinSelectors.easyApply.emailInput, value: application.answers?.email || '' },
      { selector: linkedinSelectors.easyApply.coverLetterTextarea, value: application.coverLetter || '' },
    ];
    
    for (const field of fields) {
      const input = page.locator(field.selector);
      if (await input.count() > 0 && field.value) {
        await input.fill(field.value);
      }
    }
    
    // LinkedIn profile URL
    const linkedInInput = page.locator(linkedinSelectors.easyApply.linkedInProfileInput);
    if (await linkedInInput.count() > 0 && application.answers?.linkedinUrl) {
      await linkedInInput.fill(application.answers.linkedinUrl);
    }
    
    // Portfolio URL
    const portfolioInput = page.locator(linkedinSelectors.easyApply.portfolioUrlInput);
    if (await portfolioInput.count() > 0 && application.answers?.portfolioUrl) {
      await portfolioInput.fill(application.answers.portfolioUrl);
    }
    
    // GitHub URL
    const githubInput = page.locator(linkedinSelectors.easyApply.githubUrlInput);
    if (await githubInput.count() > 0 && application.answers?.githubUrl) {
      await githubInput.fill(application.answers.githubUrl);
    }
    
    // Answer screening questions
    for (const [question, answer] of Object.entries(application.answers || {})) {
      if (['phone', 'email', 'linkedinUrl', 'portfolioUrl', 'githubUrl'].includes(question)) continue;
      
      const questionLabel = page.locator(`${linkedinSelectors.easyApply.questionLabel}:has-text("${question}")`);
      if (await questionLabel.count() > 0) {
        const input = questionLabel.locator('..').locator(linkedinSelectors.easyApply.questionInput).first();
        if (await input.count() > 0) {
          const tagName = await input.evaluate(el => el.tagName.toLowerCase());
          if (tagName === 'select') {
            await input.selectOption({ label: answer });
          } else if (tagName === 'input' && (await input.getAttribute('type')) === 'radio') {
            const radioOption = page.locator(`${linkedinSelectors.easyApply.radioOption}[value="${answer}"]`);
            if (await radioOption.count() > 0) {
              await radioOption.click();
            }
          } else if (tagName === 'input' && (await input.getAttribute('type')) === 'checkbox') {
            if (answer.toLowerCase() === 'true' || answer.toLowerCase() === 'yes') {
              await input.check();
            }
          } else {
            await input.fill(answer);
          }
        }
      }
    }
  }

  async findHiringManager(job: JobDetail): Promise<HiringManager | null> {
    if (!this.page) return null;
    
    try {
      // Navigate to company page
      await this.page.goto(`${this.baseUrl}/company/${job.company.toLowerCase().replace(/\s+/g, '-')}/people/`);
      await this.page.waitForSelector(linkedinSelectors.company.employeeList, { timeout: 10000 });
      
      // Search for hiring managers/recruiters
      const searchInput = this.page.locator(linkedinSelectors.company.searchEmployeesInput);
      if (await searchInput.count() > 0) {
        await searchInput.fill('hiring manager recruiter talent acquisition');
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(2000);
      }
      
      const hiringManager = await this.page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('.org-people-profile-card, .artdeco-entity-lockup'));
        for (const card of cards) {
          const title = card.querySelector('.org-people-profile-card__headline, .artdeco-entity-lockup__subtitle')?.textContent?.toLowerCase() || '';
          if (title.includes('hiring') || title.includes('recruiter') || title.includes('talent acquisition') || title.includes('hr')) {
            return {
              name: card.querySelector('.org-people-profile-card__profile-title, .artdeco-entity-lockup__title')?.textContent?.trim() || '',
              title: card.querySelector('.org-people-profile-card__headline, .artdeco-entity-lockup__subtitle')?.textContent?.trim() || '',
              company: '',
              profileUrl: (card.querySelector('.org-people-profile-card__profile-link, .artdeco-entity-lockup__title a') as HTMLAnchorElement)?.href || '',
            };
          }
        }
        return null;
      });
      
      if (hiringManager) {
        return { ...hiringManager, company: job.company };
      }
    } catch {
      // Ignore errors, return null
    }
    
    return null;
  }

  async sendColdMessage(manager: HiringManager, message: string): Promise<MessageResult> {
    if (!this.page || !manager.profileUrl) {
      return { success: false, error: 'No profile URL provided', sentAt: new Date() };
    }
    
    try {
      await this.page.goto(manager.profileUrl);
      await this.page.waitForSelector(linkedinSelectors.profile.connectButton, { timeout: 10000 });
      
      const connectBtn = this.page.locator(linkedinSelectors.profile.connectButton);
      if (await connectBtn.isVisible()) {
        await connectBtn.click();
        await this.page.waitForSelector(linkedinSelectors.messaging.connectionRequestNote, { timeout: 5000 });
        
        const noteTextarea = this.page.locator(linkedinSelectors.messaging.connectionRequestNote);
        await noteTextarea.fill(message);
        
        const sendBtn = this.page.locator(linkedinSelectors.messaging.sendWithNote);
        await sendBtn.click();
        
        return { success: true, messageId: `msg-${Date.now()}`, sentAt: new Date() };
      }
      
      return { success: false, error: 'Connect button not found', sentAt: new Date() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to send message', sentAt: new Date() };
    }
  }

  async handleCaptcha(page: Page): Promise<boolean> {
    // Detect CAPTCHA
    const captcha = page.locator(linkedinSelectors.captcha.challenge);
    if (await captcha.count() > 0) {
      // Could integrate 2Captcha or similar service here
      return false;
    }
    return true;
  }

  getRateLimits(): RateLimitConfig {
    return config.platforms.linkedin.rateLimit;
  }
}