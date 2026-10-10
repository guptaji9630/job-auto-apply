export interface LLMProvider {
  complete(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string>;
  embed(text: string): Promise<number[]>;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
}

interface EmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

export class OpenAIProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string = 'gpt-4o-mini') {}
  
  async complete(prompt: string, options: LLMOptions = {}): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.3,
        max_tokens: options.maxTokens ?? 2000,
      })
    });
    const data = await response.json() as OpenAIResponse;
    return data.choices[0].message.content;
  }
  
  async embed(text: string): Promise<number[]> {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text })
    });
    const data = await response.json() as EmbeddingResponse;
    return data.data[0].embedding;
  }
}