import { useState, useEffect } from 'react';
import { useI18n } from '@/src/i18n';
import type { SiteAdapter } from '@/src/adapters/types';
import {
  buildQuestionMessages, buildFinalPromptMessages,
  buildContextExtractMessages, buildProfileExtractMessages, buildNameContextMessages,
  buildHandoffMessages,
  buildMemoryContext, parseQuestions, parseContextExtract, parseProfileExtract,
  type Question,
} from '@/src/core/promptFlow';
import {
  loadMemory, saveMemory, getActiveContext, newId,
  type ConversationContext,
} from '@/src/storage/memory';
import { MemoryPanel } from './MemoryPanel';
import { Onboarding } from './Onboarding';

const PROFILE_UPDATE_EVERY = 5; // 每 5 次提炼才更新一次画像

async function askLLM(messages: any[]): Promise<string> {
  const res = await browser.runtime.sendMessage({ type: 'llm-chat', messages });
  if (!res?.ok) throw new Error(res?.error ?? '未知错误');
  return res.text as string;
}

// 判断当前是否是"初始页/新对话页"（还没有具体对话 id）
function isInitialPage(url: string): boolean {
  try {
    const u = new URL(url);
    const path = u.pathname;
    const hasConversationId =
      /\/c\/[\w-]+/.test(path) ||           // ChatGPT
      /\/a\/chat\/s\/[\w-]+/.test(path) ||  // DeepSeek
      /\/chat\/[\w-]+/.test(path) ||        // Claude
      /\/thread\/[\w-]+/.test(path);        // 豆包等（按需调整）
    return !hasConversationId; // 没有对话 id = 初始页
  } catch {
    return false;
  }
}

