# 技术方案：Learning Diagnosis 需求诊断模块

> **关联文档**：
> - `prompts/PRD-learning-diagnosis.md`（产品需求文档）
> - `prompts/learning-diagnosis-agent.md`（Agent System Prompt）
> **版本**：v0.1 Draft
> **日期**：2026-03-15

---

## 一、整体架构

### 1.1 架构总览

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器 (Client)                       │
│                                                             │
│  ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐  │
│  │ 对话面板     │   │  诊断结构面板 │   │ 快照/历史管理   │  │
│  │ Conversation │◄─►│  Diagnostic  │   │ Snapshot        │  │
│  │ Panel        │   │  Panel       │   │ Manager         │  │
│  └──────┬───────┘   └──────┬───────┘   └────────┬────────┘  │
│         │                  │                     │           │
│  ┌──────┴──────────────────┴─────────────────────┴────────┐  │
│  │              Zustand Store (客户端状态中心)               │  │
│  │  conversationStore | diagnosisStore | snapshotStore     │  │
│  └────────────────────────────┬───────────────────────────┘  │
│                               │                              │
└───────────────────────────────┼──────────────────────────────┘
                                │ HTTP / SSE
┌───────────────────────────────┼──────────────────────────────┐
│                          服务端 (Server)                      │
│                               │                              │
│  ┌────────────────────────────┴───────────────────────────┐  │
│  │                    API Layer (Next.js Routes)           │  │
│  │  /api/projects  /api/messages  /api/diagnosis  /api/…  │  │
│  └──────┬──────────────┬──────────────────┬───────────────┘  │
│         │              │                  │                   │
│  ┌──────┴──────┐ ┌─────┴──────────┐ ┌────┴───────────────┐  │
│  │  Project    │ │  Agent         │ │  Snapshot          │  │
│  │  Service    │ │  Orchestrator  │ │  Service           │  │
│  │             │ │                │ │                    │  │
│  │  CRUD       │ │  上下文组装     │ │  快照存储/恢复     │  │
│  │  导出       │ │  流式调用       │ │  Diff 计算        │  │
│  │             │ │  响应解析       │ │                    │  │
│  └──────┬──────┘ └────────┬───────┘ └────────┬───────────┘  │
│         │                 │                   │              │
│  ┌──────┴─────────────────┴───────────────────┴───────────┐  │
│  │                    PostgreSQL                           │  │
│  │  projects | sessions | messages | diagnosis_states     │  │
│  │  snapshots                                             │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│                    ┌──────────────┐                           │
│                    │  Claude API  │                           │
│                    │  (Messages)  │                           │
│                    └──────────────┘                           │
└──────────────────────────────────────────────────────────────┘
```

### 1.2 核心设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 前端框架 | **Next.js 14+ (App Router)** | SSR/SSE 原生支持；API Routes 免独立后端；React 生态成熟 |
| 状态管理 | **Zustand** | 轻量、无 boilerplate；处理深层嵌套 JSON（诊断结构）比 Redux 自然；支持 middleware（用于快照） |
| UI 组件 | **Tailwind CSS + shadcn/ui** | 高度可定制；不引入重型组件库；shadcn/ui 的 Dialog、Popover、Tooltip 等可直接用于面板交互 |
| 数据库 | **PostgreSQL** | 结构化数据（项目、消息、快照）适合关系型；JSONB 字段存诊断状态，兼顾灵活性和可查询性 |
| ORM | **Prisma** | 类型安全；与 TypeScript 无缝；migration 管理清晰 |
| AI 集成 | **Claude API (Messages API) 直调** | 不需要 Agent SDK 的内置工具（无文件/终端/网页需求）；直调更灵活，可精细控制 streaming 和 context |
| 流式传输 | **Server-Sent Events (SSE)** | 单向流（服务端→客户端）足够；比 WebSocket 简单；Next.js Route Handlers 原生支持 |
| 部署 | **Vercel + Supabase (PostgreSQL)** | P0 阶段零运维；Vercel 对 Next.js 优化最佳；Supabase 提供托管 PostgreSQL |

---

## 二、前端架构

### 2.1 页面结构

```
app/
├── layout.tsx                    # 全局 layout
├── page.tsx                      # 首页（项目列表）
├── projects/
│   ├── page.tsx                  # 项目列表页
│   └── [projectId]/
│       └── page.tsx              # 诊断工作台（核心页面）
├── api/
│   ├── projects/
│   │   ├── route.ts              # POST: 创建项目 / GET: 列表
│   │   └── [projectId]/
│   │       ├── route.ts          # GET: 项目详情 / PATCH: 更新
│   │       ├── messages/
│   │       │   └── route.ts      # POST: 发消息（SSE 流式响应）
│   │       ├── diagnosis/
│   │       │   └── route.ts      # PATCH: 面板编辑同步
│   │       ├── snapshots/
│   │       │   └── route.ts      # GET: 快照列表 / POST: 手动快照
│   │       └── export/
│   │           └── route.ts      # POST: 导出判决书
```

### 2.2 组件树

诊断工作台页面（核心页面）的组件层级：

```
<DiagnosisWorkspace>
│
├── <TopBar>
│   ├── <ProjectName editable />
│   ├── <EvidenceSufficiencyIndicator status="red|yellow|green" />
│   └── <SnapshotTimeline />                    # P1
│
├── <ResizablePanelGroup>                        # 可拖拽分隔线
│   │
│   ├── <ConversationPanel>                      # 左面板
│   │   ├── <MessageList>
│   │   │   ├── <UserMessage />
│   │   │   ├── <AgentMessage streaming? />
│   │   │   └── <SystemMessage />                # 面板编辑通知
│   │   └── <MessageInput>
│   │       ├── <TextArea autoResize />
│   │       ├── <PasteHandler />
│   │       └── <FileUploadButton />             # P2
│   │
│   └── <DiagnosticPanel>                        # 右面板
│       ├── <PanelEmptyState />                  # 冷启动占位
│       │
│       ├── <ProblemTranslationCard>             # 区块 A
│       │   ├── <EditableField label="表层请求" />
│       │   ├── <EditableField label="业务意图" />
│       │   ├── <EditableField label="行为假设" />
│       │   ├── <EditableField label="成因假设" />
│       │   └── <NarrativeBiasWarning />
│       │
│       ├── <HypothesesBoard>                    # 区块 B
│       │   ├── <HypothesisCard>
│       │   │   ├── <EditableContent />
│       │   │   ├── <LayerBadge />
│       │   │   ├── <ConfidenceSlider />
│       │   │   ├── <EvidenceList type="supporting" />
│       │   │   ├── <EvidenceList type="contradicting" />
│       │   │   ├── <StatusToggle />
│       │   │   └── <HypothesisActions>          # hover 菜单
│       │   │       ├── "深入追问"
│       │   │       ├── "寻找反面证据"
│       │   │       └── "排除此假设"
│       │   └── <AddHypothesisButton />
│       │
│       ├── <DiagnosticLayers>                   # 区块 C
│       │   └── <LayerAccordion layer="business|...">
│       │       ├── <LayerStatusBar />
│       │       ├── <EditableSummary />
│       │       ├── <EvidenceSources />
│       │       └── <LayerActions>
│       │           └── "深入追问此层"
│       │
│       ├── <CriticalMoments>                    # 区块 D (P1)
│       │   └── <MomentCard>
│       │       ├── <EditableField label="角色" />
│       │       ├── <EditableField label="时刻" />
│       │       ├── <EditableField label="理想行为" />
│       │       └── <EditableField label="当前阻力" />
│       │
│       ├── <EvaluationAnchors>                  # 区块 E (P1)
│       │
│       └── <InterventionRecommendations>        # 区块 F (P1)
│           └── <InterventionCard>
│               └── <SelectButton />
```

### 2.3 状态管理

三个核心 Store，通过 Zustand 管理：

#### conversationStore

```typescript
interface ConversationStore {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;

