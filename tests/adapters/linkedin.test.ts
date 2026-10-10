import { LinkedInAdapter } from '@/adapters/linkedin';
import { PlatformAdapter } from '@/adapters/base';
import { 
  PlatformType, 
  ApplyResult, 
  MessageResult, 
  RateLimitConfig, 
  JobListing, 
  JobDetail, 
  JobSearchCriteria, 
  ApplicationPackage, 
  HiringManager,
  PlatformCredentials,
  AuthResult
} from '@/types';
import { Page, BrowserContext, Locator } from 'playwright';

const createMockLocator = (overrides: Partial<Record<string, jest.Mock>> = {}): jest.Mocked<Locator> => {
  const defaultMocks = {
    count: jest.fn().mockResolvedValue(0),
    isVisible: jest.fn().mockResolvedValue(false),
    click: jest.fn().mockResolvedValue(undefined),
    fill: jest.fn().mockResolvedValue(undefined),
    setInputFiles: jest.fn().mockResolvedValue(undefined),
    first: jest.fn().mockReturnThis(),
    last: jest.fn().mockReturnThis(),
    nth: jest.fn().mockReturnThis(),
    locator: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    getByText: jest.fn().mockReturnThis(),
    getByRole: jest.fn().mockReturnThis(),
    getByLabel: jest.fn().mockReturnThis(),
    getByPlaceholder: jest.fn().mockReturnThis(),
    getByAltText: jest.fn().mockReturnThis(),
    getByTitle: jest.fn().mockReturnThis(),
    getByTestId: jest.fn().mockReturnThis(),
    waitFor: jest.fn().mockResolvedValue(undefined),
    hover: jest.fn().mockResolvedValue(undefined),
    dblclick: jest.fn().mockResolvedValue(undefined),
    tap: jest.fn().mockResolvedValue(undefined),
    selectOption: jest.fn().mockResolvedValue(undefined),
    press: jest.fn().mockResolvedValue(undefined),
    focus: jest.fn().mockResolvedValue(undefined),
    blur: jest.fn().mockResolvedValue(undefined),
    type: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
    check: jest.fn().mockResolvedValue(undefined),
    uncheck: jest.fn().mockResolvedValue(undefined),
    scrollIntoViewIfNeeded: jest.fn().mockResolvedValue(undefined),
    screenshot: jest.fn().mockResolvedValue(Buffer.from('')),
    elementHandle: jest.fn().mockResolvedValue(null),
    elementHandles: jest.fn().mockResolvedValue([]),
    boundingBox: jest.fn().mockResolvedValue(null),
    all: jest.fn().mockResolvedValue([]),
    allInnerTexts: jest.fn().mockResolvedValue([]),
    allTextContents: jest.fn().mockResolvedValue([]),
    evaluate: jest.fn().mockResolvedValue(undefined),
    evaluateHandle: jest.fn().mockResolvedValue(undefined),
    evaluateAll: jest.fn().mockResolvedValue(undefined),
    waitForFunction: jest.fn().mockResolvedValue(undefined),
    dragTo: jest.fn().mockResolvedValue(undefined),
    and: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    inputValue: jest.fn().mockResolvedValue(''),
    textContent: jest.fn().mockResolvedValue(''),
    innerText: jest.fn().mockResolvedValue(''),
    innerHTML: jest.fn().mockResolvedValue(''),
    getAttribute: jest.fn().mockResolvedValue(null),
    getAttributeNames: jest.fn().mockResolvedValue([]),
    dispatchEvent: jest.fn().mockResolvedValue(undefined),
  };

  return {
    ...defaultMocks,
    ...overrides,
  } as unknown as jest.Mocked<Locator>;
};

jest.mock('@/services/browser/browser-manager', () => ({
  browserManager: {
    getContext: jest.fn(),
    newPage: jest.fn(),
  },
}));

jest.mock('@/config', () => ({
  config: {
    platforms: {
      linkedin: {
        enabled: true,
        rateLimit: { requestsPerMinute: 10, daily: 100, cooldownMs: 6000 },
        baseUrl: 'https://www.linkedin.com',
        selectors: {},
      },
    },
  },
}));

import { browserManager } from '@/services/browser/browser-manager';

