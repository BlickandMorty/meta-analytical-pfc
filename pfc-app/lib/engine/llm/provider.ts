// ═══════════════════════════════════════════════════════════════════
// ██ LLM PROVIDER — Multi-Provider Resolution Layer
// ═══════════════════════════════════════════════════════════════════
//
// Given an InferenceConfig, resolves to the correct AI SDK LanguageModel.
// Supports: OpenAI, Anthropic, Google (API mode), Ollama (Local mode).
// ═══════════════════════════════════════════════════════════════════

import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { InferenceConfig } from './config';

export function resolveProvider(config: InferenceConfig): LanguageModel {
  if (config.mode === 'api') {
    if (!config.apiKey) {
      throw new Error('API key is required for API mode. Set your key in Settings.');
    }

    if (config.apiProvider === 'anthropic') {
      const anthropic = createAnthropic({ apiKey: config.apiKey });
      return anthropic(config.anthropicModel || 'claude-sonnet-4-20250514');
    }

    if (config.apiProvider === 'google') {
      const google = createGoogleGenerativeAI({ apiKey: config.apiKey });
      return google(config.googleModel || 'gemini-2.5-flash');
    }

    // Default: OpenAI
    const openai = createOpenAI({ apiKey: config.apiKey });
    return openai(config.openaiModel || 'gpt-4o');
  }

  if (config.mode === 'local') {
    const baseURL = config.ollamaBaseUrl || 'http://localhost:11434';
    const ollama = createOpenAICompatible({
      name: 'ollama',
      baseURL: `${baseURL}/v1`,
    });
    return ollama(config.ollamaModel || 'llama3.1');
  }

  throw new Error('resolveProvider should not be called in simulation mode');
}
