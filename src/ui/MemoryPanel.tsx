import { useEffect, useState } from 'react';
import {
  loadMemory, saveMemory, newId,
  type MemoryState, type ConversationContext,
} from '@/src/storage/memory';

export function MemoryPanel({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<MemoryState | null>(null);

  useEffect(() => { loadMemory().then(setState); }, []);
  if (!state) return null;
  const s: MemoryState = state;  // 守卫后的非空引用，下面统一用 s

  function update(next: MemoryState) {
    setState(next);
    saveMemory(next);
  }

  const activeCtx = s.contexts.find((c) => c.id === s.activeContextId) ?? null;

  function addContext() {
    const ctx: ConversationContext = {
      id: newId(), name: '新背景', background: '', environment: '', progress: '',
    };
    update({ ...s, contexts: [...s.contexts, ctx], activeContextId: ctx.id });
  }

  function updateCtx(field: keyof ConversationContext, value: string) {
    if (!activeCtx) return;
    const contexts = s.contexts.map((c) =>
      c.id === activeCtx.id ? { ...c, [field]: value } : c
    );
    update({ ...s, contexts });
  }

  function deleteCtx() {
    if (!activeCtx) return;
    const contexts = s.contexts.filter((c) => c.id !== activeCtx.id);
    update({ ...s, contexts, activeContextId: contexts[0]?.id ?? null });
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
          <strong>记忆管理</strong>
          <button onClick={onClose} style={closeX}>×</button>
        </div>

        <div style={section}>用户画像</div>
        <input style={inp} placeholder="身份/职业" value={s.profile.identity}
          onChange={(e) => update({ ...s, profile: { ...s.profile, identity: e.target.value } })} />
        <input style={inp} placeholder="领域/专业" value={s.profile.domain}
          onChange={(e) => update({ ...s, profile: { ...s.profile, domain: e.target.value } })} />
        <input style={inp} placeholder="表达/技术偏好" value={s.profile.preferences}
          onChange={(e) => update({ ...s, profile: { ...s.profile, preferences: e.target.value } })} />

        <div style={section}>
          对话背景
          <button onClick={addContext} style={smallBtn}>+ 新建</button>
        </div>

        <select style={inp} value={s.activeContextId ?? ''}
          onChange={(e) => update({ ...s, activeContextId: e.target.value || null })}>
          <option value="">（不使用背景）</option>
          {s.contexts.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {activeCtx && (
          <>
            <input style={inp} placeholder="背景名称" value={activeCtx.name}
              onChange={(e) => updateCtx('name', e.target.value)} />
            <textarea style={ta} placeholder="项目背景" value={activeCtx.background}
              onChange={(e) => updateCtx('background', e.target.value)} />
            <textarea style={ta} placeholder="当前环境（技术栈/团队等）" value={activeCtx.environment}
              onChange={(e) => updateCtx('environment', e.target.value)} />
            <textarea style={ta} placeholder="当前进度" value={activeCtx.progress}
              onChange={(e) => updateCtx('progress', e.target.value)} />
            <button onClick={deleteCtx} style={delBtn}>删除此背景</button>
          </>
        )}
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 12, padding: 20, width: 360,
  maxHeight: '80vh', overflowY: 'auto', fontFamily: 'system-ui, sans-serif',
};
const section: React.CSSProperties = {
  fontWeight: 600, fontSize: 14, marginTop: 16, marginBottom: 8,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};
const inp: React.CSSProperties = {
  width: '100%', padding: '7px 9px', marginBottom: 8, fontSize: 13,
  border: '1px solid #ccc', borderRadius: 6, boxSizing: 'border-box',
};
const ta: React.CSSProperties = { ...inp, minHeight: 44, resize: 'vertical', fontFamily: 'inherit' };
const smallBtn: React.CSSProperties = {
  fontSize: 12, padding: '3px 8px', background: '#10a37f', color: '#fff',
  border: 'none', borderRadius: 6, cursor: 'pointer',
};
const delBtn: React.CSSProperties = {
  fontSize: 12, padding: '5px 10px', background: '#fff', color: '#c00',
  border: '1px solid #c00', borderRadius: 6, cursor: 'pointer', marginTop: 4,
};
const closeX: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#888',
};