  addUserMessage: (content: string) => void;
  startStreaming: () => void;
  appendStreamChunk: (chunk: string) => void;
  finalizeAgentMessage: (content: string, diagnosisUpdate: DiagnosisUpdate | null) => void;
  addSystemMessage: (content: string) => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  diagnosisUpdate?: DiagnosisUpdate; // agent 消息才有
}
```

#### diagnosisStore

```typescript
interface DiagnosisStore {
  state: DiagnosisState;               // 完整的诊断结构 JSON
  visibleSections: Set<string>;        // 当前可见的面板区块（渐进生长）
  dirtyFields: Map<string, any>;       // 用户编辑过但 Agent 还未确认的字段

  // Agent 驱动的更新
  applyAgentUpdate: (update: DiagnosisUpdate) => ConflictResult[];

  // 用户编辑
  updateField: (path: string, value: any) => void;
  addHypothesis: (hypothesis: Hypothesis) => void;
  updateHypothesisStatus: (id: string, status: HypothesisStatus) => void;
  updateConfidence: (id: string, confidence: ConfidenceLevel) => void;
  addEvidence: (hypothesisId: string, type: 'supporting'|'contradicting', evidence: Evidence) => void;
  addCriticalMoment: (moment: CriticalMoment) => void;

  // 编辑分类
  classifyEdit: (editAction: EditAction) => 'lightweight' | 'directional';
}

interface DiagnosisState {
  current_state: DiagnosticState;
  problem_translation: ProblemTranslation;
  hypotheses: Hypothesis[];
  diagnostic_layers: Record<LayerName, LayerState>;
  critical_moments: CriticalMoment[];
  evidence_sufficiency: SufficiencyLevel;
  biggest_evidence_gap: string | null;
  suggested_next_action: string | null;
  evaluation_anchors: EvaluationAnchors;
  intervention_recommendations: InterventionRecommendation[];
}
```

#### snapshotStore

```typescript
interface SnapshotStore {
  snapshots: Snapshot[];
  previewingSnapshotId: string | null;

