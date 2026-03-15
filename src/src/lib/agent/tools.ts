export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const LAYER_NAMES = [
  'business_context',
  'performance_standard',
  'capability_gap',
  'environment_support',
  'management_behavior',
  'motivation_attitude',
] as const;

const evidenceSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, description: '证据唯一ID，如 E1, E2' },
    content: { type: 'string' as const, description: '证据内容' },
    source: { type: 'string' as const, description: '证据来源，如"对话""观察"' },
  },
  required: ['id', 'content', 'source'],
};

const hypothesisSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const, description: '假设ID，如 H1, H2' },
    content: { type: 'string' as const, description: '假设内容描述' },
    category: {
      type: 'string' as const,
      enum: ['capability', 'motivation', 'environment'],
      description: '假设归类：capability=不会做（培训可解决），motivation=不愿做（需激励机制），environment=做不了（需改环境/管理/工具）',
    },
    confidence: {
      type: 'string' as const,
      enum: ['low', 'medium', 'high'],
      description: '置信度',
    },
    supporting_evidence: { type: 'array' as const, items: evidenceSchema, description: '支持证据' },
    contradicting_evidence: { type: 'array' as const, items: evidenceSchema, description: '反面证据' },
    status: {
      type: 'string' as const,
      enum: ['active', 'strengthened', 'weakened', 'eliminated'],
      description: '假设状态',
    },
  },
  required: ['id', 'content', 'category', 'confidence', 'status'],
};

const layerStateSchema = {
  type: 'object' as const,
  properties: {
    status: {
      type: 'string' as const,
      enum: ['blank', 'exploring', 'partial', 'sufficient'],
    },
    summary: { type: ['string', 'null'] as const, description: '该层摘要' },
    evidence_sources: { type: 'array' as const, items: { type: 'string' as const } },
  },
  required: ['status'],
};

const diagnosticLayersProperties = Object.fromEntries(
  LAYER_NAMES.map((name) => [name, layerStateSchema])
);

const criticalMomentSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    role: { type: 'string' as const, description: '关键角色' },
    moment: { type: 'string' as const, description: '关键时刻' },
    desired_behavior: { type: 'string' as const, description: '理想行为' },
    friction: { type: 'string' as const, description: '当前阻力' },
  },
  required: ['id', 'role', 'moment', 'desired_behavior', 'friction'],
};

const interventionSchema = {
  type: 'object' as const,
  properties: {
    id: { type: 'string' as const },
    title: { type: 'string' as const },
    description: { type: 'string' as const },
    conditions: { type: 'string' as const, description: '适用条件' },
    risks: { type: 'string' as const, description: '风险' },
    evaluation_approach: { type: 'string' as const, description: '评估方式' },
    is_no_training: { type: 'boolean' as const, description: '是否建议不做培训' },
  },
  required: ['id', 'title', 'description'],
};

export const UPDATE_DIAGNOSIS_TOOL: ToolDefinition = {
  name: 'update_diagnosis',
  description: `更新诊断面板的结构化状态。每轮对话后请调用此工具，将你的分析发现同步到诊断面板。
所有字段均为可选——只传递本轮有变化的字段即可。`,
  input_schema: {
    type: 'object' as const,
    properties: {
      current_state: {
        type: 'string',
        enum: ['COLD_START', 'HYPOTHESIS_SPARSE', 'EVIDENCE_GAP', 'EVIDENCE_CONFLICT', 'DECISION_READY', 'USER_EXPLORING'],
        description: '当前诊断阶段',
      },
      problem_translation: {
        type: 'object',
        properties: {
          surface_request: { type: ['string', 'null'], description: '表层培训请求' },
          business_intent: { type: ['string', 'null'], description: '背后的业务意图' },
          behavioral_hypothesis: { type: ['string', 'null'], description: '行为假设' },
          causal_hypothesis: { type: ['string', 'null'], description: '成因假设' },
          narrative_bias_warning: { type: ['string', 'null'], description: '叙事偏差风险提醒' },
        },
        description: '问题转译四要素',
      },
      hypotheses: {
        type: 'array',
        items: hypothesisSchema,
        description: '竞争假设列表（完整替换）',
      },
      diagnostic_layers: {
        type: 'object',
        properties: diagnosticLayersProperties,
        description: '六层诊断结构',
      },
      critical_moments: {
        type: 'array',
        items: criticalMomentSchema,
        description: '关键时刻列表',
      },
      evidence_sufficiency: {
        type: 'string',
        enum: ['insufficient', 'borderline', 'sufficient'],
        description: '整体证据充分度',
      },
      biggest_evidence_gap: { type: ['string', 'null'], description: '最大的证据缺口' },
      suggested_next_action: { type: ['string', 'null'], description: '建议的下一步行动' },
      evaluation_anchors: {
        type: 'object',
        properties: {
          behavioral_indicators: { type: 'array', items: { type: 'string' }, description: '行为指标' },
          measurement_approach: { type: ['string', 'null'] },
          baseline_description: { type: ['string', 'null'] },
        },
        description: '评估锚点',
      },
      intervention_recommendations: {
        type: 'array',
        items: interventionSchema,
        description: '干预建议列表',
      },
    },
  },
};

export const ASK_QUESTIONS_TOOL: ToolDefinition = {
  name: 'ask_questions',
  description: `向讲师提出结构化问题以收集诊断所需的信息。每个问题会渲染为独立的输入卡片，讲师可以逐个回答、确认或跳过。
当你需要向讲师提问时，请使用此工具而不是在对话文本中直接提问。`,
  input_schema: {
    type: 'object' as const,
    properties: {
      context: {
        type: 'string',
        description: '简短说明为什么问这些问题（1-2句）',
      },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: '问题ID，如 Q1, Q2' },
            question: { type: 'string', description: '问题内容' },
            hint: { type: 'string', description: '输入提示，引导用户思考方向' },
            required: { type: 'boolean', description: '是否必填' },
          },
          required: ['id', 'question'],
        },
        description: '问题列表，建议 1-3 个',
      },
    },
    required: ['questions'],
  },
};

export const AGENT_TOOLS: ToolDefinition[] = [UPDATE_DIAGNOSIS_TOOL, ASK_QUESTIONS_TOOL];
