import type { LLMMessage } from '@/src/llm/types';
import type { Profile, ConversationContext } from '@/src/storage/memory';

export interface Question {
  id: string;
  question: string;
  type: 'single' | 'multi';
  options: string[];
}

// 把画像+背景拼成一段"记忆上下文"文字
export function buildMemoryContext(
  profile: Profile,
  ctx: ConversationContext | null
): string {
  const parts: string[] = [];
  if (profile.identity || profile.domain || profile.preferences) {
    parts.push(
      `【用户画像】身份：${profile.identity || '未知'}；认知水平：${profile.domain || '未知'}；提问偏好：${profile.preferences || '未知'}`
    );
  }
  if (ctx) {
    parts.push(
      `【当前项目背景】名称：${ctx.name}；核心需求：${ctx.background || '无'}；环境：${ctx.environment || '无'}；进度：${ctx.progress || '无'}`
    );
  }
  return parts.join('\n');
}

// 第一步：生成问题
export function buildQuestionMessages(
  convo: string,
  draft: string,
  memory: string
): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `你是一个帮助用户优化提问的助手。结合用户画像、项目背景、已有对话、以及用户当前正在输入但还没发送的内容，提出2-4个简短问题，帮助用户明确需求。
请重点结合"用户当前输入"和"项目背景"。已知的信息不要再问。
每个问题给2-4个候选选项。

【严格输出要求】只输出一个合法 JSON 对象，不要任何解释、不要markdown代码块。
- 所有字符串用英文双引号
- 数组和对象的元素之间必须有英文逗号
- 选项文字里不要出现双引号
格式严格如下（注意逗号）：
{"questions":[{"id":"q1","question":"问题文字","type":"single","options":["选项A","选项B"]},{"id":"q2","question":"问题文字","type":"multi","options":["选项A","选项B"]}]}
type 只能是 "single" 或 "multi"。`,
    },
    {
      role: 'user',
      content: `${memory || '（暂无画像和背景）'}\n\n已有对话：\n${convo || '（无）'}\n\n用户当前正在输入：\n${draft || '（空）'}`,
    },
  ];
}

// 第二步：组装最终 prompt
export function buildFinalPromptMessages(
  convo: string,
  draft: string,
  memory: string,
  answers: { question: string; selected: string[]; note: string }[]
): LLMMessage[] {
  const answerText = answers
    .map((a) => {
      const parts = [];
      if (a.selected.length) parts.push(a.selected.join('、'));
      if (a.note.trim()) parts.push(`补充：${a.note.trim()}`);
      return `- ${a.question}：${parts.join('；') || '（未作答）'}`;
    })
    .join('\n');

  return [
    {
      role: 'system',
      content: `你是一个提示词工程专家，帮用户把"当前想说的话"打磨成更有效的提问。

核心原则：
1. 以"用户当前输入"和"最近对话"为主体，生成的提问要像对话的自然延续，连贯流畅。
2. 背景信息只在能让提问更精准时少量补充，不要罗列、不要把所有背景都堆进去。
3. 不要重复 AI 已经知道的信息。
4. 输出简洁自然，像一个准备充分的人在追问，而不是信息清单。

【联网搜索处理】如果用户的回答中表示需要联网搜索，请在生成的提问里：
- 要求 AI 基于最新的联网搜索结果回答，并注明信息来源和时间。
- 根据问题主题，建议最权威对口的信息来源"类型或机构名称"。例如：政策法规→建议查国家政务服务平台或对应部委官网；学校招生→建议查目标学校官网、教育部官网；医疗健康→建议查国家卫健委或权威医院官网；产品价格→建议查品牌官网或官方旗舰店。
- ⚠️ 只建议来源的名称/类型，绝不要编造具体网址链接（避免给出错误链接）。让用户自行搜索该机构名。
如果用户不需要联网搜索，不要加入以上内容。

只返回这段提问本身，不要解释、不要前后缀。用中文。`,
    },
    {
      role: 'user',
      content: `${memory || '（暂无画像和背景）'}\n\n对话背景：\n${convo || '（无）'}\n\n用户当前正在输入：\n${draft || '（空）'}\n\n用户对各问题的回答：\n${answerText}\n\n请生成最终prompt。`,
    },
  ];
}

// 高频：只提炼当前对话背景（每次都调）
export function buildContextExtractMessages(
  convo: string,
  draft: string,
  oldContext: ConversationContext | null
): LLMMessage[] {
  const oldText = oldContext
    ? `核心需求：${oldContext.background || '无'}；客观环境：${oldContext.environment || '无'}；项目进展：${oldContext.progress || '无'}`
    : '（无）';
  return [
    {
      role: 'system',
      content: `你是记忆管理助手，只负责维护"当前项目的对话背景"。收到【已有背景】和【新对话】，智能合并，输出更新后的背景。
只记录这个项目/任务的客观事实：
- background：核心需求、要做什么
- environment：客观环境，如电脑配置、技术栈
- progress：项目进展
合并规则：新信息覆盖旧的、未提到的保留、蒸馏掉寒暄冗余、不臆测。
【严格输出】只输出合法 JSON，英文双引号和逗号，无markdown：
{"background":"","environment":"","progress":""}
输出合并后的完整内容，无信息则空字符串。`,
    },
    {
      role: 'user',
      content: `【已有背景】${oldText}\n\n【新对话】\n${convo || '（无）'}\n\n用户当前输入：\n${draft || '（空）'}`,
    },
  ];
}