  captureSnapshot: (trigger: SnapshotTrigger, description?: string) => void;
  previewSnapshot: (id: string) => void;
  restoreSnapshot: (id: string) => void;
  exitPreview: () => void;
}

interface Snapshot {
  id: string;
  timestamp: number;
  trigger: 'agent_update' | 'user_edit' | 'manual' | 'restore';
  description: string;     // 自动生成的变更摘要
  stateJson: DiagnosisState;
}
```

### 2.4 面板渐进生长的实现

`visibleSections` 由 `diagnosisStore` 管理，根据 `DiagnosisState` 的内容自动计算：

```typescript
function computeVisibleSections(state: DiagnosisState): Set<string> {
  const sections = new Set<string>();

  // 问题转译：只要有任何字段非 null 就显示
  if (state.problem_translation.surface_request) {
    sections.add('problem_translation');
  }

  // 竞争假设：只要有任何假设就显示
  if (state.hypotheses.length > 0) {
    sections.add('hypotheses');
  }

  // 六层诊断板中的每一层：只要 status 不是 blank 就显示该层
  for (const [layer, data] of Object.entries(state.diagnostic_layers)) {
    if (data.status !== 'blank') {
      sections.add(`layer_${layer}`);
    }
  }
  // 只要有任何一层可见，显示整个诊断板容器
  const anyLayerVisible = Object.values(state.diagnostic_layers).some(d => d.status !== 'blank');
  if (anyLayerVisible) {
    sections.add('diagnostic_layers');
  }

  // 关键时刻：只要有条目就显示
  if (state.critical_moments.length > 0) {
    sections.add('critical_moments');
  }

  // 评估锚点：只要有任何指标就显示
  if (state.evaluation_anchors.behavioral_indicators.length > 0) {
    sections.add('evaluation_anchors');
  }

  // 干预建议：只在 DECISION_READY 且有建议时显示
  if (state.current_state === 'DECISION_READY' && state.intervention_recommendations.length > 0) {
    sections.add('intervention_recommendations');
  }

  // 全局充分度指示器：只要有至少 2 个假设就显示
  if (state.hypotheses.length >= 2) {
    sections.add('evidence_sufficiency_indicator');
  }

  return sections;
}
```

新区块出现时使用 CSS `@keyframes` 实现淡入+展开动画：

```css
@keyframes sectionAppear {
  from { opacity: 0; max-height: 0; transform: translateY(-8px); }
  to   { opacity: 1; max-height: 1000px; transform: translateY(0); }
}
.panel-section-enter {
  animation: sectionAppear 0.4s ease-out forwards;
}
```

### 2.5 面板编辑的分类逻辑

前端需要判断一次编辑是"轻量"还是"方向性"，以决定通知策略：

```typescript
function classifyEdit(action: EditAction): 'lightweight' | 'directional' {
  // 方向性编辑：改变了诊断方向或关键判断
  const directionalActions = [
    'hypothesis_status_change',     // 排除/恢复假设
    'hypothesis_delete',            // 删除假设
    'layer_status_change',          // 改变诊断层状态
    'critical_moment_delete',       // 删除关键时刻
    'evaluation_indicator_change',  // 修改核心行为指标
    'confidence_major_change',      // 置信度跨越两级以上（如 low→high）
  ];

  if (directionalActions.includes(action.type)) {
    return 'directional';
  }

  // 置信度微调（只跨一级）算轻量
  if (action.type === 'confidence_change' && Math.abs(action.delta) <= 1) {
    return 'lightweight';
  }

  // 其余都是轻量
  return 'lightweight';
}
```

---

## 三、后端架构

### 3.1 数据库 Schema (Prisma)

```prisma
model Project {
  id          String    @id @default(cuid())
  name        String
  status      String    @default("active")  // active | completed
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  sessions    Session[]
  diagnosis   DiagnosisRecord?
  snapshots   Snapshot[]
}

model Session {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id])
  startedAt   DateTime  @default(now())
  endedAt     DateTime?

  messages    Message[]
}

model Message {
  id                  String    @id @default(cuid())
  sessionId           String
  session             Session   @relation(fields: [sessionId], references: [id])
  role                String    // user | assistant | system
  content             String    // 自然语言内容
  diagnosisUpdateJson Json?     // Agent 消息附带的 diagnosis_update（原始 JSON 存档）
  createdAt           DateTime  @default(now())
}

model DiagnosisRecord {
  id          String    @id @default(cuid())
  projectId   String    @unique
  project     Project   @relation(fields: [projectId], references: [id])
  stateJson   Json      // 当前诊断状态（DiagnosisState 完整 JSON）
  version     Int       @default(1)
  updatedAt   DateTime  @updatedAt
}

model Snapshot {
  id          String    @id @default(cuid())
  projectId   String
  project     Project   @relation(fields: [projectId], references: [id])
  stateJson   Json      // 快照时刻的完整 DiagnosisState
  trigger     String    // agent_update | user_edit | manual | restore
  description String    // 自动生成的变更摘要
  createdAt   DateTime  @default(now())

  @@index([projectId, createdAt])
}
```

### 3.2 API 设计

#### POST `/api/projects`

创建诊断项目。

```typescript
// Request
{ name: string }

