import { LLMProvider } from '../ai/llm-provider';
import { Resume, SkillCategory } from '../../types';

export interface OptimizedResume extends Resume {
  optimizationNotes: string[];
  keywordsMatched: string[];
  keywordsAdded: string[];
}

const RESUME_OPTIMIZATION_PROMPT = `
You are an expert resume optimizer for tech roles. Given a base resume and a job description, produce an optimized version.

RULES:
1. Keep all factual information accurate - NEVER invent experience or skills
2. Reorder skills to prioritize those mentioned in the JD
3. Rewrite professional summary to mirror JD language/keywords
4. Rephrase experience bullets to include relevant keywords naturally
5. Add missing keywords that are truthfully applicable
6. Maintain ATS-friendly formatting

BASE RESUME:
{{RESUME_JSON}}

JOB DESCRIPTION:
{{JOB_DESCRIPTION}}

Return JSON with the same structure as the base resume plus:
- optimizationNotes: string[]
- keywordsMatched: string[]
- keywordsAdded: string[]
`;

export class ResumeOptimizer {
  constructor(private llm: LLMProvider) {}

  async optimize(baseResume: Resume, jobDescription: string): Promise<OptimizedResume> {
    const prompt = RESUME_OPTIMIZATION_PROMPT
      .replace('{{RESUME_JSON}}', JSON.stringify(baseResume, null, 2))
      .replace('{{JOB_DESCRIPTION}}', jobDescription);
    
    const response = await this.llm.complete(prompt, { temperature: 0.2 });
    
    try {
      const optimized = JSON.parse(response);
      return {
        ...baseResume,
        ...optimized,
        optimizationNotes: optimized.optimizationNotes || [],
        keywordsMatched: optimized.keywordsMatched || [],
        keywordsAdded: optimized.keywordsAdded || [],
      };
    } catch {
      return this.basicOptimize(baseResume, jobDescription);
    }
  }

  private basicOptimize(resume: Resume, jd: string): OptimizedResume {
    const jdLower = jd.toLowerCase();
    const keywords = ['react', 'node', 'javascript', 'typescript', 'jest', 'playwright', 'cypress', 'selenium', 'api testing', 'automation', 'ci/cd', 'docker', 'aws', 'graphql', 'mongodb', 'postgresql'];
    
    const matched = keywords.filter((k: string) => jdLower.includes(k));
    const missing = keywords.filter((k: string) => !jdLower.includes(k) && resume.skills.some((s: SkillCategory) => s.skills.toLowerCase().includes(k)));
    
    return {
      ...resume,
      professionalSummary: `${resume.professionalSummary} Key expertise: ${matched.slice(0, 5).join(', ')}.`,
      optimizationNotes: ['Basic keyword matching applied'],
      keywordsMatched: matched,
      keywordsAdded: missing.slice(0, 5),
    };
  }
}