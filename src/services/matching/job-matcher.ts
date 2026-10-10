import { LLMProvider } from '../ai/llm-provider';
import { Resume, Experience, Project, SkillCategory } from '../../types';
import { JobListing } from '../../types';

export interface ScoredJob {
  job: JobListing;
  score: number;
  breakdown: { skills: number; experience: number; location: number; salary: number; culture: number };
  reasoning: string;
}

export class JobMatcher {
  constructor(private llm: LLMProvider) {}

  async matchJobs(resume: Resume, jobs: JobListing[]): Promise<ScoredJob[]> {
    const resumeText = this.resumeToText(resume);
    const resumeEmbedding = await this.llm.embed(resumeText);
    
    const results: ScoredJob[] = [];
    
    for (const job of jobs) {
      const jobText = `${job.title} ${job.company} ${job.description || ''} ${(job.requirements || []).join(' ')}`;
      const jobEmbedding = await this.llm.embed(jobText);
      
      const semanticScore = this.cosineSimilarity(resumeEmbedding, jobEmbedding) * 100;
      const skillScore = this.calculateSkillMatch(resume, job);
      const expScore = this.calculateExperienceMatch(resume, job);
      const locationScore = this.calculateLocationMatch(resume, job);
      
      const score = Math.round(
        semanticScore * 0.4 + skillScore * 0.3 + expScore * 0.2 + locationScore * 0.1
      );
      
      results.push({
        job,
        score,
        breakdown: { skills: skillScore, experience: expScore, location: locationScore, salary: 50, culture: 50 },
        reasoning: `Semantic: ${semanticScore.toFixed(0)}%, Skills: ${skillScore}%, Experience: ${expScore}%`
      });
    }
    
    return results.sort((a, b) => b.score - a.score);
  }

  private resumeToText(resume: Resume): string {
    return [
      resume.professionalSummary,
      ...resume.experience.flatMap((e: Experience) => e.items),
      ...resume.projects.flatMap((p: Project) => p.items),
      ...resume.skills.flatMap((s: SkillCategory) => s.skills.split(', ')),
    ].join(' ');
  }

  private calculateSkillMatch(resume: Resume, job: JobListing): number {
    const resumeSkills = resume.skills.flatMap((s: SkillCategory) => s.skills.toLowerCase().split(', '));
    const jobSkills = [...(job.requirements || []), ...(job.description || '').toLowerCase().split(' ')]
      .map((s: string) => s.trim().toLowerCase())
      .filter((s: string) => s.length > 2);
    
    const matches = resumeSkills.filter((rs: string) => jobSkills.some((js: string) => js.includes(rs) || rs.includes(js)));
    return resumeSkills.length > 0 ? Math.round((matches.length / resumeSkills.length) * 100) : 0;
  }

  private calculateExperienceMatch(resume: Resume, job: JobListing): number {
    const totalYears = resume.experience.reduce((sum: number, e: Experience) => {
      const match = e.period.match(/(\d{4})\s*[-–]\s*(\d{4}|Present)/);
      if (match) {
        const start = parseInt(match[1]);
        const end = match[2] === 'Present' ? new Date().getFullYear() : parseInt(match[2]);
        return sum + (end - start);
      }
      return sum;
    }, 0);
    
    if (job.title.toLowerCase().includes('senior') || job.title.toLowerCase().includes('lead')) {
      return totalYears >= 5 ? 100 : totalYears >= 3 ? 70 : 40;
    }
    if (job.title.toLowerCase().includes('junior') || job.title.toLowerCase().includes('trainee')) {
      return totalYears <= 2 ? 100 : 60;
    }
    return totalYears >= 2 ? 100 : 60;
  }

  private calculateLocationMatch(resume: Resume, job: JobListing): number {
    if (job.remoteType === 'remote') return 100;
    if (job.remoteType === 'hybrid') return 70;
    return resume.personal.location.toLowerCase().includes(job.location.toLowerCase().split(',')[0].toLowerCase()) ? 100 : 30;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum: number, val: number, i: number) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum: number, val: number) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum: number, val: number) => sum + val * val, 0));
    return dot / (normA * normB);
  }
}