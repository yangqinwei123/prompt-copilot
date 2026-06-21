import type { SiteAdapter, ChatMessage, ConversationStage } from './types';

export const claudeAdapter: SiteAdapter = {
  matches(url) {
    return url.includes('claude.ai');
  },

  getMessages() {
    const messages: ChatMessage[] = [];
    const userNodes = document.querySelectorAll('[data-testid="user-message"]');
    const aiNodes = document.querySelectorAll('[class*="font-claude-response"]');

    const all: { el: HTMLElement; role: 'user' | 'assistant' }[] = [];
    userNodes.forEach((n) => all.push({ el: n as HTMLElement, role: 'user' }));
    aiNodes.forEach((n) => all.push({ el: n as HTMLElement, role: 'assistant' }));

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
    // Claude 输入框是 ProseMirror，有 data-testid="chat-input"
    return document.querySelector('[data-testid="chat-input"]') as HTMLElement | null;
  },

  getInputText() {
    const box = this.getInputBox();
    return box ? (box as HTMLElement).innerText.trim() : '';
  },

  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) { console.warn('[PromptCopilot] Claude 输入框未找到'); return; }
    box.focus();
    // ProseMirror，用 execCommand 插入（同 ChatGPT）
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('insertText', false, text);
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