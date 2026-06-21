import type { SiteAdapter, ChatMessage, ConversationStage } from './types';

export const deepseekAdapter: SiteAdapter = {
  matches(url) {
    return url.includes('chat.deepseek.com');
  },

  getMessages() {
    const messages: ChatMessage[] = [];

    // AI 消息：class 含 ds-assistant-message-main-content
    // 用户消息：class 含 ds-message 但不含 assistant
    // 用属性选择器匹配 class 包含特定子串，避开随机 class
    const userNodes = document.querySelectorAll(
      '[class*="ds-message"]:not([class*="assistant"])'
    );
    const aiNodes = document.querySelectorAll(
      '[class*="ds-assistant-message-main-content"]'
    );

    // 收集并按它们在页面中的位置排序，保持对话顺序
    const all: { el: HTMLElement; role: 'user' | 'assistant' }[] = [];
    userNodes.forEach((n) => all.push({ el: n as HTMLElement, role: 'user' }));
    aiNodes.forEach((n) => all.push({ el: n as HTMLElement, role: 'assistant' }));

    // 按 DOM 顺序排序（compareDocumentPosition）
    all.sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

    all.forEach(({ el, role }) => {
      const text = el.innerText.trim();
      if (text) messages.push({ role, text });
    });

    return messages;
  },

  getInputBox() {
    // DeepSeek 输入框：textarea，name="search" 是稳定标识
    return document.querySelector('textarea[name="search"]') as HTMLElement | null;
  },

  getInputText() {
    const box = this.getInputBox();
    // DeepSeek 输入框是 textarea，文字在 value 里
    return box ? (box as HTMLTextAreaElement).value.trim() : '';
  },

  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      console.warn('[PromptCopilot] DeepSeek 输入框未找到');
      return;
    }
    box.focus();
    if (box instanceof HTMLTextAreaElement) {
      // 用原生 setter 赋值，再触发 input 事件让 React 感知
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