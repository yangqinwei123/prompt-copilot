import type { LLMMessage, LLMConfig } from './types';
import { claudeProvider } from './claude';
import { openaiCompatibleProvider } from './openaiCompatible';

export async function callLLM(messages: LLMMessage[], config: LLMConfig): Promise<string> {
  const provider =
    config.provider === 'claude' ? claudeProvider : openaiCompatibleProvider;
  return provider.chat(messages, config);
}