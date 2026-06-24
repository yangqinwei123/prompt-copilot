import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'zh' | 'en';

// 语言包：所有界面文本的 key → 中英文
const dict = {
  appName: { zh: 'Prompt Copilot', en: 'Prompt Copilot' },
  memory: { zh: '记忆', en: 'Memory' },
  askMe: { zh: '让 AI 帮我提问', en: 'Let AI Ask Me' },
  thinking: { zh: '思考中…', en: 'Thinking…' },
  genHandoff: { zh: '生成接力摘要', en: 'Generate Handoff' },
  generating: { zh: '生成中…', en: 'Generating…' },
  resume: { zh: '续上对话', en: 'Resume' },
  single: { zh: '（单选）', en: ' (single)' },
  multi: { zh: '（多选）', en: ' (multi)' },
  notePlaceholder: { zh: '补充说明（可选）', en: 'Add details (optional)' },
  generatePrompt: { zh: '生成 Prompt 并填入', en: 'Generate & Insert' },
  working: { zh: '处理中…', en: 'Working…' },
  confirmNewContext: {
    zh: '检测到当前对话还没有归属的背景。\n\n点"确定"=新建一个对话背景\n点"取消"=归入当前背景（适合接力同一任务）',
    en: 'This conversation has no associated context yet.\n\nOK = create a new context\nCancel = merge into current context (for continuing the same task)',
  },
  noConvo: { zh: '当前没有对话内容', en: 'No conversation content yet' },
  handoffSaved: { zh: '接力摘要已保存，可在新对话点"续上对话"', en: 'Handoff summary saved. Click "Resume" in a new chat.' },
  handoffInserted: { zh: '已填入接力摘要，可发送给 AI 继续', en: 'Handoff inserted. Send it to continue.' },
  noHandoff: { zh: '没有可用的接力摘要，请先在原对话生成', en: 'No handoff summary available. Generate one first.' },
  errAsk: { zh: '生成问题失败：', en: 'Failed to generate questions: ' },
  errGen: { zh: '生成 Prompt 失败：', en: 'Failed to generate prompt: ' },
  errHandoff: { zh: '生成接力摘要失败：', en: 'Failed to generate handoff: ' },

  // —— 记忆面板 ——
  memoryTitle: { zh: '记忆管理', en: 'Memory' },
  profileSection: { zh: '用户画像', en: 'User Profile' },
  contextSection: { zh: '对话背景', en: 'Conversation Context' },
  fieldIdentity: { zh: '身份/职业', en: 'Identity / Role' },
  fieldDomain: { zh: '领域/专业', en: 'Domain / Expertise' },
  fieldPreferences: { zh: '表达/技术偏好', en: 'Communication Preferences' },
  btnNew: { zh: '+ 新建', en: '+ New' },
  noContext: { zh: '（不使用背景）', en: '(no context)' },
  fieldCtxName: { zh: '背景名称', en: 'Context Name' },
  fieldBackground: { zh: '项目背景', en: 'Project Background' },
  fieldEnvironment: { zh: '当前环境（技术栈/团队等）', en: 'Environment (stack/team, etc.)' },
  fieldProgress: { zh: '当前进度', en: 'Current Progress' },
  btnDelete: { zh: '删除此背景', en: 'Delete this context' },

    // —— 引导页 ——
  onbWelcome: { zh: '欢迎使用 Prompt Copilot 👋', en: 'Welcome to Prompt Copilot 👋' },
  onbDesc: { zh: '简单了解一下你，AI 提问会更贴合你。可跳过，之后在「记忆」里随时改。', en: 'Tell us a bit about you so AI fits you better. You can skip and edit later in "Memory".' },
  onbAge: { zh: '年龄段', en: 'Age' },
  onbDomain: { zh: '专业领域', en: 'Field' },
  onbNeeds: { zh: '主要需求（可多选）', en: 'Main Needs (multi-select)' },
  onbExtra: { zh: '补充说明（可选）', en: 'Additional Notes (optional)' },
  onbExtraPlaceholder: { zh: '比如：编程初学者，回答时请解释术语', en: 'e.g. Beginner in coding, please explain jargon' },
  onbSave: { zh: '保存并开始', en: 'Save & Start' },
  onbSkip: { zh: '跳过', en: 'Skip' },
} as const;

type DictKey = keyof typeof dict;

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: DictKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'zh',
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh');

  // 加载时读取保存的语言
  useEffect(() => {
    browser.storage.local.get('lang').then((r) => {
      if (r.lang === 'zh' || r.lang === 'en') setLangState(r.lang);
    });
  }, []);

  // 切换并持久化
  function setLang(l: Lang) {
    setLangState(l);
    browser.storage.local.set({ lang: l });
  }

  function t(key: DictKey): string {
    return dict[key]?.[lang] ?? key;
  }

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

// 在组件里用：const { t, lang, setLang } = useI18n();
export function useI18n() {
  return useContext(I18nContext);
}