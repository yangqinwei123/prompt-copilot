export interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

export type ConversationStage =
  | 'empty'      // 还没开始
  | 'opening'    // 刚开场
  | 'producing'  // AI 正在产出
  | 'iterating'  // 来回迭代中
  | 'unknown';

export interface SiteAdapter {
  matches(url: string): boolean;
  getMessages(): ChatMessage[];
  getInputBox(): HTMLElement | null;
  getInputText(): string;
  insertPrompt(text: string): void;
  detectStage(messages: ChatMessage[]): ConversationStage;
  isHealthy(): boolean;
}