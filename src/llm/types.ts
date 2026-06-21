export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  provider: 'claude' | 'openai-compatible';
  apiKey: string;
  model: string;
  // OpenAI 兼容厂商需要填各自的接口地址；Claude 用固定地址可留空
  baseURL?: string;
}

export interface LLMProvider {
  chat(messages: LLMMessage[], config: LLMConfig): Promise<string>;
}