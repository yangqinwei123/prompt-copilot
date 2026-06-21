import type { LLMMessage } from '@/src/llm/types';

export interface LLMRequest {
  type: 'llm-chat';
  messages: LLMMessage[];
}

export interface LLMResponse {
  ok: boolean;
  text?: string;
  error?: string;
}