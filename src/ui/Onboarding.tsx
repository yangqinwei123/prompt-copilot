import { useState } from 'react';
import { loadMemory, saveMemory } from '@/src/storage/memory';

const AGE_OPTIONS = ['18岁以下', '18-25岁', '26-35岁', '36岁以上'];
const DOMAIN_OPTIONS = ['计算机/IT', '设计/创意', '商业/管理', '学生', '其他'];
const NEED_OPTIONS = ['写代码', '写作/文案', '学习/研究', '日常事务', '数据分析'];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const [age, setAge] = useState('');
  const [domain, setDomain] = useState('');
  const [needs, setNeeds] = useState<string[]>([]);
  const [extra, setExtra] = useState('');

  function toggleNeed(n: string) {
    setNeeds((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  }

  async function handleSave() {
    const m = await loadMemory();
    // 把引导选择写入画像
    await saveMemory({
      ...m,
      profile: {
        identity: [age, domain].filter(Boolean).join('，'),
        domain: domain,
        preferences: [needs.join('、'), extra].filter(Boolean).join('；'),
      },
      onboarded: true,
    });
    onDone();
  }

  async function handleSkip() {
    const m = await loadMemory();
    await saveMemory({ ...m, onboarded: true });
    onDone();
  }

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ fontSize: 18, marginTop: 0 }}>欢迎使用 Prompt Copilot 👋</h2>
        <p style={{ color: '#666', fontSize: 13 }}>
          简单了解一下你，AI 提问会更贴合你。可跳过，之后在「记忆」里随时改。
        </p>

        <div style={section}>年龄段</div>
        <div style={chips}>
          {AGE_OPTIONS.map((o) => (
            <button key={o} onClick={() => setAge(o)} style={age === o ? chipOn : chip}>{o}</button>
          ))}
        </div>

        <div style={section}>专业领域</div>
        <div style={chips}>
          {DOMAIN_OPTIONS.map((o) => (
            <button key={o} onClick={() => setDomain(o)} style={domain === o ? chipOn : chip}>{o}</button>
          ))}
        </div>

        <div style={section}>主要需求（可多选）</div>
        <div style={chips}>
          {NEED_OPTIONS.map((o) => (
            <button key={o} onClick={() => toggleNeed(o)} style={needs.includes(o) ? chipOn : chip}>{o}</button>
          ))}
        </div>

        <div style={section}>补充说明（可选）</div>
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)}
          placeholder="比如：编程初学者，回答时请解释术语"
          style={ta} />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={handleSave} style={primaryBtn}>保存并开始</button>
          <button onClick={handleSkip} style={skipBtn}>跳过</button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  zIndex: 100001, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 14, padding: 24, width: 380,
  maxHeight: '85vh', overflowY: 'auto', fontFamily: 'system-ui, sans-serif', color: '#222',
};
const section: React.CSSProperties = { fontWeight: 600, fontSize: 13, marginTop: 16, marginBottom: 8 };
const chips: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 6 };
const chip: React.CSSProperties = {
  padding: '5px 12px', fontSize: 13, background: '#f0f0f0',
  border: '1px solid #ddd', borderRadius: 16, cursor: 'pointer', color: '#333',
};
const chipOn: React.CSSProperties = {
  ...chip, background: '#6b4ce6', color: '#fff', border: '1px solid #6b4ce6',
};
const ta: React.CSSProperties = {
  width: '100%', padding: 8, fontSize: 13, border: '1px solid #ccc',
  borderRadius: 8, boxSizing: 'border-box', minHeight: 50, resize: 'vertical', fontFamily: 'inherit',
};
const primaryBtn: React.CSSProperties = {
  flex: 1, padding: '9px', background: '#10a37f', color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
};
const skipBtn: React.CSSProperties = {
  padding: '9px 20px', background: '#fff', color: '#888',
  border: '1px solid #ccc', borderRadius: 8, cursor: 'pointer', fontSize: 14,
};