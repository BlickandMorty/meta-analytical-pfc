// ═══════════════════════════════════════════════════════════════════
// ██ LLM CONFIG — Inference Configuration Types & Defaults
// ═══════════════════════════════════════════════════════════════════

export type InferenceMode = 'api' | 'local';
export type ApiProvider = 'openai' | 'anthropic' | 'google';

export type OpenAIModel =
  | 'o3'
  | 'o4-mini'
  | 'gpt-5.3'
  | 'gpt-5.2'
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo';

export type AnthropicModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-5-20250929'
  | 'claude-sonnet-4-20250514'
  | 'claude-haiku-4-5-20251001';

export type GoogleModel =
  | 'gemini-3-pro'
  | 'gemini-2.5-pro'
  | 'gemini-2.5-pro-fast'
  | 'gemini-2.5-flash'
  | 'gemini-2.0-flash'
  | 'gemini-2.0-flash-lite'
  | 'gemini-2.0-flash-thinking';

export type OllamaModel = string; // user-configurable

export interface InferenceConfig {
  mode: InferenceMode;
  // API mode
  apiProvider?: ApiProvider;
  apiKey?: string;
  openaiModel?: OpenAIModel;
  anthropicModel?: AnthropicModel;
  googleModel?: GoogleModel;
  // Local mode
  ollamaBaseUrl?: string;
  ollamaModel?: OllamaModel;
  // Shared
  maxTokens?: number;
  temperature?: number;
}

// Model display names for UI
export const OPENAI_MODELS: { value: OpenAIModel; label: string }[] = [
  { value: 'o3', label: 'o3 (Reasoning)' },
  { value: 'o4-mini', label: 'o4-mini (Reasoning)' },
  { value: 'gpt-5.3', label: 'GPT-5.3' },
  { value: 'gpt-5.2', label: 'GPT-5.2' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

export const ANTHROPIC_MODELS: { value: AnthropicModel; label: string }[] = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-5-20250929', label: 'Claude Sonnet 4.5' },
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
];

export const GOOGLE_MODELS: { value: GoogleModel; label: string }[] = [
  { value: 'gemini-3-pro', label: 'Gemini 3 Pro' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'gemini-2.5-pro-fast', label: 'Gemini 2.5 Pro Fast' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite' },
  { value: 'gemini-2.0-flash-thinking', label: 'Gemini 2.0 Flash Thinking' },
];

/** All providers with display info */
export const API_PROVIDERS: { value: ApiProvider; label: string; color: string }[] = [
  { value: 'openai', label: 'OpenAI', color: '#10a37f' },
  { value: 'anthropic', label: 'Anthropic', color: '#d4a27f' },
  { value: 'google', label: 'Google', color: '#4285f4' },
];