export function Sidebar({ adapter }: { adapter: SiteAdapter }) {
  const { t, lang, setLang } = useI18n();

  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [showMemory, setShowMemory] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [siteChanged, setSiteChanged] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const m = await loadMemory();
      if (!m.onboarded) setShowOnboarding(true);

      const currentUrl = location.href;
      if (isInitialPage(currentUrl)) return; // 初始页不自动切背景

      const owner = m.contexts.find((c) => (c.urls ?? []).includes(currentUrl));
      if (owner && m.activeContextId !== owner.id) {
        await saveMemory({ ...m, activeContextId: owner.id });
        console.log('[PromptCopilot] 已自动切回背景：', owner.name);
      }
    })();
  }, []);

  async function getMemoryContext(): Promise<string> {
    const m = await loadMemory();
    return buildMemoryContext(m.profile, getActiveContext(m));
  }

  async function ensureContextForCurrentUrl(): Promise<boolean> {
    const m = await loadMemory();
    const currentUrl = location.href;
    const initial = isInitialPage(currentUrl);

    // 初始页：不反查、不关联 URL，每次都当新对话弹窗
    if (initial) {
      const newContext = confirm(t('confirmNewContext'));
      if (newContext) {
        const fresh = {
          id: newId(), name: '新对话',
          background: '', environment: '', progress: '',
          urls: [],   // 初始页不写入 URL，避免污染后续新对话
        };
        await saveMemory({ ...m, contexts: [...m.contexts, fresh], activeContextId: fresh.id });
      }
      // 选"取消"则继续用当前背景，也不关联初始页 URL
      return true;
    }

    // 非初始页（有对话 id）：正常反查归属
    const owner = m.contexts.find((c) => (c.urls ?? []).includes(currentUrl));
    if (owner) {
      if (m.activeContextId !== owner.id) {
        await saveMemory({ ...m, activeContextId: owner.id });
        console.log('[PromptCopilot] 已自动切回背景：', owner.name);
      }
      return true;
    }

    // 有对话 id 但没归属：弹窗，并关联这个真实对话 URL
    const newContext = confirm(t('confirmNewContext'));
    if (newContext) {
      const fresh = {
        id: newId(), name: '新对话',
        background: '', environment: '', progress: '',
        urls: [currentUrl],
      };
      await saveMemory({ ...m, contexts: [...m.contexts, fresh], activeContextId: fresh.id });
    } else {
      const activeCtx = getActiveContext(m);
      if (activeCtx) {
        const contexts = m.contexts.map((c) =>
          c.id === activeCtx.id ? { ...c, urls: [...(c.urls ?? []), currentUrl] } : c
        );
        await saveMemory({ ...m, contexts });
      } else {
        const fresh = {
          id: newId(), name: '新对话',
          background: '', environment: '', progress: '',
          urls: [currentUrl],
        };
        await saveMemory({ ...m, contexts: [...m.contexts, fresh], activeContextId: fresh.id });
      }
    }
    return true;
  }

  async function handleGetQuestions() {
    await ensureContextForCurrentUrl();

    setError(''); setQuestions([]); setAnswers({}); setNotes({});
    setLoading('asking');
    try {
      const convo = adapter.getMessages().map((m) => `${m.role}: ${m.text}`).join('\n');
      const draft = adapter.getInputText();
      const memory = await getMemoryContext();
      const raw = await askLLM(buildQuestionMessages(convo, draft, memory, lang));
      setQuestions(parseQuestions(raw));
    } catch (e: any) {
      setError(`${t('errAsk')}${e.message ?? String(e)}`);
    } finally {
      setLoading('');
    }
  }

  function toggleOption(q: Question, option: string) {
    setAnswers((prev) => {
      const cur = prev[q.id] ?? [];
      if (q.type === 'single') return { ...prev, [q.id]: [option] };
      return cur.includes(option)
        ? { ...prev, [q.id]: cur.filter((o) => o !== option) }
        : { ...prev, [q.id]: [...cur, option] };
    });
  }

  function setNote(qid: string, value: string) {
    setNotes((prev) => ({ ...prev, [qid]: value }));
  }

  async function handleGeneratePrompt() {
    setError('');
    setLoading('generating');
    try {
      const convo = adapter.getMessages().map((m) => `${m.role}: ${m.text}`).join('\n');
      const draft = adapter.getInputText();
      const memory = await getMemoryContext();
      const ans = questions.map((q) => ({
        question: q.question,
        selected: answers[q.id] ?? [],
        note: notes[q.id] ?? '',
      }));
      const finalPrompt = await askLLM(buildFinalPromptMessages(convo, draft, memory, ans, lang));
      adapter.insertPrompt(finalPrompt.trim());
      setQuestions([]); setAnswers({}); setNotes({});
      silentExtract(convo, draft);
    } catch (e: any) {
      setError(`${t('errGen')}${e.message ?? String(e)}`);
    } finally {
      setLoading('');
    }
  }

  async function handleGenerateHandoff() {
    await ensureContextForCurrentUrl();
    setError('');
    setLoading('handoff');
    try {
      const convo = adapter.getMessages().map((m) => `${m.role}: ${m.text}`).join('\n');
      if (!convo) { setError(t('noConvo')); return; }

      const m = await loadMemory();
      const activeCtx = getActiveContext(m);
      const handoff = (await askLLM(buildHandoffMessages(convo, activeCtx, lang))).trim();

      if (activeCtx) {
        const contexts = m.contexts.map((c) =>
          c.id === activeCtx.id ? { ...c, handoff } : c
        );
        await saveMemory({ ...m, contexts });
      } else {
        await saveMemory({ ...m, looseHandoff: handoff } as any);
      }
      setError('✅ ' + t('handoffSaved'));
    } catch (e: any) {
      setError(`${t('errHandoff')}${e.message ?? String(e)}`);
    } finally {
      setLoading('');
    }
  }

  async function handleResumeHandoff() {
    const m = await loadMemory();
    const ctx = getActiveContext(m);
    const handoff = ctx?.handoff ?? (m as any).looseHandoff;
    if (!handoff) {
      setError(t('noHandoff'));
      return;
    }
    adapter.insertPrompt(handoff);
    setError('✅ ' + t('handoffInserted'));
  }

  async function silentExtract(convo: string, draft: string) {
    try {
      const m = await loadMemory();
      const activeCtx = getActiveContext(m);

      const ctxRaw = await askLLM(buildContextExtractMessages(convo, draft, activeCtx, lang));
      const ctxData = parseContextExtract(ctxRaw);

      let contexts = m.contexts;
      let activeId = m.activeContextId;
      let targetCtx: ConversationContext;

      if (!activeId || !activeCtx) {
        targetCtx = {
          id: newId(), name: '新对话',
          background: ctxData.background ?? '',
          environment: ctxData.environment ?? '',
          progress: ctxData.progress ?? '',
          urls: isInitialPage(location.href) ? [] : [location.href],
        };
        contexts = [...m.contexts, targetCtx];
        activeId = targetCtx.id;
      } else {
        targetCtx = {
          ...activeCtx,
          background: ctxData.background ?? activeCtx.background,
          environment: ctxData.environment ?? activeCtx.environment,
          progress: ctxData.progress ?? activeCtx.progress,
        };
        contexts = m.contexts.map((c) => (c.id === activeId ? targetCtx : c));
      }

      if (targetCtx.name === '新对话') {
        try {
          const name = (await askLLM(buildNameContextMessages(convo, draft, lang))).trim().slice(0, 12);
          if (name) {
            targetCtx = { ...targetCtx, name };
            contexts = contexts.map((c) => (c.id === activeId ? targetCtx : c));
          }
        } catch {}
      }

      let count = (m.extractCount ?? 0) + 1;
      let profile = m.profile;
      if (count >= PROFILE_UPDATE_EVERY) {
        try {
          const profRaw = await askLLM(buildProfileExtractMessages(convo, m.profile, lang));
          const p = parseProfileExtract(profRaw);
          profile = {
            identity: p.identity ?? m.profile.identity,
            domain: p.domain ?? m.profile.domain,
            preferences: p.preferences ?? m.profile.preferences,
          };
          count = 0;
        } catch {}
      }

      await saveMemory({ ...m, profile, contexts, activeContextId: activeId, extractCount: count });
      console.log('[PromptCopilot] 记忆已更新，画像计数：', count);
    } catch (e) {
      console.warn('[PromptCopilot] 自动提炼失败（已忽略）：', e);
    }
  }

  function removeQuestion(qid: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== qid));
    setAnswers((prev) => { const n = { ...prev }; delete n[qid]; return n; });
    setNotes((prev) => { const n = { ...prev }; delete n[qid]; return n; });
  }

  if (!open) {
    return <button onClick={() => setOpen(true)} style={floatBtnStyle}>Copilot</button>;
  }

  return (
    <>
      {showOnboarding && <Onboarding onDone={() => setShowOnboarding(false)} />}
      {showMemory && <MemoryPanel onClose={() => setShowMemory(false)} />}
      <div style={panelStyle}>
        <div style={headerStyle}>
          <span style={titleStyle}>{t('appName')}</span>
          <div style={headerBtnGroupStyle}>
            <button
              onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              style={langBtnStyle}
            >
              {lang === 'zh' ? '中 | EN' : 'EN | 中'}
            </button>
            <button onClick={() => setShowMemory(true)} style={memBtnStyle}>{t('memory')}</button>
            <button onClick={() => setOpen(false)} style={closeBtnStyle}>×</button>
          </div>
        </div>

        <button onClick={handleGetQuestions} disabled={!!loading} style={aiBtnStyle}>
          {loading === 'asking' ? t('thinking') : t('askMe')}
        </button>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={handleGenerateHandoff} disabled={!!loading} style={handoffBtnStyle}>
            {loading === 'handoff' ? t('generating') : t('genHandoff')}
          </button>
          <button onClick={handleResumeHandoff} disabled={!!loading} style={handoffBtnStyle}>
            {t('resume')}
          </button>
        </div>

        {questions.map((q) => (
          <div key={q.id} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span>
                {q.question}
                <span style={{ color: '#999', fontWeight: 400 }}>
                  {q.type === 'multi' ? t('multi') : t('single')}
                </span>
              </span>
              <button onClick={() => removeQuestion(q.id)} style={qCloseStyle}>×</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {q.options.map((opt) => {
                const selected = (answers[q.id] ?? []).includes(opt);
                return (
                  <button key={opt} onClick={() => toggleOption(q, opt)}
                    style={selected ? optBtnActive : optBtn}>
                    {opt}
                  </button>
                );
              })}
            </div>
            <input value={notes[q.id] ?? ''} onChange={(e) => setNote(q.id, e.target.value)}
              placeholder={t('notePlaceholder')} style={noteInputStyle} />
          </div>
        ))}

        {questions.length > 0 && (
          <button onClick={handleGeneratePrompt} disabled={!!loading} style={genBtnStyle}>
            {loading === 'generating' ? t('generating') : t('generatePrompt')}
          </button>
        )}

        {loading && !questions.length && (
          <p style={{ fontSize: 13, color: '#666', marginTop: 10 }}>{t('working')}</p>
        )}
        {error && <p style={{ fontSize: 13, color: error.startsWith('✅') ? '#080' : '#c00', marginTop: 10 }}>{error}</p>}
      </div>
    </>
  );
}

