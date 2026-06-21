import { callLLM } from '@/src/llm';
import type { LLMConfig } from '@/src/llm/types';
import type { LLMRequest, LLMResponse } from '@/src/core/messaging';

export default defineBackground(() => {
  console.log('[PromptCopilot] background 已启动');

  browser.runtime.onMessage.addListener(
    (msg: LLMRequest, _sender, sendResponse) => {
      if (msg.type === 'llm-chat') {
        handleLLM(msg).then(sendResponse);
        return true; // 关键：异步响应必须 return true
      }
    }
  );

  async function handleLLM(msg: LLMRequest): Promise<LLMResponse> {
    try {
      // 从扩展存储读用户配置
      const stored = await browser.storage.local.get('llmConfig');
      const config = stored.llmConfig as LLMConfig | undefined;

      if (!config?.apiKey) {
        return { ok: false, error: '未配置 API key，请先在设置里填写' };
      }

      const text = await callLLM(msg.messages, config);
      return { ok: true, text };
    } catch (e: any) {
      console.error('[PromptCopilot] LLM 调用失败：', e);
      return { ok: false, error: e.message ?? String(e) };
    }
  }
});