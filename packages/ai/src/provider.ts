/**
 * Provider-neutral AI contract.
 *
 * Application code depends on this module only. Nothing here names a vendor;
 * the OpenAI-compatible wire format lives in openai-compatible-provider.ts.
 */

export type AIChatRole = 'system' | 'user' | 'assistant';

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
}

export interface AIChatRequest {
  /** Supplied by the caller; there is no default model (docs/PHASE_4_PROMPT.md "Model Handling"). */
  model: string;
  messages: AIChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIChatResponse {
  text: string;
  model: string;
  finishReason?: string;
  usage?: AIUsage;
}

export interface AIProvider {
  chat(request: AIChatRequest): Promise<AIChatResponse>;
}

export type AIErrorCode =
  | 'not_configured'
  | 'authentication'
  | 'rate_limited'
  | 'bad_request'
  | 'upstream_error'
  | 'network'
  | 'timeout'
  | 'malformed_response';

/**
 * The only error type callers see. Never carries the API key, headers, or the
 * raw upstream body — `detail` is a short, already-sanitised summary.
 */
export class AIError extends Error {
  constructor(
    public readonly code: AIErrorCode,
    message: string,
    public readonly status?: number,
    public override readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AIError';
  }
}
