import type { ToolCallData } from '@/types/diagnosis';

const LAYER_LABELS: Record<string, string> = {
  business_context: '业务背景',
  performance_standard: '绩效标准',
  capability_gap: '能力缺口',
  environment_support: '环境支撑',
  management_behavior: '管理行为',
  motivation_attitude: '动机态度',
};

const STATE_LABELS: Record<string, string> = {
  COLD_START: '冷启动',
  HYPOTHESIS_SPARSE: '假设稀疏',
  EVIDENCE_GAP: '证据缺口',
  EVIDENCE_CONFLICT: '证据冲突',
  DECISION_READY: '可做决策',
  USER_EXPLORING: '用户探索中',
};

export function describeDiagnosisUpdate(input: unknown): ToolCallData {
  const u = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const details: string[] = [];

  if (typeof u.current_state === 'string') {
    details.push(`诊断阶段 → ${STATE_LABELS[u.current_state] || u.current_state}`);
  }

  if (u.problem_translation && typeof u.problem_translation === 'object') {
    const pt = u.problem_translation as Record<string, unknown>;
    const filled = [
      pt.surface_request && '表层请求',
      pt.business_intent && '业务意图',
      pt.behavioral_hypothesis && '行为假设',
      pt.causal_hypothesis && '成因假设',
    ].filter(Boolean);
    if (filled.length > 0) {
      details.push(`问题转译：${filled.join('、')}`);
    }
    if (pt.narrative_bias_warning) {
      details.push(`⚠ 叙事偏差提醒`);
    }
  }

  if (Array.isArray(u.hypotheses) && u.hypotheses.length > 0) {
    const hyps = u.hypotheses as Array<Record<string, unknown>>;
    const active = hyps.filter(h => h.status !== 'eliminated').length;
    const eliminated = hyps.filter(h => h.status === 'eliminated').length;
    let desc = `${hyps.length} 个假设`;
    if (active > 0) desc += `（${active} 活跃`;
    if (eliminated > 0) desc += `，${eliminated} 排除`;
    if (active > 0 || eliminated > 0) desc += '）';
    details.push(desc);
  }

  if (u.diagnostic_layers && typeof u.diagnostic_layers === 'object') {
    const explored = Object.entries(u.diagnostic_layers as Record<string, unknown>)
      .filter(([, v]) => v && typeof v === 'object' && 'status' in (v as Record<string, unknown>) && (v as Record<string, unknown>).status !== 'blank')
      .map(([k]) => LAYER_LABELS[k] || k);
    if (explored.length > 0) {
      details.push(`诊断层：${explored.join('、')}`);
    }
  }

  if (Array.isArray(u.critical_moments) && u.critical_moments.length > 0) {
    details.push(`${u.critical_moments.length} 个关键时刻`);
  }

  if (Array.isArray(u.intervention_recommendations) && u.intervention_recommendations.length > 0) {
    details.push(`${u.intervention_recommendations.length} 个干预建议`);
  }

  if (typeof u.evidence_sufficiency === 'string') {
    const labels: Record<string, string> = {
      insufficient: '不足', borderline: '临界', sufficient: '充分',
    };
    details.push(`证据充分度：${labels[u.evidence_sufficiency] || u.evidence_sufficiency}`);
  }

  const summary = details.length > 0
    ? `更新诊断面板（${details.length} 项变更）`
    : '更新诊断面板';

  return {
    toolName: 'update_diagnosis',
    summary,
    details,
  };
}