// Response
{ id: string, name: string, createdAt: string }
```

#### GET `/api/projects/[projectId]`

获取项目详情，包含当前诊断状态和最近一次会话的尾部消息。

```typescript
// Response
{
  project: Project,
  diagnosis: DiagnosisState,
  recentMessages: Message[],  // 最近 5 条
  snapshotCount: number
}
```

#### POST `/api/projects/[projectId]/messages`

发送消息并获取 Agent 流式响应。这是最核心的 API。

```typescript
// Request
{
  content: string,
  currentDiagnosis: DiagnosisState,  // 当前面板状态（含用户编辑）
  pendingEdits?: PanelEdit[]         // 自上次 Agent 回复以来的面板编辑
}

// Response: SSE Stream
// event: chunk
// data: {"type": "text", "content": "我先帮你拆..."}

// event: chunk
// data: {"type": "text", "content": "...一下这个需求。"}

// event: diagnosis_update
// data: {"type": "diagnosis_update", "data": { ...DiagnosisUpdate JSON... }}

// event: done
// data: {"type": "done", "messageId": "msg_xxx"}
```

#### PATCH `/api/projects/[projectId]/diagnosis`

面板编辑同步到数据库。

```typescript
// Request
{
  stateJson: DiagnosisState,
  editAction: EditAction,    // 用于生成快照描述
}

// Response
{ version: number, snapshotId?: string }
```

#### POST `/api/projects/[projectId]/export`

生成干预判决书。

```typescript
// Request
{ format: "markdown" | "pdf", selectedInterventionId?: string }

// Response
{ url: string } | { markdown: string }
```

---

## 四、Agent 集成层

这是整个系统最关键也最复杂的部分。

### 4.1 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                     Agent Orchestrator                        │
│                                                              │
│  ┌────────────┐  ┌────────────────┐  ┌────────────────────┐ │
│  │  Context    │  │  Claude API    │  │  Response          │ │
│  │  Assembler  │─►│  Caller        │─►│  Parser            │ │
│  │             │  │  (streaming)   │  │                    │ │
│  └────────────┘  └────────────────┘  └────────────────────┘ │
│        ▲                                       │             │
│        │              ┌────────────┐           │             │
│        └──────────────│  Context   │◄──────────┘             │
│                       │  Window    │                         │
│                       │  Manager   │                         │
│                       └────────────┘                         │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Context Assembler：上下文组装

每次调用 Claude API 前，需要组装完整的 messages 数组。组装规则：

```typescript
async function assembleContext(
  project: Project,
  currentDiagnosis: DiagnosisState,
  pendingEdits: PanelEdit[],
  newUserMessage: string,
  messageHistory: Message[]
): Promise<ClaudeMessage[]> {

  const messages: ClaudeMessage[] = [];

  // ──── 1. System Prompt ────
  // 从 learning-diagnosis-agent.md 加载，保持完整
  const systemPrompt = await loadSystemPrompt();

  // ──── 2. 当前诊断状态注入 ────
  // 作为对话开头的 context block，让 Agent 知道面板当前状态
  messages.push({
    role: 'user',
    content: `<current_diagnosis_state>\n${JSON.stringify(currentDiagnosis, null, 2)}\n</current_diagnosis_state>\n\n以上是当前诊断面板的状态。请基于此状态继续对话。`
  });
  messages.push({
    role: 'assistant',
    content: '我已了解当前诊断面板的状态，请继续。'
  });

  // ──── 3. 对话历史 ────
  // 使用 Context Window Manager 决定保留哪些消息
  const managedHistory = await contextWindowManager.manage(messageHistory);
  for (const msg of managedHistory) {
    messages.push({
      role: msg.role === 'system' ? 'user' : msg.role, // system → user（Claude API 约束）
      content: msg.content
    });
  }

  // ──── 4. 面板编辑通知（如果有）────
  if (pendingEdits.length > 0) {
    const editSummary = pendingEdits.map(e =>
      `[面板编辑] ${describeEdit(e)}`
    ).join('\n');
    messages.push({
      role: 'user',
      content: `<panel_edits>\n${editSummary}\n</panel_edits>\n\n讲师在面板上做了以上编辑。请在回复中考虑这些变化。`
    });
    messages.push({
      role: 'assistant',
      content: '我已注意到面板编辑，会在接下来的回复中考虑。'
    });
  }

  // ──── 5. 新用户消息 ────
  messages.push({
    role: 'user',
    content: newUserMessage
  });

  return { systemPrompt, messages };
}
```

### 4.3 Claude API 调用：流式处理

```typescript
async function* streamAgentResponse(
  systemPrompt: string,
  messages: ClaudeMessage[]
): AsyncGenerator<StreamEvent> {

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: messages,
    stream: true,
  });

  let fullText = '';

  for await (const event of response) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      const chunk = event.delta.text;
      fullText += chunk;

      // 检查是否进入了 <diagnosis_update> 区域
      // 如果还没进入，继续流式输出文本
      if (!fullText.includes('<diagnosis_update>')) {
        yield { type: 'text', content: chunk };
      }
      // 如果已经进入了 JSON 区域，不再流式输出（等完整 JSON）
    }
  }

  // 流结束后，解析完整响应
  const parsed = parseAgentResponse(fullText);

  if (parsed.diagnosisUpdate) {
    yield { type: 'diagnosis_update', data: parsed.diagnosisUpdate };
  }

  yield { type: 'done', fullText: parsed.conversationalText };
}
```

### 4.4 Response Parser：响应解析

Agent 的每轮回复包含两部分：自然语言 + `<diagnosis_update>` JSON。需要可靠地分离它们。

```typescript
interface ParsedResponse {
  conversationalText: string;
  diagnosisUpdate: DiagnosisUpdate | null;
}

