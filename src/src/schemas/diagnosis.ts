import { z } from 'zod';

const evidenceSchema = z.object({
  id: z.string(),
  content: z.string(),
  source: z.string(),
});

const hypothesisSchema = z.object({
  id: z.string(),
  content: z.string(),
  category: z.enum(['capability', 'motivation', 'environment']).optional(),
  layer: z.string().optional(),
  confidence: z.enum(['low', 'medium', 'high']),
  supporting_evidence: z.array(evidenceSchema).default([]),
  contradicting_evidence: z.array(evidenceSchema).default([]),
  status: z.enum(['active', 'strengthened', 'weakened', 'eliminated']),
});

const problemTranslationSchema = z.object({
  surface_request: z.string().nullable().default(null),
  business_intent: z.string().nullable().default(null),
  behavioral_hypothesis: z.string().nullable().default(null),
  causal_hypothesis: z.string().nullable().default(null),
  narrative_bias_warning: z.string().nullable().default(null),
});

const layerStateSchema = z.object({
  status: z.enum(['blank', 'exploring', 'partial', 'sufficient']),
  summary: z.string().nullable().default(null),
  evidence_sources: z.array(z.string()).default([]),
});

const criticalMomentSchema = z.object({
  id: z.string(),
  role: z.string(),
  moment: z.string(),
  desired_behavior: z.string(),
  friction: z.string(),
});

const evaluationAnchorsSchema = z.object({
  behavioral_indicators: z.array(z.string()).default([]),
  measurement_approach: z.string().nullable().default(null),
  baseline_description: z.string().nullable().default(null),
});

const interventionRecommendationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  conditions: z.string(),
  risks: z.string(),
  evaluation_approach: z.string(),
  is_no_training: z.boolean().default(false),
});

const layerNames = [
  'business_context',
  'performance_standard',
  'capability_gap',
  'environment_support',
  'management_behavior',
  'motivation_attitude',
] as const;

const diagnosticLayersSchema = z.object(
  Object.fromEntries(layerNames.map((name) => [name, layerStateSchema])) as Record<
    (typeof layerNames)[number],
    typeof layerStateSchema
  >
);

export const diagnosisStateSchema = z.object({
  current_state: z.enum([
    'COLD_START',
    'HYPOTHESIS_SPARSE',
    'EVIDENCE_GAP',
    'EVIDENCE_CONFLICT',
    'DECISION_READY',
    'USER_EXPLORING',
  ]),
  problem_translation: problemTranslationSchema,
  hypotheses: z.array(hypothesisSchema).default([]),
  diagnostic_layers: diagnosticLayersSchema,
  critical_moments: z.array(criticalMomentSchema).default([]),
  evidence_sufficiency: z.enum(['insufficient', 'borderline', 'sufficient']),
  biggest_evidence_gap: z.string().nullable().default(null),
  suggested_next_action: z.string().nullable().default(null),
  evaluation_anchors: evaluationAnchorsSchema,
  intervention_recommendations: z.array(interventionRecommendationSchema).default([]),
});

export const diagnosisUpdateSchema = diagnosisStateSchema.partial();

export type ValidatedDiagnosisState = z.infer<typeof diagnosisStateSchema>;
export type ValidatedDiagnosisUpdate = z.infer<typeof diagnosisUpdateSchema>;

export function validateDiagnosisUpdate(data: unknown): {
  success: boolean;
  data?: ValidatedDiagnosisUpdate;
  errors?: z.ZodError;
} {
  const result = diagnosisUpdateSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}
