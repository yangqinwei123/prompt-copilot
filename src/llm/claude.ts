import type { LLMProvider, LLMMessage, LLMConfig } from './types';

export const claudeProvider: LLMProvider = {
  async chat(messages, config) {
    // Claude 把 system 单独拎出来，不放在 messages 数组里
    const systemMsg = messages.find((m) => m.role === 'system')?.content ?? '';
    const chatMsgs = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        // 关键：声明允许从浏览器环境调用，绕过 CORS 限制
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1024,
        system: systemMsg,
        messages: chatMsgs,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Claude API 错误 ${res.status}: ${err}`);
    }

    const data = await res.json();
    // Claude 返回的内容在 content 数组里，取文本块
    return data.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n');
  },
};