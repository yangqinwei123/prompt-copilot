import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Prompt Copilot',
    description: 'LLM 对话副驾',
    permissions: ['storage'],
    host_permissions: [
      'https://chatgpt.com/*',
      'https://api.anthropic.com/*',
      'https://chat.deepseek.com/*',
      'https://www.doubao.com/*',   // 豆包网页
      'https://claude.ai/*',        // Claude 网页
      // OpenAI 兼容厂商：按需增减
      'https://api.deepseek.com/*',
      'https://dashscope.aliyuncs.com/*',
      'https://open.bigmodel.cn/*',
      'https://api.moonshot.cn/*',
      'https://api.openai.com/*',
    ],
  },
});