function parseAgentResponse(fullText: string): ParsedResponse {
  const tagStart = '<diagnosis_update>';
  const tagEnd = '</diagnosis_update>';

  const startIdx = fullText.indexOf(tagStart);
  const endIdx = fullText.indexOf(tagEnd);

  if (startIdx === -1 || endIdx === -1) {
    // 没有 diagnosis_update（异常情况，但需容错）
    return {
      conversationalText: fullText.trim(),
      diagnosisUpdate: null,
    };
  }

  const conversationalText = fullText.substring(0, startIdx).trim();
  const jsonStr = fullText.substring(startIdx + tagStart.length, endIdx).trim();

  let diagnosisUpdate: DiagnosisUpdate | null = null;
  try {
    diagnosisUpdate = JSON.parse(jsonStr);
    // 用 Zod schema 验证
    diagnosisUpdate = DiagnosisUpdateSchema.parse(diagnosisUpdate);
  } catch (e) {
    console.error('Failed to parse diagnosis_update JSON:', e);
    // 降级：仍然返回对话文本，面板不更新
    diagnosisUpdate = null;
  }

  return { conversationalText, diagnosisUpdate };
}
```

### 4.5 Context Window Manager：上下文窗口管理

长对话会超出 Claude 的 context window（200K tokens）。需要管理策略：

```typescript
class ContextWindowManager {
  private readonly MAX_HISTORY_TOKENS = 80_000;
  // 系统 prompt ~5K, 诊断状态 ~3K, 保留 buffer for new message + response

  async manage(messages: Message[]): Promise<Message[]> {
    const tokenCount = estimateTokens(messages);

    if (tokenCount <= this.MAX_HISTORY_TOKENS) {
      return messages; // 全部保留
    }

    // 策略：保留最近 N 条完整消息 + 更早消息的摘要
    const recentCount = this.findRecentCountWithinBudget(messages, this.MAX_HISTORY_TOKENS * 0.7);
    const recentMessages = messages.slice(-recentCount);
    const olderMessages = messages.slice(0, -recentCount);

    // 对更早的消息生成摘要
    const summary = await this.summarize(olderMessages);

    return [
      {
        id: 'summary',
        role: 'user' as const,
        content: `<conversation_summary>\n${summary}\n</conversation_summary>\n\n以上是之前对话的摘要。`,
        timestamp: olderMessages[0]?.timestamp ?? Date.now(),
      },
      {
        id: 'summary_ack',
        role: 'assistant' as const,
        content: '我已了解之前的对话内容，请继续。',
        timestamp: olderMessages[0]?.timestamp ?? Date.now(),
      },
      ...recentMessages,
    ];
  }

  private async summarize(messages: Message[]): Promise<string> {
    // 用一次低成本 Claude 调用（Haiku）来压缩旧消息
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20250501',
      max_tokens: 1024,
      system: '你是一个对话摘要助手。请简洁但完整地摘要以下对话内容，保留所有关键的诊断发现、假设判断和用户决策。',
      messages: [{
        role: 'user',
        content: messages.map(m => `[${m.role}]: ${m.content}`).join('\n\n')
      }],
    });
    return response.content[0].text;
  }
}
```

### 4.6 方向性编辑的 Agent 主动回应

当前端判定一次面板编辑为"方向性"时，自动触发一次 Agent 调用：

```typescript
async function handleDirectionalEdit(
  projectId: string,
  edit: EditAction,
  currentDiagnosis: DiagnosisState
) {
  // 构造一条描述编辑内容的"伪用户消息"
  const editDescription = describeDirectionalEdit(edit);
  // 例如："[面板操作] 讲师将假设 H3（经理不做跟进检查）标记为已排除。"

  // 触发 Agent 回复
  const stream = streamAgentResponse(systemPrompt, [
    ...assembledContext,
    {
      role: 'user',
      content: `<panel_edit type="directional">\n${editDescription}\n</panel_edit>\n\n请评估这个变化对当前诊断方向的影响。`
    }
  ]);

  // 流式返回给前端
  return stream;
}
```

---

## 五、SSE 流式传输协议

### 5.1 前端 → 服务端

普通 POST 请求发送消息。

### 5.2 服务端 → 前端（SSE）

消息发送后，服务端返回一个 SSE 流：

```
POST /api/projects/{id}/messages
Content-Type: application/json
→ Response: text/event-stream

