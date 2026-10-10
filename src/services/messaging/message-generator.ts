import { LLMProvider } from '../ai/llm-provider';
import { Resume, Experience } from '../../types';
import { JobDetail, HiringManager } from '../../types';

const MESSAGE_TEMPLATES = {
  software_engineer: `Hi {{managerName}},

I came across the {{jobTitle}} role at {{company}} and was excited by {{specificDetail}}. 

With {{yearsExp}} years building {{topSkills}} and experience with {{relevantProject}}, I believe I could contribute meaningfully to {{companyGoal}}.

I've attached my resume tailored to this role. Would welcome a brief chat to discuss how I can help.

Best,
{{candidateName}}`,

  qa_engineer: `Hi {{managerName}},

I noticed the {{jobTitle}} position at {{company}} and your focus on {{qualityAspect}} caught my attention.

As a QA Engineer with {{yearsExp}} years in {{testingTypes}} and experience with {{tools}}, I've helped teams reduce bug escape rates by {{metric}}% and accelerate release cycles.

I've optimized my resume for this role - happy to share more about my approach to {{specificChallenge}}.

Thanks,
{{candidateName}}`,

  business_analyst: `Hi {{managerName}},

The {{jobTitle}} role at {{company}} aligns perfectly with my background in {{domain}} and {{methodology}}.

In my current role, I've {{keyAchievement}} resulting in {{impact}}. My technical background in {{techSkills}} helps me bridge business and engineering effectively.

Would love to discuss how I can support {{company}}'s {{initiative}}.

Best,
{{candidateName}}`,
};

export class MessageGenerator {
  constructor(private llm: LLMProvider) {}

  async generate(resume: Resume, job: JobDetail, manager: HiringManager | null): Promise<string> {
    const roleType = this.detectRoleType(job.title);
    const template = MESSAGE_TEMPLATES[roleType] || MESSAGE_TEMPLATES.software_engineer;
    
    const prompt = `
Generate a personalized cold message for a job application.

CANDIDATE:
- Name: ${resume.personal.name}
- Role: ${roleType}
- Experience: ${this.getYearsExp(resume)} years
- Top Skills: ${resume.skills[0]?.skills || 'N/A'}
- Key Project: ${resume.projects[0]?.title || 'N/A'}

JOB:
- Title: ${job.title}
- Company: ${job.company}
- Description: ${job.description.substring(0, 500)}

MANAGER: ${manager ? `${manager.name}, ${manager.title}` : 'Hiring Manager'}

Use this template as base but personalize heavily:
${template}

Return ONLY the final message, no extra commentary.
`;
    
    return this.llm.complete(prompt, { temperature: 0.4, maxTokens: 500 });
  }

  private detectRoleType(title: string): keyof typeof MESSAGE_TEMPLATES {
    const t = title.toLowerCase();
    if (t.includes('qa') || t.includes('quality') || t.includes('test')) return 'qa_engineer';
    if (t.includes('business analyst') || t.includes('ba ') || t.includes('product analyst')) return 'business_analyst';
    return 'software_engineer';
  }

  private getYearsExp(resume: Resume): number {
    return resume.experience.reduce((sum: number, e: Experience) => {
      const match = e.period.match(/(\d{4})\s*[-–]\s*(\d{4}|Present)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = match[2] === 'Present' ? new Date().getFullYear() : parseInt(match[2]);
        return sum + (end - start);
      }
      return sum;
    }, 0);
  }
}