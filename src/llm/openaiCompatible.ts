import type { LLMProvider, LLMMessage, LLMConfig } from './types';

export const openaiCompatibleProvider: LLMProvider = {
  async chat(messages, config) {
    // baseURL 各厂商不同，例如：
    //   DeepSeek: https://api.deepseek.com
    //   通义:     https://dashscope.aliyuncs.com/compatible-mode/v1
    //   智谱:     https://open.bigmodel.cn/api/paas/v4
    //   Kimi:     https://api.moonshot.cn/v1
    const base = config.baseURL?.replace(/\/$/, '') ?? 'https://api.openai.com/v1';

    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`API 错误 ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  },
};