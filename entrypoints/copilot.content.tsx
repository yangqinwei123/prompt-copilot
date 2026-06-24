import { getAdapter } from '@/src/adapters/registry';
import { createRoot } from 'react-dom/client';
import { Sidebar } from '@/src/ui/Sidebar';
import { I18nProvider } from '@/src/i18n';

export default defineContentScript({
  // 匹配所有支持的站点
  matches: [
    'https://chatgpt.com/*',
    'https://chat.deepseek.com/*',
    'https://www.doubao.com/*',
    'https://claude.ai/*',
  ],
  main() {
    const adapter = getAdapter(location.href);
    if (!adapter) {
      console.log('[PromptCopilot] 当前站点无适配器');
      return;
    }
    console.log('[PromptCopilot] content script 已加载，站点适配器就绪');

    const host = document.createElement('div');
    host.id = 'prompt-copilot-root';
    document.body.appendChild(host);
    createRoot(host).render(
      <I18nProvider>
        <Sidebar adapter={adapter} />
      </I18nProvider>
    );
  },
});