import type { SiteAdapter, ChatMessage, ConversationStage } from './types';

export const chatgptAdapter: SiteAdapter = {
  matches(url) {
    return url.includes('chatgpt.com');
  },

  getMessages() {
    const nodes = document.querySelectorAll('[data-message-author-role]');
    const messages: ChatMessage[] = [];
    nodes.forEach((node) => {
      const role = node.getAttribute('data-message-author-role');
      const text = (node as HTMLElement).innerText.trim();
      if ((role === 'user' || role === 'assistant') && text) {
        messages.push({ role, text });
      }
    });
    return messages;
  },

  getInputBox() {
    // 已校准：ChatGPT 输入框是 id 为 prompt-textarea 的 ProseMirror 编辑器
    return document.querySelector('#prompt-textarea') as HTMLElement | null;
  },

   getInputText() {
    const box = this.getInputBox();
    // ProseMirror 编辑器，文字在里面，用 innerText 读取
    return box ? (box as HTMLElement).innerText.trim() : '';
  },

  insertPrompt(text) {
    const box = this.getInputBox();
    if (!box) {
      console.warn('[PromptCopilot] 没找到输入框，选择器可能需更新');
      return;
    }
    box.focus();

    // ProseMirror 编辑器：直接改 innerText 不可靠。
    // 优先用 execCommand 插入文本（会走编辑器自己的输入流程）。
    // 先全选清空已有内容，再插入。
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(box);
    selection?.removeAllRanges();
    selection?.addRange(range);

    // insertText 会被 ProseMirror 正确处理，并触发其内部状态更新
    const ok = document.execCommand('insertText', false, text);

    // 兜底：万一 execCommand 不生效，退回手动方式
    if (!ok) {
      box.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = text;
      box.appendChild(p);
      box.dispatchEvent(new InputEvent('input', { bubbles: true }));
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
    return document.querySelector('[data-message-author-role]') !== null;
  },
};