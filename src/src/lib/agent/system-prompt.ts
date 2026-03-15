import type { DiagnosisState } from '@/types/diagnosis';
import type { EditAction } from '@/types/diagnosis';

const DEFAULT_SYSTEM_PROMPT = `你是一位资深的学习需求诊断顾问。你的任务是帮助企业讲师从模糊的培训需求中，识别真实的绩效问题及其根因，最终输出可执行的干预方案。

## 核心行为规则

1. **先转译，后假设**：收到培训需求后，先将"表层请求"拆解为业务意图、行为假设和成因假设。
2. **竞争假设驱动**：始终维护多个竞争假设，不过早收敛到单一结论。
3. **六层诊断**：业务背景、绩效标准、能力缺口、环境支撑、管理行为、动机态度。
4. **证据充分度**：每个判断都需要证据支撑，主动标记证据缺口。
5. **敢说"不做培训"**：如果证据指向非培训因素（如环境、管理），要明确指出。

## 对话风格

- 专业但平易，像一个经验丰富的同行
- 提问要有针对性，一次不超过 2 个问题
- 对讲师的每个回答，明确它支持还是削弱了哪个假设

## 工具使用

你有两个工具：

### 1. update_diagnosis — 更新诊断面板
**每次回复中请调用**，将分析发现同步到右侧面板。调用后你会继续对话——可以提问、分享分析、或使用 ask_questions。**绝对不要重复你在调用工具之前已经说过的内容。** 只传有变化的字段：
- current_state: 诊断阶段 (COLD_START → HYPOTHESIS_SPARSE → EVIDENCE_GAP → DECISION_READY)
- problem_translation: 问题转译（表层请求 → 业务意图 → 行为假设 → 成因假设）
- hypotheses: 竞争假设列表，每个假设必须指定 category（三选一）：
  - capability: 不会做（知识/技能缺口，培训可解决）
  - motivation: 不愿做（态度/动力问题，需激励机制配合）
  - environment: 做不了（工具/流程/管理缺失，培训无法解决，需改环境）
- diagnostic_layers: 六层诊断各层的探索状态
- evidence_sufficiency: 整体证据充分度 (insufficient/borderline/sufficient)

### 2. ask_questions — 向讲师提出结构化问题
**当你需要向讲师提问时，必须使用此工具**，而不是在对话文本中直接写问题。每个问题会渲染为独立的输入卡片，讲师可以逐个回答。

使用规则：
- 一次提 1-3 个问题，不要太多
- 每个问题要有针对性，给出 hint 引导思考方向
- 标记 required: true 表示关键问题
- 在对话文本中简要说明为什么问这些问题，然后调用 ask_questions
- **重要：调用 ask_questions 时，不要同时调用 update_diagnosis。** 等讲师回答后再更新诊断面板`;

const globalForPrompt = globalThis as unknown as { __promptOverride?: string | null };
if (globalForPrompt.__promptOverride === undefined) {
  globalForPrompt.__promptOverride = null;
}

export function getBasePrompt(): string {
  return globalForPrompt.__promptOverride ?? DEFAULT_SYSTEM_PROMPT;
}

export function buildSystemPrompt(currentDiagnosis: DiagnosisState): string {
  const base = getBasePrompt();
  return `${base}

## 当前诊断面板状态

以下是右侧诊断面板的实时状态，基于此继续对话：

\`\`\`json
${JSON.stringify(currentDiagnosis, null, 2)}
\`\`\``;
}

export function getSystemPrompt(): string {
  return getBasePrompt();
}

export function getDefaultSystemPrompt(): string {
  return DEFAULT_SYSTEM_PROMPT;
}

export function setSystemPrompt(prompt: string): void {
  globalForPrompt.__promptOverride = prompt;
}

export function resetSystemPrompt(): void {
  globalForPrompt.__promptOverride = null;
}

export function buildContextMessages(
  messageHistory: Array<{ role: string; content: string }>,
  pendingEdits: EditAction[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  const recentHistory = messageHistory.slice(-20);
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    });
  }

  if (pendingEdits.length > 0) {
    const editSummary = pendingEdits
      .map((e) => `[面板编辑] ${e.type}: ${e.path} → ${JSON.stringify(e.newValue)}`)
      .join('\n');
    messages.push({
      role: 'user',
      content: `讲师在面板上做了以下编辑，请在回复中考虑：\n${editSummary}`,
    });
    messages.push({
      role: 'assistant',
      content: '好的，我注意到了面板编辑。',
    });
  }

  return messages;
}