// —— 样式 ——
const panelStyle: React.CSSProperties = {
  position: 'fixed', right: 16, top: 100, width: 300, zIndex: 99999,
  background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12,
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: 14,
  fontFamily: 'system-ui, sans-serif', color: '#222',
  maxHeight: '75vh', overflowY: 'auto',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  marginBottom: 12, gap: 8,
};
const titleStyle: React.CSSProperties = {
  fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', flexShrink: 0,
};
const headerBtnGroupStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
};
const langBtnStyle: React.CSSProperties = {
  fontSize: 12, padding: '3px 8px', background: '#fff',
  border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', color: '#666',
};
const aiBtnStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '8px 10px',
  background: '#6b4ce6', color: '#fff', border: 'none', borderRadius: 8,
  cursor: 'pointer', fontSize: 14,
};
const genBtnStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '8px 10px', marginTop: 14,
  background: '#10a37f', color: '#fff', border: 'none', borderRadius: 8,
  cursor: 'pointer', fontSize: 14,
};
const memBtnStyle: React.CSSProperties = {
  fontSize: 12, padding: '3px 8px', background: '#f0f0f0',
  border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', color: '#333',
};
const optBtn: React.CSSProperties = {
  padding: '5px 10px', fontSize: 12, background: '#f0f0f0',
  border: '1px solid #ddd', borderRadius: 16, cursor: 'pointer', color: '#333',
};
const optBtnActive: React.CSSProperties = {
  ...optBtn, background: '#6b4ce6', color: '#fff', border: '1px solid #6b4ce6',
};
const noteInputStyle: React.CSSProperties = {
  width: '100%', marginTop: 8, padding: '6px 8px', fontSize: 12,
  border: '1px solid #ddd', borderRadius: 6, boxSizing: 'border-box',
};
const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888',
  padding: '0 2px', lineHeight: 1,
};
const floatBtnStyle: React.CSSProperties = {
  position: 'fixed', right: 16, top: 100, zIndex: 99999,
  background: '#10a37f', color: '#fff', border: 'none', borderRadius: 20,
  padding: '8px 14px', cursor: 'pointer', fontSize: 13,
  boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
};
const handoffBtnStyle: React.CSSProperties = {
  flex: 1, padding: '7px 6px', fontSize: 12,
  background: '#fff', color: '#6b4ce6', border: '1px solid #6b4ce6',
  borderRadius: 8, cursor: 'pointer',
};
const qCloseStyle: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: 16, cursor: 'pointer',
  color: '#bbb', padding: '0 4px', flexShrink: 0,
};