event: chunk
data: {"type":"text","content":"好的，"}

event: chunk
data: {"type":"text","content":"我来帮你拆一下这个需求。"}

event: chunk
data: {"type":"text","content":"目前看起来..."}

event: diagnosis_update
data: {"type":"diagnosis_update","data":{...完整 JSON...}}

event: done
data: {"type":"done","messageId":"msg_abc123"}
```

### 5.3 前端 SSE 消费

```typescript
async function sendMessage(projectId: string, content: string) {
  const { diagnosisStore, conversationStore } = useStores();

  // 1. 添加用户消息
  conversationStore.addUserMessage(content);
  conversationStore.startStreaming();

  // 2. 发起 SSE 请求
  const response = await fetch(`/api/projects/${projectId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content,
      currentDiagnosis: diagnosisStore.state,
      pendingEdits: diagnosisStore.flushPendingEdits(),
    }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const event = JSON.parse(line.slice(6));

        switch (event.type) {
          case 'text':
            conversationStore.appendStreamChunk(event.content);
            break;

          case 'diagnosis_update':
            // 先拍快照
            snapshotStore.captureSnapshot('agent_update', 'Agent 更新了诊断面板');
            // 应用更新并检测冲突
            const conflicts = diagnosisStore.applyAgentUpdate(event.data);
            if (conflicts.length > 0) {
              // 显示冲突提示
              showConflictDialog(conflicts);
            }
            break;

          case 'done':
            conversationStore.finalizeAgentMessage(event.messageId);
            break;
        }
      }
    }
  }
}
```

---

## 六、关键技术难点与解决策略

### 6.1 难点：流式输出中的 JSON 分离

**问题**：Agent 的回复是 `自然语言 + <diagnosis_update>JSON</diagnosis_update>` 混合体。在流式传输中，我们要在 JSON 还没完整之前就开始显示自然语言部分。但 `<diagnosis_update>` 标签可能出现在任何位置，且 JSON 可能很长。

**解决方案**：在服务端做分离——服务端消费 Claude 的 stream，实时检测标签，将文本部分立即作为 `text` 事件转发给前端，将 JSON 部分缓冲，解析成功后作为 `diagnosis_update` 事件一次性发送。

```
Claude stream → [服务端 parser] → text chunks → [SSE] → 前端渐显
                     ↓
               JSON buffer → 解析完成 → [SSE diagnosis_update] → 前端面板更新
```

这样前端不需要处理半截 JSON 的问题。

### 6.2 难点：面板编辑与 Agent 更新的竞态冲突

**问题**：讲师在等待 Agent 回复的几秒内编辑了面板。Agent 的回复带着基于旧面板状态的 `diagnosis_update`，可能覆盖讲师刚做的修改。

**解决方案**：脏字段追踪 + 冲突检测。

```typescript
// diagnosisStore 中
applyAgentUpdate(update: DiagnosisUpdate): ConflictResult[] {
  const conflicts: ConflictResult[] = [];

  for (const [path, newValue] of iterateFields(update)) {
    if (this.dirtyFields.has(path)) {
      // 用户编辑过这个字段
      const userValue = this.dirtyFields.get(path);
      if (!deepEqual(userValue, newValue)) {
        conflicts.push({
          path,
          userValue,
          agentValue: newValue,
        });
        // 暂时保留用户的值，等用户决定
        continue;
      }
    }
    // 无冲突，直接应用
    setNestedValue(this.state, path, newValue);
  }

  // 冲突字段不自动应用，由 UI 弹窗让用户选择
  return conflicts;
}
```

### 6.3 难点：快照存储效率

**问题**：每次 Agent 更新和用户编辑都触发快照。如果诊断状态 JSON 有 5KB，20 次快照就是 100KB，一个项目跑完可能有 50-100 个快照。

**解决方案**：P0 阶段直接存完整快照（总量可控，单项目 <1MB，PostgreSQL JSONB 完全承受得住）。P2 阶段如果需要优化，改为增量快照（只存 diff）。

```typescript
// P0：直接存完整 JSON
async function captureSnapshot(trigger: string, description: string) {
  const currentState = diagnosisStore.getState();
  await fetch(`/api/projects/${projectId}/snapshots`, {
    method: 'POST',
    body: JSON.stringify({
      stateJson: currentState,
      trigger,
      description,
    }),
  });
}
```

### 6.4 难点：跨会话恢复上下文

**问题**：讲师隔天回来，Agent 需要知道之前聊了什么。但之前的对话可能很长，直接塞进 context window 不现实。

**解决方案**：恢复时注入"诊断状态 + 对话摘要"而不是完整对话历史。

```typescript
async function resumeSession(projectId: string) {
  const project = await getProject(projectId);
  const diagnosis = project.diagnosis.stateJson;
  const recentMessages = await getRecentMessages(projectId, 5);

  // 组装恢复上下文
  const resumeContext = [
    {
      role: 'user',
      content: `<session_resume>
讲师回到了一个进行中的诊断项目。
当前诊断状态：
${JSON.stringify(diagnosis, null, 2)}

最近的对话：
${recentMessages.map(m => `[${m.role}]: ${m.content}`).join('\n')}
</session_resume>

请生成一条"欢迎回来"消息，简要提醒当前进展和下一步建议。`
    }
  ];

  return streamAgentResponse(systemPrompt, resumeContext);
}
```

### 6.5 难点：diagnosis_update JSON 可靠性

**问题**：LLM 输出的 JSON 不一定 100% 合法，可能有格式错误、字段缺失、类型不匹配。

**解决方案**：多层防御。

```
Agent 原始输出
    ↓
1. 正则提取 <diagnosis_update>...</diagnosis_update> 之间的内容
    ↓
2. JSON.parse()（失败 → 尝试修复常见错误如尾逗号、单引号）
    ↓
3. Zod schema 验证（字段类型、枚举值范围、必填字段）
    ↓
4. 降级策略：部分字段验证失败 → 只应用合法字段，忽略非法字段
    ↓
5. 全部失败 → 面板不更新，仅显示对话文本，日志记录异常
```

```typescript
const DiagnosisUpdateSchema = z.object({
  current_state: z.enum([
    'COLD_START', 'HYPOTHESIS_SPARSE', 'EVIDENCE_GAP',
    'EVIDENCE_CONFLICT', 'DECISION_READY', 'USER_EXPLORING'
  ]),
  problem_translation: z.object({
    surface_request: z.string().nullable(),
    business_intent: z.string().nullable(),
    behavior_hypothesis: z.string().nullable(),
    causal_assumption: z.string().nullable(),
    narrative_bias_warning: z.string().nullable(),
  }),
  hypotheses: z.array(z.object({
    id: z.string(),
    content: z.string(),
    layer: z.enum(['business','performance','capability','environment','management','motivation']),
    confidence: z.enum(['none','low','medium','high']),
    supporting_evidence: z.array(z.object({ text: z.string(), source: z.string() })),
    contradicting_evidence: z.array(z.object({ text: z.string(), source: z.string() })),
    status: z.enum(['active','supported','weakened','eliminated']),
  })),
  // ...其余字段
}).partial(); // partial() 允许字段缺失——降级时只应用有的字段
```

---

## 七、导出：干预判决书

### 7.1 生成流程

```
当前 DiagnosisState
       ↓
  模板渲染引擎 ──→ Markdown 文档
       ↓                ↓
  直接返回           Puppeteer/wkhtmltopdf ──→ PDF
```

### 7.2 Markdown 模板

```typescript
function generateInterventionMemo(state: DiagnosisState, selectedPlan?: string): string {
  return `
# 干预判决书

## 一、问题定义
**原始需求**：${state.problem_translation.surface_request}
**业务意图**：${state.problem_translation.business_intent}
**行为假设**：${state.problem_translation.behavior_hypothesis}

> ⚠️ ${state.problem_translation.narrative_bias_warning}

## 二、诊断发现

### 六层诊断结果
${Object.entries(state.diagnostic_layers)
  .filter(([_, v]) => v.status !== 'blank')
  .map(([k, v]) => `- **${LAYER_LABELS[k]}**（${STATUS_LABELS[v.status]}）：${v.summary || '待补充'}`)
  .join('\n')}

### 关键时刻
${state.critical_moments.map(cm =>
  `- **${cm.role}** 在 **${cm.moment}** 时需要 **${cm.desired_behavior}**，当前阻力：${cm.friction}`
).join('\n')}

## 三、假设与证据
${state.hypotheses.map(h => `
### ${h.id}: ${h.content}
- 层级：${LAYER_LABELS[h.layer]}
- 状态：${STATUS_LABELS[h.status]}
- 置信度：${CONFIDENCE_LABELS[h.confidence]}
- 支持证据：${h.supporting_evidence.map(e => e.text).join('；') || '暂无'}
- 反对证据：${h.contradicting_evidence.map(e => e.text).join('；') || '暂无'}
`).join('\n')}

## 四、干预建议
${state.intervention_recommendations.map(ir => `
### ${ir.title}${ir.is_no_training ? ' ⚠️' : ''}
${ir.description}
- **适用条件**：${ir.conditions}
- **风险**：${ir.risks}
- **评估方式**：${ir.evaluation_approach}
`).join('\n')}

## 五、评估方案
- **行为指标**：${state.evaluation_anchors.behavioral_indicators.map(i => i.text).join('；')}
- **当前基线**：${state.evaluation_anchors.baseline || '待确认'}
- **观察者**：${state.evaluation_anchors.observer || '待确认'}
- **观察时机**：${state.evaluation_anchors.observation_timing || '待确认'}

---
*本文档由 AGL Learning Diagnosis 生成，基于 ${new Date().toLocaleDateString('zh-CN')} 的诊断状态。*
`;
}
```

---

## 八、P0 实施计划

### 8.1 技术任务分解

按依赖关系排序，估算为单人开发工作量：

| 阶段 | 任务 | 预估工时 | 依赖 |
|------|------|---------|------|
| **基础设施** | | | |
| 1 | Next.js 项目初始化 + Tailwind + shadcn/ui 配置 | 2h | — |
| 2 | Prisma schema 定义 + Supabase PostgreSQL 配置 + migration | 3h | 1 |
| 3 | Claude API 集成 + 基础流式调用验证 | 3h | 1 |
| **后端核心** | | | |
| 4 | 项目 CRUD API | 2h | 2 |
| 5 | Agent Orchestrator：上下文组装 + 流式调用 + 响应解析 | 8h | 3 |
| 6 | 消息存储 + SSE 流式传输管道 | 4h | 4, 5 |
| 7 | 面板状态持久化 API (PATCH /diagnosis) | 2h | 2 |
| **前端核心** | | | |
| 8 | Zustand stores 骨架（conversation, diagnosis, snapshot） | 4h | — |
| 9 | 双面板布局 + 可拖拽分隔线 | 3h | 1 |
| 10 | 对话面板：消息列表 + 输入框 + 流式显示 | 6h | 8, 9 |
| 11 | 面板：问题转译卡（含可编辑字段） | 4h | 8, 9 |
| 12 | 面板：竞争假设区（卡片 + 置信度条 + 状态切换） | 8h | 8, 9 |
| 13 | 面板：六层诊断板（手风琴 + 状态条 + 可编辑摘要） | 6h | 8, 9 |
| 14 | 面板渐进生长逻辑 + 入场动画 | 3h | 11, 12, 13 |
| 15 | 全局证据充分度指示器 | 2h | 8 |
| **串联集成** | | | |
| 16 | 对话发送 → SSE 消费 → 面板更新 完整流程联调 | 6h | 6, 10, 14 |
| 17 | 面板编辑 → 系统消息通知 + 下次 Agent 调用注入 | 4h | 7, 16 |
| 18 | 编辑冲突检测（脏字段追踪 + 冲突提示） | 4h | 17 |
| 19 | 冷启动流程（空状态 → 首次输入 → Aha moment） | 3h | 16 |
| **导出** | | | |
| 20 | 干预判决书 Markdown 生成 + 导出 API | 3h | 7 |
| **测试与打磨** | | | |
| 21 | 端到端流程测试 + 边界情况处理 | 6h | 全部 |
| 22 | UI 细节打磨（动画、响应式、loading 状态） | 4h | 全部 |
| | | | |
| | **P0 总计** | **约 82h** | |

### 8.2 关键里程碑

| 里程碑 | 内容 | 预计完成 |
|--------|------|---------|
| M1: 骨架跑通 | 双面板布局 + 能发消息 + Agent 返回流式文本 | 第 1 周末 |
| M2: 面板联动 | Agent 回复能更新面板 + 面板渐进生长 | 第 2 周末 |
| M3: 编辑闭环 | 面板可编辑 + 编辑通知 + 冲突检测 | 第 3 周末 |
| M4: P0 完成 | 冷启动 + 导出 + 打磨 | 第 4 周末 |

### 8.3 技术风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Agent 输出的 JSON 格式不稳定 | 面板更新失败 | Zod 验证 + partial 降级 + System Prompt 中强调格式 |
| 长对话超出 context window | Agent 失去上下文 | Context Window Manager + 摘要压缩 |
| 流式解析中 `<diagnosis_update>` 被截断 | JSON 解析失败 | 服务端完整缓冲 JSON 区域后再发 |
| 面板状态与 Agent 认知不一致 | 对话和面板脱节 | 每次调用注入当前面板状态 |
| SSE 连接中断（网络不稳定） | 响应不完整 | 前端重连机制 + 消息去重 |

---

## 九、P1/P2 技术预留

P0 架构需要为后续功能做的预留：

| 未来功能 | P0 中的技术预留 |
|----------|---------------|
| 快照时间线 (P1) | Snapshot 表已建好；`snapshotStore` 骨架已有 |
| 追问菜单 (P1) | 面板编辑已走统一的 `EditAction` 模型，追问操作只是新增 action type |
| 方向性编辑主动回应 (P1) | `classifyEdit` 函数已实现；只需在 `directional` 时触发额外 Agent 调用 |
| 跨会话持久化 (P1) | Session 表和 DiagnosisRecord 表已建好；`resumeSession` 逻辑已设计 |
| 文件上传 (P2) | 输入区预留了 `FileUploadButton` 组件位；后端可加 S3/R2 存储层 |
| 多人协作 (P2+) | 数据库以 project 为中心（非 user 为中心）；后续可加权限模型 |
