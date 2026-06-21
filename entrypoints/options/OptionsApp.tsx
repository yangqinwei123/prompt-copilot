import { useEffect, useState } from 'react';
import type { LLMConfig } from '@/src/llm/types';

// 预设厂商，选了自动填好 baseURL 和默认模型名
const PRESETS: Record<string, Partial<LLMConfig> & { label: string }> = {
  deepseek: {
    label: 'DeepSeek',
    provider: 'openai-compatible',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  claude: {
    label: 'Claude (Anthropic)',
    provider: 'claude',
    baseURL: '',
    model: 'claude-haiku-4-5-20251001',
  },
  qwen: {
    label: '通义千问',
    provider: 'openai-compatible',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  custom: {
    label: '自定义 (OpenAI 兼容)',
    provider: 'openai-compatible',
    baseURL: '',
    model: '',
  },
};

export function OptionsApp() {
  const [preset, setPreset] = useState('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PRESETS.deepseek.model ?? '');
  const [baseURL, setBaseURL] = useState(PRESETS.deepseek.baseURL ?? '');
  const [status, setStatus] = useState('');
  const [testing, setTesting] = useState(false);

  // 载入已保存的配置
  useEffect(() => {
    browser.storage.local.get('llmConfig').then((r) => {
      const cfg = r.llmConfig as LLMConfig | undefined;
      if (cfg) {
        setApiKey(cfg.apiKey ?? '');
        setModel(cfg.model ?? '');
        setBaseURL(cfg.baseURL ?? '');
        // 反推 preset：匹配不到就归到 custom
        const found = Object.entries(PRESETS).find(
          ([, p]) => p.provider === cfg.provider && p.baseURL === cfg.baseURL
        );
        setPreset(found ? found[0] : 'custom');
      }
    });
  }, []);

  // 切换厂商时自动填充
  function handlePresetChange(key: string) {
    setPreset(key);
    const p = PRESETS[key];
    setModel(p.model ?? '');
    setBaseURL(p.baseURL ?? '');
  }

  function currentConfig(): LLMConfig {
    return {
      provider: PRESETS[preset].provider as LLMConfig['provider'],
      apiKey: apiKey.trim(),
      model: model.trim(),
      baseURL: baseURL.trim() || undefined,
    };
  }

  async function handleSave() {
    if (!apiKey.trim()) { setStatus('⚠️ 请填写 API Key'); return; }
    if (!model.trim()) { setStatus('⚠️ 请填写模型名'); return; }
    await browser.storage.local.set({ llmConfig: currentConfig() });
    setStatus('✅ 已保存');
    setTimeout(() => setStatus(''), 2000);
  }

  // 发一条最简单的测试消息，验证配置可用
  async function handleTest() {
    setTesting(true);
    setStatus('测试中…');
    try {
      await browser.storage.local.set({ llmConfig: currentConfig() });
      const res = await browser.runtime.sendMessage({
        type: 'llm-chat',
        messages: [{ role: 'user', content: '回复“连接成功”四个字' }],
      });
      setStatus(res?.ok ? `✅ 测试成功：${res.text}` : `❌ 失败：${res?.error}`);
    } catch (e: any) {
      setStatus(`❌ 失败：${e.message ?? String(e)}`);
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={wrap}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Prompt Copilot 设置</h1>
      <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
        配置仅保存在本地浏览器，不会上传。
      </p>

      <label style={label}>选择模型厂商</label>
      <select value={preset} onChange={(e) => handlePresetChange(e.target.value)} style={input}>
        {Object.entries(PRESETS).map(([k, p]) => (
          <option key={k} value={k}>{p.label}</option>
        ))}
      </select>

      <label style={label}>API Key</label>
      <input
        type="password"
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="粘贴你的 API Key"
        style={input}
      />

      <label style={label}>模型名</label>
      <input value={model} onChange={(e) => setModel(e.target.value)} style={input} />

      <label style={label}>接口地址 (baseURL)</label>
      <input
        value={baseURL}
        onChange={(e) => setBaseURL(e.target.value)}
        placeholder="Claude 可留空"
        style={input}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button onClick={handleSave} style={saveBtn}>保存</button>
        <button onClick={handleTest} disabled={testing} style={testBtn}>
          {testing ? '测试中…' : '测试连接'}
        </button>
      </div>

      {status && <p style={{ marginTop: 12, fontSize: 14 }}>{status}</p>}
    </div>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 480, margin: '40px auto', padding: 24,
  fontFamily: 'system-ui, sans-serif', color: '#222',
};
const label: React.CSSProperties = {
  display: 'block', marginTop: 16, marginBottom: 4, fontSize: 13, fontWeight: 600,
};
const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 14,
  border: '1px solid #ccc', borderRadius: 8, boxSizing: 'border-box',
};
const saveBtn: React.CSSProperties = {
  padding: '8px 20px', background: '#10a37f', color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
};
const testBtn: React.CSSProperties = {
  padding: '8px 20px', background: '#6b4ce6', color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14,
};