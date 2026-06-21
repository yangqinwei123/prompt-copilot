import { useState, useEffect } from 'react';
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
  getLastUrl, setLastUrl, type ConversationContext,
} from '@/src/storage/memory';
import { MemoryPanel } from './MemoryPanel';
import { Onboarding } from './Onboarding';

const PROFILE_UPDATE_EVERY = 5; // 每 5 次提炼才更新一次画像

async function askLLM(messages: any[]): Promise<string> {
  const res = await browser.runtime.sendMessage({ type: 'llm-chat', messages });
  if (!res?.ok) throw new Error(res?.error ?? '未知错误');
  return res.text as string;
}

export function Sidebar({ adapter }: { adapter: SiteAdapter }) {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [showMemory, setShowMemory] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [siteChanged, setSiteChanged] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  // 加载时：检查首次引导 + URL 切换
  useEffect(() => {
    (async () => {
      const m = await loadMemory();
      if (!m.onboarded) setShowOnboarding(true);
      const last = await getLastUrl();
      if (last && last !== location.href) setSiteChanged(true);
      await setLastUrl(location.href);
    })();
  }, []);

  async function getMemoryContext(): Promise<string> {
    const m = await loadMemory();
    return buildMemoryContext(m.profile, getActiveContext(m));
  }

  async function handleGetQuestions() {
    // 检测到切换对话/LLM，先问新建还是继续
    if (siteChanged) {
      const newContext = confirm(
        '检测到你切换了对话或 AI 网站。\n\n点"确定"=新建一个对话背景\n点"取消"=继续使用当前背景'
      );
      if (newContext) {
        const m = await loadMemory();
        const fresh = { id: newId(), name: '新对话', background: '', environment: '', progress: '' };
        await saveMemory({ ...m, contexts: [...m.contexts, fresh], activeContextId: fresh.id });
      }
      setSiteChanged(false);
    }

    setError(''); setQuestions([]); setAnswers({}); setNotes({});
    setLoading('正在生成问题…');
    try {
      const convo = adapter.getMessages().map((m) => `${m.role}: ${m.text}`).join('\n');
      const draft = adapter.getInputText();
      const memory = await getMemoryContext();
      const raw = await askLLM(buildQuestionMessages(convo, draft, memory));
      setQuestions(parseQuestions(raw));
    } catch (e: any) {
      setError(`生成问题失败：${e.message ?? String(e)}`);
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
    setLoading('正在生成 Prompt…');
    try {
      const convo = adapter.getMessages().map((m) => `${m.role}: ${m.text}`).join('\n');
      const draft = adapter.getInputText();
      const memory = await getMemoryContext();
      const ans = questions.map((q) => ({
        question: q.question,
        selected: answers[q.id] ?? [],
        note: notes[q.id] ?? '',
      }));
      const finalPrompt = await askLLM(buildFinalPromptMessages(convo, draft, memory, ans));
      adapter.insertPrompt(finalPrompt.trim());
      setQuestions([]); setAnswers({}); setNotes({});
      silentExtract(convo, draft);   // 后台提炼，不阻塞
    } catch (e: any) {
      setError(`生成 Prompt 失败：${e.message ?? String(e)}`);
    } finally {
      setLoading('');
    }
  }

  // 生成接力摘要，存进当前背景
  async function handleGenerateHandoff() {
    setError('');
    setLoading('正在生成接力摘要…');
    try {
      const convo = adapter.getMessages().map((m) => `${m.role}: ${m.text}`).join('\n');
      if (!convo) { setError('当前没有对话内容'); return; }

      const m = await loadMemory();
      const activeCtx = getActiveContext(m);

      // 不依赖背景：有背景就带上，没有就只用对话内容
      const handoff = (await askLLM(buildHandoffMessages(convo, activeCtx))).trim();

      if (activeCtx) {
        // 有激活背景：存进该背景
        const contexts = m.contexts.map((c) =>
          c.id === activeCtx.id ? { ...c, handoff } : c
        );
        await saveMemory({ ...m, contexts });
      } else {
        // 没有背景：存为游离摘要，不强制新建背景
        await saveMemory({ ...m, looseHandoff: handoff } as any);
      }
      setError('✅ 接力摘要已保存，可在新对话点"续上对话"');
    } catch (e: any) {
      setError(`生成接力摘要失败：${e.message ?? String(e)}`);
    } finally {
      setLoading('');
    }
  }

  // 把当前背景的接力摘要填入输入框
  async function handleResumeHandoff() {
    const m = await loadMemory();
    const ctx = getActiveContext(m);
    const handoff = ctx?.handoff ?? (m as any).looseHandoff;
    if (!handoff) {
      setError('没有可用的接力摘要，请先在原对话生成');
      return;
    }
    adapter.insertPrompt(handoff);
    setError('✅ 已填入接力摘要，可发送给 AI 继续');
  }

  // 静默提炼：背景每次更新，画像每 5 次更新，背景自动命名
  async function silentExtract(convo: string, draft: string) {
    try {
      const m = await loadMemory();
      const activeCtx = getActiveContext(m);

      // 1. 背景：每次都更新
      const ctxRaw = await askLLM(buildContextExtractMessages(convo, draft, activeCtx));
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

      // 2. 自动命名：背景还叫"新对话"就起个名
      if (targetCtx.name === '新对话') {
        try {
          const name = (await askLLM(buildNameContextMessages(convo, draft))).trim().slice(0, 12);
          if (name) {
            targetCtx = { ...targetCtx, name };
            contexts = contexts.map((c) => (c.id === activeId ? targetCtx : c));
          }
        } catch {}
      }

      // 3. 画像：计数到 5 才更新
      let count = (m.extractCount ?? 0) + 1;
      let profile = m.profile;
      if (count >= PROFILE_UPDATE_EVERY) {
        try {
          const profRaw = await askLLM(buildProfileExtractMessages(convo, m.profile));
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
          <span style={{ fontWeight: 600 }}>Prompt Copilot</span>
          <div>
            <button onClick={() => setShowMemory(true)} style={memBtnStyle}>记忆</button>
            <button onClick={() => setOpen(false)} style={closeBtnStyle}>×</button>
          </div>
        </div>

        <button onClick={handleGetQuestions} disabled={!!loading} style={aiBtnStyle}>
          {loading === '正在生成问题…' ? '思考中…' : '让 AI 帮我提问'}
        </button>

        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <button onClick={handleGenerateHandoff} disabled={!!loading} style={handoffBtnStyle}>
            {loading === '正在生成接力摘要…' ? '生成中…' : '生成接力摘要'}
          </button>
          <button onClick={handleResumeHandoff} disabled={!!loading} style={handoffBtnStyle}>
            续上对话
          </button>
        </div>

        {questions.map((q) => (
          <div key={q.id} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {q.question}
              <span style={{ color: '#999', fontWeight: 400 }}>
                {q.type === 'multi' ? '（多选）' : '（单选）'}
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
              placeholder="补充说明（可选）" style={noteInputStyle} />
          </div>
        ))}

        {questions.length > 0 && (
          <button onClick={handleGeneratePrompt} disabled={!!loading} style={genBtnStyle}>
            {loading === '正在生成 Prompt…' ? '生成中…' : '生成 Prompt 并填入'}
          </button>
        )}

        {loading && !questions.length && (
          <p style={{ fontSize: 13, color: '#666', marginTop: 10 }}>{loading}</p>
        )}
        {error && <p style={{ fontSize: 13, color: error.startsWith('✅') ? '#080' : '#c00', marginTop: 10 }}>{error}</p>}
      </div>
    </>
  );
}

// —— 样式 ——
const panelStyle: React.CSSProperties = {
  position: 'fixed', right: 16, top: 100, width: 280, zIndex: 99999,
  background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12,
  boxShadow: '0 4px 20px rgba(0,0,0,0.12)', padding: 14,
  fontFamily: 'system-ui, sans-serif', color: '#222',
  maxHeight: '75vh', overflowY: 'auto',
};
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
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
  fontSize: 12, padding: '3px 8px', marginRight: 8, background: '#f0f0f0',
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