describe('LinkedInAdapter', () => {
  let adapter: LinkedInAdapter;
  let mockContext: jest.Mocked<BrowserContext>;
  let mockPage: jest.Mocked<Page>;

  beforeEach(() => {
    adapter = new LinkedInAdapter();
    jest.clearAllMocks();

    mockPage = {
      goto: jest.fn().mockResolvedValue({ url: () => 'https://www.linkedin.com/feed/' }),
      fill: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      waitForURL: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      url: jest.fn().mockReturnValue('https://www.linkedin.com/feed/'),
      locator: jest.fn().mockReturnValue(createMockLocator()),
      evaluate: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
      setDefaultTimeout: jest.fn(),
      setDefaultNavigationTimeout: jest.fn(),
    } as unknown as jest.Mocked<Page>;

    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      pages: jest.fn().mockReturnValue([mockPage]),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      storageState: jest.fn().mockResolvedValue({ cookies: [], origins: [] }),
    } as unknown as jest.Mocked<BrowserContext>;

    (browserManager.getContext as jest.Mock).mockResolvedValue(mockContext);
    (browserManager.newPage as jest.Mock).mockResolvedValue(mockPage);
  });

  describe('constructor', () => {
    test('should have correct platform and baseUrl', () => {
      expect(adapter.platform).toBe('linkedin');
      expect(adapter.baseUrl).toBe('https://www.linkedin.com');
    });
  });

  describe('authenticate', () => {
    const credentials: PlatformCredentials = {
      email: 'test@example.com',
      password: 'password123',
    };

    test('should navigate to login page and fill credentials', async () => {
      const result = await adapter.authenticate(credentials);
      
      expect(browserManager.getContext).toHaveBeenCalledWith('linkedin');
      expect(browserManager.newPage).toHaveBeenCalledWith(mockContext);
      expect(mockPage.goto).toHaveBeenCalledWith('https://www.linkedin.com/login');
      expect(mockPage.fill).toHaveBeenCalledWith(expect.any(String), credentials.email);
      expect(mockPage.fill).toHaveBeenCalledWith(expect.any(String), credentials.password);
      expect(mockPage.click).toHaveBeenCalledWith(expect.any(String));
      expect(result).toHaveProperty('success');
    });

    test('should return success true when session validates', async () => {
      mockPage.waitForURL.mockResolvedValueOnce(undefined);
      (adapter as any).validateSession = jest.fn().mockResolvedValue(true);
      
      const result = await adapter.authenticate(credentials);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test('should return success false when session validation fails', async () => {
      mockPage.waitForURL.mockResolvedValueOnce(undefined);
      (adapter as any).validateSession = jest.fn().mockResolvedValue(false);
      
      const result = await adapter.authenticate(credentials);
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Login failed');
    });
  });

  describe('validateSession', () => {
    beforeEach(async () => {
      await adapter.authenticate({ email: 'test@example.com', password: 'password123' });
    });

    test('should return true when on feed page', async () => {
      mockPage.url.mockReturnValue('https://www.linkedin.com/feed/');
      
      const result = await adapter.validateSession();
      
      expect(mockPage.goto).toHaveBeenCalledWith('https://www.linkedin.com/feed');
      expect(result).toBe(true);
    });

    test('should return false when not on feed page', async () => {
      mockPage.url.mockReturnValue('https://www.linkedin.com/login');
      
      const result = await adapter.validateSession();
      
      expect(result).toBe(false);
    });

    test('should return false on error', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await adapter.validateSession();
      
      expect(result).toBe(false);
    });
  });

  describe('searchJobs', () => {
    beforeEach(async () => {
      await adapter.authenticate({ email: 'test@example.com', password: 'password123' });
    });

    test('should build correct search URL with criteria', async () => {
      const criteria: JobSearchCriteria = {
        keywords: ['software engineer', 'typescript'],
        location: 'San Francisco',
        remoteOnly: true,
        experienceLevels: ['entry', 'associate'],
      };

      const mockJobs: JobListing[] = [
        { id: '1', title: 'Software Engineer', company: 'Google', location: 'San Francisco, CA', url: 'https://linkedin.com/jobs/1', platform: 'linkedin' },
        { id: '2', title: 'Frontend Developer', company: 'Meta', location: 'Remote', url: 'https://linkedin.com/jobs/2', platform: 'linkedin' },
      ];

      mockPage.evaluate.mockResolvedValueOnce(mockJobs);

      const result = await adapter.searchJobs(criteria);

      expect(mockPage.goto).toHaveBeenCalledWith(expect.stringContaining('/jobs/search/'));
      expect(mockPage.goto).toHaveBeenCalledWith(expect.stringContaining('keywords=software+engineer+typescript'));
      expect(mockPage.goto).toHaveBeenCalledWith(expect.stringContaining('location=San+Francisco'));
      expect(mockPage.goto).toHaveBeenCalledWith(expect.stringContaining('f_WT=2'));
      expect(mockPage.goto).toHaveBeenCalledWith(expect.stringContaining('f_E=entry%2Cassociate'));
      expect(result).toEqual(mockJobs);
    });

    test('should throw error when not authenticated', async () => {
      (adapter as any).page = null;
      
      await expect(adapter.searchJobs({ keywords: ['test'] })).rejects.toThrow('Not authenticated');
    });

    test('should return empty array when no jobs found', async () => {
      mockPage.evaluate.mockResolvedValueOnce([]);

      const result = await adapter.searchJobs({ keywords: ['nonexistent'] });

      expect(result).toEqual([]);
    });
  });

  describe('getJobDetails', () => {
    beforeEach(async () => {
      await adapter.authenticate({ email: 'test@example.com', password: 'password123' });
    });

    test('should fetch job details from job URL', async () => {
      const mockJobDetail: JobDetail = {
        id: '123',
        title: 'Senior Software Engineer',
        company: 'Microsoft',
        location: 'Redmond, WA',
        description: 'We are looking for a senior engineer...',
        requirements: ['5+ years experience', 'TypeScript', 'React'],
        responsibilities: ['Design systems', 'Mentor junior engineers'],
        benefits: ['Health insurance', '401k matching'],
        platform: 'linkedin',
        url: 'https://www.linkedin.com/jobs/view/123',
        postedDate: new Date(),
      };

      mockPage.evaluate.mockResolvedValueOnce(mockJobDetail);

      const result = await adapter.getJobDetails('123');

      expect(mockPage.goto).toHaveBeenCalledWith('https://www.linkedin.com/jobs/view/123');
      expect(result).toEqual(mockJobDetail);
    });

    test('should throw error when not authenticated', async () => {
      (adapter as any).page = null;
      
      await expect(adapter.getJobDetails('123')).rejects.toThrow('Not authenticated');
    });
  });

  describe('applyToJob', () => {
    beforeEach(async () => {
      await adapter.authenticate({ email: 'test@example.com', password: 'password123' });
    });

    test('should navigate to job and click apply button', async () => {
      const job: JobDetail = {
        id: '123',
        title: 'Software Engineer',
        company: 'Google',
        location: 'Mountain View, CA',
        description: 'Job description',
        requirements: ['Python', 'Go'],
        responsibilities: ['Build services'],
        benefits: ['Free food'],
        platform: 'linkedin',
        url: 'https://www.linkedin.com/jobs/view/123',
        postedDate: new Date(),
      };

      const application: ApplicationPackage = {
        resumePath: '/path/to/resume.pdf',
        coverLetter: 'I am interested...',
        answers: { 'Years of experience': '5' },
      };

      mockPage.locator.mockReturnValue(createMockLocator({
        isVisible: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockResolvedValue(undefined),
        count: jest.fn().mockResolvedValue(1),
      }));

      const result = await adapter.applyToJob(job, application);

      expect(mockPage.goto).toHaveBeenCalledWith(job.url);
      expect(mockPage.click).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.platform).toBe('linkedin');
      expect(result.jobId).toBe('123');
    });

    test('should return failure when application fails', async () => {
      const job: JobDetail = {
        id: '123',
        title: 'Software Engineer',
        company: 'Google',
        location: 'Mountain View, CA',
        description: 'Job description',
        requirements: ['Python', 'Go'],
        responsibilities: ['Build services'],
        benefits: ['Free food'],
        platform: 'linkedin',
        url: 'https://www.linkedin.com/jobs/view/123',
        postedDate: new Date(),
      };

      const application: ApplicationPackage = {
        resumePath: '/path/to/resume.pdf',
        coverLetter: 'I am interested...',
        answers: {},
      };

      mockPage.waitForSelector.mockRejectedValueOnce(new Error('Timeout'));

      const result = await adapter.applyToJob(job, application);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('fillApplicationForm', () => {
    beforeEach(async () => {
      await adapter.authenticate({ email: 'test@example.com', password: 'password123' });
    });

    test('should fill resume upload if file input exists', async () => {
      const application: ApplicationPackage = {
        resumePath: '/path/to/resume.pdf',
        coverLetter: 'Cover letter',
        answers: { 'Years of experience': '5' },
      };

      mockPage.locator.mockReturnValue(createMockLocator({
        count: jest.fn().mockResolvedValue(1),
        setInputFiles: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
      }));

      await (adapter as any).fillApplicationForm(mockPage, application);

      expect(mockPage.locator).toHaveBeenCalledWith(expect.stringContaining('input[type="file"]'));
    });

    test('should fill phone, email, and cover letter fields', async () => {
      const application: ApplicationPackage = {
        resumePath: '/path/to/resume.pdf',
        coverLetter: 'My cover letter',
        answers: { phone: '123-456-7890', email: 'test@example.com', 'Years of experience': '5' },
      };

      mockPage.locator.mockReturnValue(createMockLocator({
        count: jest.fn().mockResolvedValue(1),
        fill: jest.fn().mockResolvedValue(undefined),
      }));

      await (adapter as any).fillApplicationForm(mockPage, application);

      expect(mockPage.locator).toHaveBeenCalledWith(expect.stringContaining('phoneNumber'));
      expect(mockPage.locator).toHaveBeenCalledWith(expect.stringContaining('email'));
      expect(mockPage.locator).toHaveBeenCalledWith(expect.stringContaining('coverLetter'));
    });

    test('should answer screening questions', async () => {
      const application: ApplicationPackage = {
        resumePath: '/path/to/resume.pdf',
        coverLetter: 'Cover letter',
        answers: { 'Years of experience': '5', 'Visa sponsorship needed': 'No' },
      };

      const questionLocator = createMockLocator({
        count: jest.fn().mockResolvedValue(1),
        fill: jest.fn().mockResolvedValue(undefined),
        locator: jest.fn().mockReturnValue(createMockLocator({
          first: jest.fn().mockReturnValue(createMockLocator({
            fill: jest.fn().mockResolvedValue(undefined),
          })),
        })),
      });

      mockPage.locator.mockReturnValue(questionLocator);

      await (adapter as any).fillApplicationForm(mockPage, application);

      expect(mockPage.locator).toHaveBeenCalledWith(expect.stringContaining('Years of experience'));
      expect(mockPage.locator).toHaveBeenCalledWith(expect.stringContaining('Visa sponsorship needed'));
    });
  });

  describe('findHiringManager', () => {
    beforeEach(async () => {
      await adapter.authenticate({ email: 'test@example.com', password: 'password123' });
    });

    test('should return null when no hiring manager found', async () => {
      const job: JobDetail = {
        id: '123',
        title: 'Software Engineer',
        company: 'Google',
        location: 'Mountain View, CA',
        description: 'Job description',
        requirements: [],
        responsibilities: [],
        platform: 'linkedin',
        url: 'https://www.linkedin.com/jobs/view/123',
        postedDate: new Date(),
      };

      mockPage.evaluate.mockResolvedValueOnce(null);

      const result = await adapter.findHiringManager(job);

      expect(result).toBeNull();
    });
  });

  describe('sendColdMessage', () => {
    beforeEach(async () => {
      await adapter.authenticate({ email: 'test@example.com', password: 'password123' });
    });

    test('should return error when no profile URL provided', async () => {
      const manager: HiringManager = {
        name: 'John Doe',
        title: 'Engineering Manager',
        company: 'Google',
        linkedinUrl: 'https://linkedin.com/in/johndoe',
      };

      const result = await adapter.sendColdMessage(manager, 'Hello!');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No profile URL provided');
    });

    test('should send connection request with message when profile URL provided', async () => {
      const manager: HiringManager = {
        name: 'John Doe',
        title: 'Engineering Manager',
        company: 'Google',
        profileUrl: 'https://linkedin.com/in/johndoe',
      };

      mockPage.locator.mockReturnValue(createMockLocator({
        isVisible: jest.fn().mockResolvedValue(true),
        click: jest.fn().mockResolvedValue(undefined),
        fill: jest.fn().mockResolvedValue(undefined),
        count: jest.fn().mockResolvedValue(1),
      }));
      mockPage.waitForSelector.mockResolvedValue(null);

      const result = await adapter.sendColdMessage(manager, 'Hello!');

      expect(mockPage.goto).toHaveBeenCalledWith(manager.profileUrl);
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });
  });

  describe('handleCaptcha', () => {
    test('should return true when no CAPTCHA detected', async () => {
      mockPage.locator.mockReturnValue(createMockLocator({
        count: jest.fn().mockResolvedValue(0),
      }));

      const result = await adapter.handleCaptcha(mockPage);

      expect(result).toBe(true);
    });

    test('should return false when CAPTCHA detected', async () => {
      mockPage.locator.mockReturnValue(createMockLocator({
        count: jest.fn().mockResolvedValue(1),
      }));

      const result = await adapter.handleCaptcha(mockPage);

      expect(result).toBe(false);
    });
  });

  describe('getRateLimits', () => {
    test('should return rate limits from config', () => {
      const limits = adapter.getRateLimits();
      
      expect(limits).toEqual({ requestsPerMinute: 10, daily: 100, cooldownMs: 6000 });
    });
  });
});