// 低频：每积累若干次对话才提炼一次用户画像（稳定基本信息）
export function buildProfileExtractMessages(
  recentConvos: string,
  oldProfile: Profile
): LLMMessage[] {
  const oldText = `身份：${oldProfile.identity || '无'}；认知水平：${oldProfile.domain || '无'}；提问偏好：${oldProfile.preferences || '无'}`;
  return [
    {
      role: 'system',
      content: `你是用户画像管理助手。基于用户最近多次对话，提炼"稳定、概括、长期"的基本信息。收到【已有画像】和【最近多次对话】，输出更新后的画像。
画像只记录稳定基本信息，绝不记录具体项目：
- identity：身份基本信息，如"22岁计算机专业学生"
- domain：长期认知水平，如"熟悉编程""非技术背景需通俗解释"
- preferences：稳定的沟通偏好，如"喜欢直接结论"

【更新规则·重要】：
- 如果对话中出现更具体或更新的事实，要用它覆盖旧信息。例如旧画像是"18-25岁"，对话中用户说"我22岁"，则更新为"22岁"。
- 旧画像中对话未涉及的部分，保持不变。
- 只在确实有更准确信息时才改，不要凭空臆测。
⚠️ 严禁写入具体项目、技术名词、临时需求。只保留换个项目也成立的概括信息。
【严格输出】只输出合法 JSON，英文双引号和逗号，无markdown：
{"identity":"","domain":"","preferences":""}
输出合并后的完整内容，无信息则空字符串。`,
    },
    {
      role: 'user',
      content: `【已有画像】${oldText}\n\n【最近多次对话】\n${recentConvos || '（无）'}`,
    },
  ];
}

// 给对话背景起一个概括的名字
export function buildNameContextMessages(convo: string, draft: string): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `根据对话内容，给这个对话起一个简短的名字（不超过12个字），概括主题。只返回名字本身，不要引号、不要解释。`,
    },
    {
      role: 'user',
      content: `${draft || ''}\n${convo || ''}`.slice(0, 1000),
    },
  ];
}

// 生成"对话接力摘要"——把当前对话打包成交接说明，供新对话/新LLM接手
export function buildHandoffMessages(
  convo: string,
  ctx: ConversationContext | null
): LLMMessage[] {
  const ctxText = ctx
    ? `项目：${ctx.name}；核心需求：${ctx.background || '无'}；环境：${ctx.environment || '无'}；进展：${ctx.progress || '无'}`
    : '（无背景）';
  return [
    {
      role: 'system',
      content: `你是对话交接助手。用户要把当前对话转移到一个新的对话或另一个AI继续，但新AI不知道之前聊了什么。请把当前对话和背景，整理成一份清晰的"交接说明"，让接手的AI能立刻进入状态、无缝继续。

交接说明应包含（用自然段落，不要用JSON）：
1. 我们在做什么（任务目标）
2. 已经确定/完成了什么
3. 目前进行到哪一步
4. 接下来要继续做什么
5. 关键的事实、技术细节、约束（如配置、技术栈、已有决定）

写成第一人称、可直接发给新AI的开场白，开头类似"我们正在继续一个之前的任务……"。简洁但不遗漏关键信息。只返回这段交接说明本身。`,
    },
    {
      role: 'user',
      content: `【背景】${ctxText}\n\n【完整对话】\n${convo || '（无）'}`,
    },
  ];
}

// 容错解析问题 JSON
export function parseQuestions(raw: string): Question[] {
  const data = parseJSON(raw);
  if (!Array.isArray(data.questions)) throw new Error('返回格式不含 questions');
  return data.questions;
}

// 容错解析提炼结果
export function parseExtract(raw: string): {
  profile: Partial<Profile>;
  context: Partial<ConversationContext>;
} {
  const data = parseJSON(raw);
  return { profile: data.profile ?? {}, context: data.context ?? {} };
}

export function parseContextExtract(raw: string): Partial<ConversationContext> {
  return parseJSON(raw);
}

export function parseProfileExtract(raw: string): Partial<Profile> {
  return parseJSON(raw);
}

// 通用 JSON 容错解析
function parseJSON(raw: string): any {
  let text = raw.trim();
  // 去掉 markdown 代码块包裹
  text = text.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  // 截取第一个 { 到最后一个 }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1) text = text.slice(start, end + 1);

  try {
    return JSON.parse(text);
  } catch {
    // 解析失败时打印原文，方便诊断
    console.error('[PromptCopilot] JSON 解析失败，原始返回：', text);
    // 尝试修复常见问题：去掉尾随逗号（如 ],} 或 ,]）
    const fixed = text.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(fixed);
  }
}