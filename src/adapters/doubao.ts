import type { SiteAdapter, ChatMessage, ConversationStage } from './types';

export const doubaoAdapter: SiteAdapter = {
  matches(url) {
    return url.includes('doubao.com');
  },

  getMessages() {
    const messages: ChatMessage[] = [];
    const nodes = document.querySelectorAll('[data-message-id]');
    nodes.forEach((node) => {
      const el = node as HTMLElement;
      const text = el.innerText.trim();
      if (!text) return;
      // 用户消息靠右(justify-end)，AI 消息靠左
      const isUser = el.className.includes('justify-end');
      messages.push({ role: isUser ? 'user' : 'assistant', text });
    });
    return messages;
  },

  getInputBox() {
    return document.querySelector('textarea[placeholder*="发消息"]') as HTMLElement | null;
  },

  getInputText() {
    const box = this.getInputBox();
    return box ? (box as HTMLTextAreaElement).value.trim() : '';
  },

  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) { console.warn('[PromptCopilot] 豆包输入框未找到'); return; }
    box.focus();
    if (box instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype, 'value'
      )?.set;
      setter?.call(box, text);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
  },

  detectStage(messages) {
    if (messages.length === 0) return 'empty';
    if (messages.length <= 2) return 'opening';
    const last = messages[messages.length - 1];
    if (last.role === 'assistant') return 'iterating';
    return 'producing';
  },

  isHealthy() {
    return this.getInputBox() !== null;
  },
};