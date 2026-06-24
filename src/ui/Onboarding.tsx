import { useState } from 'react';
import { useI18n } from '@/src/i18n';
import { loadMemory, saveMemory } from '@/src/storage/memory';

// 选项做成中英两版，按语言显示
const AGE_OPTIONS = {
  zh: ['18岁以下', '18-25岁', '26-35岁', '36岁以上'],
  en: ['Under 18', '18-25', '26-35', 'Over 36'],
};
const DOMAIN_OPTIONS = {
  zh: ['计算机/IT', '设计/创意', '商业/管理', '学生', '其他'],
  en: ['Tech/IT', 'Design/Creative', 'Business', 'Student', 'Other'],
};
const NEED_OPTIONS = {
  zh: ['写代码', '写作/文案', '学习/研究', '日常事务', '数据分析'],
  en: ['Coding', 'Writing', 'Learning/Research', 'Daily Tasks', 'Data Analysis'],
};

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { t, lang } = useI18n();
  const [age, setAge] = useState('');
  const [domain, setDomain] = useState('');
  const [needs, setNeeds] = useState<string[]>([]);
  const [extra, setExtra] = useState('');

  const ageOptions = AGE_OPTIONS[lang];
  const domainOptions = DOMAIN_OPTIONS[lang];
  const needOptions = NEED_OPTIONS[lang];

  function toggleNeed(n: string) {
    setNeeds((prev) =>
      prev.includes(n) ? prev.filter((x) => x !== n) : [...prev, n]
    );
  }

  async function handleSave() {
    const m = await loadMemory();
    const sep = lang === 'en' ? ', ' : '，';
    const sep2 = lang === 'en' ? '; ' : '；';
    const sep3 = lang === 'en' ? ', ' : '、';
    await saveMemory({
      ...m,
      profile: {
        identity: [age, domain].filter(Boolean).join(sep),
        domain: domain,
        preferences: [needs.join(sep3), extra].filter(Boolean).join(sep2),
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
        <h2 style={{ fontSize: 18, marginTop: 0 }}>{t('onbWelcome')}</h2>
        <p style={{ color: '#666', fontSize: 13 }}>{t('onbDesc')}</p>

        <div style={section}>{t('onbAge')}</div>
        <div style={chips}>
          {ageOptions.map((o) => (
            <button key={o} onClick={() => setAge(o)} style={age === o ? chipOn : chip}>{o}</button>
          ))}
        </div>

        <div style={section}>{t('onbDomain')}</div>
        <div style={chips}>
          {domainOptions.map((o) => (
            <button key={o} onClick={() => setDomain(o)} style={domain === o ? chipOn : chip}>{o}</button>
          ))}
        </div>

        <div style={section}>{t('onbNeeds')}</div>
        <div style={chips}>
          {needOptions.map((o) => (
            <button key={o} onClick={() => toggleNeed(o)} style={needs.includes(o) ? chipOn : chip}>{o}</button>
          ))}
        </div>

        <div style={section}>{t('onbExtra')}</div>
        <textarea value={extra} onChange={(e) => setExtra(e.target.value)}
          placeholder={t('onbExtraPlaceholder')}
          style={ta} />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={handleSave} style={primaryBtn}>{t('onbSave')}</button>
          <button onClick={handleSkip} style={skipBtn}>{t('onbSkip')}</button>
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