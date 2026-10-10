import { Command } from 'commander';
import { config } from './config';
import { browserManager } from './services/browser/browser-manager';
import { CredentialVault } from './services/security/credential-vault';
import { adapterRegistry } from './adapters/registry';
import { LinkedInAdapter } from './adapters/linkedin';
import { NaukriAdapter } from './adapters/naukri';
import { IndeedAdapter } from './adapters/indeed';
import { RemoteAdapter } from './adapters/remote';
import { JobScheduler } from './services/scheduling/scheduler';
import { OpenAIProvider } from './services/ai/llm-provider';
import { ResumeOptimizer } from './services/resume/optimizer';
import { JobMatcher } from './services/matching/job-matcher';
import { MessageGenerator } from './services/messaging/message-generator';
import { parsePortfolioResume } from './services/resume/parser';

const program = new Command();

program
  .name('job-auto-apply')
  .description('AI-powered multi-platform job application automation')
  .version('1.0.0');

// Register adapters
adapterRegistry.register(new LinkedInAdapter());
adapterRegistry.register(new NaukriAdapter());
adapterRegistry.register(new IndeedAdapter());
adapterRegistry.register(new RemoteAdapter());

// Setup command
program
  .command('setup')
  .description('Initialize credentials vault')
  .action(async () => {
    const vault = new CredentialVault();
    const masterPassword = process.env.MASTER_PASSWORD || await prompt('Master password: ');
    await vault.unlock(masterPassword);
    
    for (const platform of ['linkedin', 'naukri', 'indeed']) {
      const email = await prompt(`${platform} email: `);
      const password = await prompt(`${platform} password: `, true);
      await vault.set(platform, { email, password });
    }
    console.log('Credentials saved!');
  });

// Apply command
program
  .command('apply')
  .option('-p, --platform <platform>', 'Platform to apply on (linkedin, naukri, indeed, remote)')
  .option('-r, --role <role>', 'Role type (swe, qa, ba)')
  .option('--max <number>', 'Max applications', '10')
  .action(async (options) => {
    const llm = new OpenAIProvider(process.env.OPENAI_API_KEY!);
    const vault = new CredentialVault();
    await vault.unlock(process.env.MASTER_PASSWORD!);
    
    const optimizer = new ResumeOptimizer(llm);
    const matcher = new JobMatcher(llm);
    const messageGen = new MessageGenerator(llm);
    const scheduler = new JobScheduler(vault, optimizer, matcher, messageGen);
    
    await scheduler.runOnce();
    await browserManager.close();
  });

// Daemon command
program
  .command('daemon')
  .description('Run scheduler continuously')
  .action(async () => {
    const llm = new OpenAIProvider(process.env.OPENAI_API_KEY!);
    const vault = new CredentialVault();
    await vault.unlock(process.env.MASTER_PASSWORD!);
    
    const optimizer = new ResumeOptimizer(llm);
    const matcher = new JobMatcher(llm);
    const messageGen = new MessageGenerator(llm);
    const scheduler = new JobScheduler(vault, optimizer, matcher, messageGen);
    
    scheduler.start();
    
    process.on('SIGINT', () => {
      scheduler.stop();
      browserManager.close();
      process.exit(0);
    });
  });

// Test command
program
  .command('test <platform>')
  .description('Test adapter connection')
  .action(async (platform) => {
    const adapter = adapterRegistry.get(platform as any);
    if (!adapter) {
      console.error(`Unknown platform: ${platform}`);
      process.exit(1);
    }
    
    const vault = new CredentialVault();
    await vault.unlock(process.env.MASTER_PASSWORD!);
    const creds = vault.get(platform);
    
    if (!creds) {
      console.error(`No credentials for ${platform}`);
      process.exit(1);
    }
    
    const result = await adapter.authenticate(creds);
    console.log(result.success ? '✓ Authenticated' : `✗ Failed: ${result.error}`);
    await browserManager.close();
  });

program.parse();

async function prompt(message: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(message);
    process.stdin.once('data', (data) => resolve(data.toString().trim()));
  });
}