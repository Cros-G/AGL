export type DiagnosticState =
  | 'COLD_START'
  | 'HYPOTHESIS_SPARSE'
  | 'EVIDENCE_GAP'
  | 'EVIDENCE_CONFLICT'
  | 'DECISION_READY'
  | 'USER_EXPLORING';

export type SufficiencyLevel = 'insufficient' | 'borderline' | 'sufficient';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type HypothesisStatus = 'active' | 'strengthened' | 'weakened' | 'eliminated';

export type HypothesisCategory = 'capability' | 'motivation' | 'environment';

export type LayerName =
  | 'business_context'
  | 'performance_standard'
  | 'capability_gap'
  | 'environment_support'
  | 'management_behavior'
  | 'motivation_attitude';

export type LayerStatus = 'blank' | 'exploring' | 'partial' | 'sufficient';

export interface Evidence {
  id: string;
  content: string;
  source: string;
}

export interface Hypothesis {
  id: string;
  content: string;
  category: HypothesisCategory;
  layer?: LayerName;
  confidence: ConfidenceLevel;
  supporting_evidence: Evidence[];
  contradicting_evidence: Evidence[];
  status: HypothesisStatus;
}

export interface ProblemTranslation {
  surface_request: string | null;
  business_intent: string | null;
  behavioral_hypothesis: string | null;
  causal_hypothesis: string | null;
  narrative_bias_warning: string | null;
}

export interface LayerState {
  status: LayerStatus;
  summary: string | null;
  evidence_sources: string[];
}

export interface CriticalMoment {
  id: string;
  role: string;
  moment: string;
  desired_behavior: string;
  friction: string;
}

export interface EvaluationAnchors {
  behavioral_indicators: string[];
  measurement_approach: string | null;
  baseline_description: string | null;
}

export interface InterventionRecommendation {
  id: string;
  title: string;
  description: string;
  conditions: string;
  risks: string;
  evaluation_approach: string;
  is_no_training: boolean;
}

export interface DiagnosisState {
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

export interface DiagnosisUpdate extends Partial<DiagnosisState> {}

export interface ToolCallData {
  toolName: string;
  summary: string;
  details: string[];
  pending?: boolean;
}

export interface QuestionItem {
  id: string;
  question: string;
  hint?: string;
  required?: boolean;
}

export interface QuestionsData {
  context?: string;
  questions: QuestionItem[];
  answered?: boolean;
  savedAnswers?: Record<string, string>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool' | 'questions';
  content: string;
  timestamp: number;
  diagnosisUpdate?: DiagnosisUpdate;
  toolCall?: ToolCallData;
  questionsData?: QuestionsData;
}

export type EditActionType =
  | 'text_edit'
  | 'hypothesis_status_change'
  | 'hypothesis_delete'
  | 'hypothesis_add'
  | 'layer_status_change'
  | 'confidence_change'
  | 'confidence_major_change'
  | 'critical_moment_delete'
  | 'evaluation_indicator_change';

export interface EditAction {
  type: EditActionType;
  path: string;
  oldValue: unknown;
  newValue: unknown;
  delta?: number;
}

export type SnapshotTrigger = 'agent_update' | 'user_edit' | 'manual' | 'restore';
