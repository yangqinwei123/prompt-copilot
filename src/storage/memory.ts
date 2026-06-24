// —— 数据结构 ——
export interface Profile {
  identity: string;    // 身份/职业
  domain: string;      // 领域/专业
  preferences: string; // 表达偏好、技术偏好等
}

export interface ConversationContext {
  id: string;
  name: string;        // 背景名称，如"医院系统项目"
  background: string;  // 项目背景
  environment: string; // 当前环境（技术栈、团队等）
  progress: string;    // 当前进度
  handoff?: string;   // 接力摘要
  urls?: string[];   // 这个背景涉及过的对话 URL 列表
}

export interface MemoryState {
  profile: Profile;
  contexts: ConversationContext[];
  activeContextId: string | null;
  onboarded?: boolean;   // 是否完成首次引导
  extractCount?: number;   // 自上次更新画像以来的提炼次数
  looseHandoff?: string;   // 没有背景时的游离接力摘要
}

const EMPTY_PROFILE: Profile = { identity: '', domain: '', preferences: '' };

// —— 读取全部记忆 ——
export async function loadMemory(): Promise<MemoryState> {
  const r = await browser.storage.local.get('memory');
  const m = r.memory as MemoryState | undefined;
  return (
    m ?? { profile: EMPTY_PROFILE, contexts: [], activeContextId: null }
  );
}

// —— 保存全部记忆 ——
export async function saveMemory(state: MemoryState): Promise<void> {
  await browser.storage.local.set({ memory: state });
}

// —— 取当前激活的背景 ——
export function getActiveContext(state: MemoryState): ConversationContext | null {
  return state.contexts.find((c) => c.id === state.activeContextId) ?? null;
}

// —— 生成简短 id ——
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}