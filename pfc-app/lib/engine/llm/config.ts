// ═══════════════════════════════════════════════════════════════════
// ██ LLM CONFIG — Inference Configuration Types & Defaults
// ═══════════════════════════════════════════════════════════════════

export type InferenceMode = 'simulation' | 'api' | 'local';
export type ApiProvider = 'openai' | 'anthropic';

export type OpenAIModel = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini';
export type AnthropicModel = 'claude-sonnet-4-20250514' | 'claude-3-5-sonnet-20241022' | 'claude-3-5-haiku-20241022';
export type OllamaModel = string; // user-configurable

export interface InferenceConfig {
  mode: InferenceMode;
  // API mode
  apiProvider?: ApiProvider;
  apiKey?: string;
  openaiModel?: OpenAIModel;
  anthropicModel?: AnthropicModel;
  // Local mode
  ollamaBaseUrl?: string;
  ollamaModel?: OllamaModel;
  // Shared
  maxTokens?: number;
  temperature?: number;
}

export const DEFAULT_INFERENCE_CONFIG: InferenceConfig = {
  mode: 'simulation',
  apiProvider: 'openai',
  openaiModel: 'gpt-4o',
  anthropicModel: 'claude-sonnet-4-20250514',
  ollamaBaseUrl: 'http://localhost:11434',
  ollamaModel: 'llama3.1',
  maxTokens: 4096,
  temperature: 0.7,
};

// Model display names for UI
export const OPENAI_MODELS: { value: OpenAIModel; label: string }[] = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
];

export const ANTHROPIC_MODELS: { value: AnthropicModel; label: string }[] = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
];
