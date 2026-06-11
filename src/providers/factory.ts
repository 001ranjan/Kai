import type { LLMProvider } from '../types';

export function createProvider(): LLMProvider {
  const provider = (process.env.LLM_PROVIDER ?? 'claude').toLowerCase();
  const model = process.env.LLM_MODEL ?? '';

  switch (provider) {
    case 'claude': {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for claude provider');
      const { ClaudeProvider } = require('./claude');
      return new ClaudeProvider(apiKey, model || 'claude-sonnet-4-6');
    }
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) throw new Error('OPENAI_API_KEY is required for openai provider');
      const { OpenAIProvider } = require('./openai');
      return new OpenAIProvider(apiKey, model || 'gpt-4o');
    }
    case 'gemini': {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is required for gemini provider');
      const { GeminiProvider } = require('./gemini');
      return new GeminiProvider(apiKey, model || 'gemini-2.0-flash');
    }
    default:
      throw new Error(`Unknown LLM_PROVIDER: "${provider}". Use claude | openai | gemini`);
  }
}
