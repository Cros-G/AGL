import type { DiagnosisState, LayerName, HypothesisCategory, HypothesisStatus, ConfidenceLevel, LayerStatus } from '@/types/diagnosis';

const CATEGORY_LABELS: Record<HypothesisCategory, string> = {
  capability: '能力问题（不会做）',
  motivation: '动机问题（不愿做）',
  environment: '环境问题（做不了）',
};

const LAYER_LABELS: Record<LayerName, string> = {
  business_context: '业务背景',
  performance_standard: '绩效标准',
  capability_gap: '能力缺口',
  environment_support: '环境支撑',
  management_behavior: '管理行为',
  motivation_attitude: '动机态度',
};

const STATUS_LABELS: Record<HypothesisStatus, string> = {
  active: '活跃',
  strengthened: '增强',
  weakened: '减弱',
  eliminated: '已排除',
};

const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

const LAYER_STATUS_LABELS: Record<LayerStatus, string> = {
  blank: '未探索',
  exploring: '探索中',
  partial: '部分',
  sufficient: '充分',
};

export function generateInterventionMemo(state: DiagnosisState, projectName?: string): string {
  const now = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  const title = projectName || '诊断项目';

  let md = `# 干预判决书 — ${title}\n\n`;
  md += `> 生成日期：${now}\n\n---\n\n`;

  // 一、问题定义
  md += `## 一、问题定义\n\n`;
  const pt = state.problem_translation;
  if (pt.surface_request) md += `**原始需求**：${pt.surface_request}\n\n`;
  if (pt.business_intent) md += `**业务意图**：${pt.business_intent}\n\n`;
  if (pt.behavioral_hypothesis) md += `**行为假设**：${pt.behavioral_hypothesis}\n\n`;
  if (pt.causal_hypothesis) md += `**成因假设**：${pt.causal_hypothesis}\n\n`;
  if (pt.narrative_bias_warning) {
    md += `> ⚠️ **叙事偏差警告**：${pt.narrative_bias_warning}\n\n`;
  }

  // 二、六层诊断
  md += `---\n\n## 二、六层诊断结果\n\n`;
  const activeLayers = Object.entries(state.diagnostic_layers)
    .filter(([, v]) => v.status !== 'blank') as [LayerName, typeof state.diagnostic_layers[LayerName]][];

  if (activeLayers.length > 0) {
    md += `| 层级 | 状态 | 摘要 |\n|------|------|------|\n`;
    for (const [key, layer] of activeLayers) {
      md += `| ${LAYER_LABELS[key as LayerName]} | ${LAYER_STATUS_LABELS[layer.status]} | ${layer.summary || '—'} |\n`;
    }
    md += '\n';
  } else {
    md += `*尚未深入探索任何诊断层。*\n\n`;
  }

  // 三、假设与证据
  md += `---\n\n## 三、竞争假设与证据\n\n`;
  if (state.hypotheses.length > 0) {
    for (const h of state.hypotheses) {
      const statusEmoji = h.status === 'eliminated' ? '~~' : '';
      md += `### ${statusEmoji}${h.content}${statusEmoji}\n\n`;
      md += `- **归类**：${CATEGORY_LABELS[h.category] || h.category}\n`;
      md += `- **状态**：${STATUS_LABELS[h.status]}\n`;
      md += `- **置信度**：${CONFIDENCE_LABELS[h.confidence]}\n`;

      if (h.supporting_evidence.length > 0) {
        md += `- **支持证据**：\n`;
        for (const e of h.supporting_evidence) {
          md += `  - ${e.content}（来源：${e.source}）\n`;
        }
      }
      if (h.contradicting_evidence.length > 0) {
        md += `- **反面证据**：\n`;
        for (const e of h.contradicting_evidence) {
          md += `  - ${e.content}（来源：${e.source}）\n`;
        }
      }
      md += '\n';
    }
  } else {
    md += `*尚未形成假设。*\n\n`;
  }

  // 四、关键时刻
  if (state.critical_moments.length > 0) {
    md += `---\n\n## 四、关键时刻\n\n`;
    md += `| 角色 | 时刻 | 理想行为 | 当前阻力 |\n|------|------|----------|----------|\n`;
    for (const cm of state.critical_moments) {
      md += `| ${cm.role} | ${cm.moment} | ${cm.desired_behavior} | ${cm.friction} |\n`;
    }
    md += '\n';
  }

  // 五、干预建议
  if (state.intervention_recommendations.length > 0) {
    md += `---\n\n## 五、干预建议\n\n`;
    for (const ir of state.intervention_recommendations) {
      md += `### ${ir.title}${ir.is_no_training ? ' ⚠️ 不建议培训' : ''}\n\n`;
      md += `${ir.description}\n\n`;
      md += `- **适用条件**：${ir.conditions}\n`;
      md += `- **风险**：${ir.risks}\n`;
      md += `- **评估方式**：${ir.evaluation_approach}\n\n`;
    }
  }

  // 六、评估方案
  const ea = state.evaluation_anchors;
  if (ea.behavioral_indicators.length > 0 || ea.measurement_approach || ea.baseline_description) {
    md += `---\n\n## 六、评估方案\n\n`;
    if (ea.behavioral_indicators.length > 0) {
      md += `**行为指标**：\n`;
      for (const bi of ea.behavioral_indicators) {
        md += `- ${bi}\n`;
      }
      md += '\n';
    }
    if (ea.measurement_approach) md += `**测量方式**：${ea.measurement_approach}\n\n`;
    if (ea.baseline_description) md += `**当前基线**：${ea.baseline_description}\n\n`;
  }

  // 状态摘要
  md += `---\n\n`;
  md += `**诊断状态**：${state.current_state} | **证据充分度**：${state.evidence_sufficiency}\n\n`;
  if (state.biggest_evidence_gap) {
    md += `**最大证据缺口**：${state.biggest_evidence_gap}\n\n`;
  }

  md += `---\n\n*本文档由 AGL Learning Diagnosis 自动生成。*\n`;

  return md;
}
