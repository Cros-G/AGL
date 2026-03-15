import { create } from 'zustand';
import type {
  DiagnosisState,
  DiagnosisUpdate,
  EditAction,
  Hypothesis,
  HypothesisStatus,
  ConfidenceLevel,
  LayerName,
} from '@/types/diagnosis';

interface ConflictResult {
  path: string;
  userValue: unknown;
  agentValue: unknown;
}

interface DiagnosisStore {
  state: DiagnosisState;
  visibleSections: Set<string>;
  dirtyFields: Map<string, unknown>;
  pendingEdits: EditAction[];

  applyAgentUpdate: (update: DiagnosisUpdate) => ConflictResult[];
  updateField: (path: string, value: unknown) => void;
  addHypothesis: (hypothesis: Hypothesis) => void;
  updateHypothesisStatus: (id: string, status: HypothesisStatus) => void;
  updateConfidence: (id: string, confidence: ConfidenceLevel) => void;
  classifyEdit: (action: EditAction) => 'lightweight' | 'directional';
  clearPendingEdits: () => EditAction[];
  loadState: (state: DiagnosisState) => void;
  reset: () => void;
}

function createEmptyDiagnosisState(): DiagnosisState {
  const emptyLayer = { status: 'blank' as const, summary: null, evidence_sources: [] };
  return {
    current_state: 'COLD_START',
    problem_translation: {
      surface_request: null,
      business_intent: null,
      behavioral_hypothesis: null,
      causal_hypothesis: null,
      narrative_bias_warning: null,
    },
    hypotheses: [],
    diagnostic_layers: {
      business_context: { ...emptyLayer },
      performance_standard: { ...emptyLayer },
      capability_gap: { ...emptyLayer },
      environment_support: { ...emptyLayer },
      management_behavior: { ...emptyLayer },
      motivation_attitude: { ...emptyLayer },
    },
    critical_moments: [],
    evidence_sufficiency: 'insufficient',
    biggest_evidence_gap: null,
    suggested_next_action: null,
    evaluation_anchors: {
      behavioral_indicators: [],
      measurement_approach: null,
      baseline_description: null,
    },
    intervention_recommendations: [],
  };
}

function computeVisibleSections(state: DiagnosisState): Set<string> {
  const sections = new Set<string>();

  if (state.problem_translation.surface_request) {
    sections.add('problem_translation');
  }

  if (state.hypotheses.length > 0) {
    sections.add('hypotheses');
  }

  const anyLayerVisible = Object.entries(state.diagnostic_layers).some(
    ([, data]) => data.status !== 'blank'
  );
  if (anyLayerVisible) {
    sections.add('diagnostic_layers');
    for (const [layer, data] of Object.entries(state.diagnostic_layers)) {
      if (data.status !== 'blank') {
        sections.add(`layer_${layer}`);
      }
    }
  }

  if (state.critical_moments.length > 0) {
    sections.add('critical_moments');
  }

  if (state.evaluation_anchors.behavioral_indicators.length > 0) {
    sections.add('evaluation_anchors');
  }

  if (
    state.current_state === 'DECISION_READY' &&
    state.intervention_recommendations.length > 0
  ) {
    sections.add('intervention_recommendations');
  }

  if (state.hypotheses.length >= 2) {
    sections.add('evidence_sufficiency_indicator');
  }

  return sections;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc: unknown, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  let current: Record<string, unknown> = obj;
  for (const key of keys) {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[last] = value;
}

export const useDiagnosisStore = create<DiagnosisStore>((set, get) => ({
  state: createEmptyDiagnosisState(),
  visibleSections: new Set<string>(),
  dirtyFields: new Map<string, unknown>(),
  pendingEdits: [],

  applyAgentUpdate: (update) => {
    const conflicts: ConflictResult[] = [];
    const { state: currentState, dirtyFields } = get();
    const newState = { ...currentState };

    for (const [key, value] of Object.entries(update)) {
      if (key === 'hypotheses' && Array.isArray(value)) {
        newState.hypotheses = value;
      } else if (key === 'diagnostic_layers' && value && typeof value === 'object') {
        newState.diagnostic_layers = {
          ...newState.diagnostic_layers,
          ...(value as Record<string, unknown>),
        } as DiagnosisState['diagnostic_layers'];
      } else {
        const dirtyValue = dirtyFields.get(key);
        if (dirtyValue !== undefined && JSON.stringify(dirtyValue) !== JSON.stringify(value)) {
          conflicts.push({ path: key, userValue: dirtyValue, agentValue: value });
        } else {
          (newState as Record<string, unknown>)[key] = value;
        }
      }
    }

    set({
      state: newState as DiagnosisState,
      visibleSections: computeVisibleSections(newState as DiagnosisState),
      dirtyFields: new Map(),
    });

    return conflicts;
  },

  updateField: (path, value) => {
    const currentState = { ...get().state } as Record<string, unknown>;
    const oldValue = getNestedValue(currentState, path);
    setNestedValue(currentState, path, value);
    const newState = currentState as unknown as DiagnosisState;

    const edit: EditAction = { type: 'text_edit', path, oldValue, newValue: value };

    set((s) => ({
      state: newState,
      visibleSections: computeVisibleSections(newState),
      dirtyFields: new Map(s.dirtyFields).set(path, value),
      pendingEdits: [...s.pendingEdits, edit],
    }));
  },

  addHypothesis: (hypothesis) => {
    set((s) => {
      const newState = {
        ...s.state,
        hypotheses: [...s.state.hypotheses, hypothesis],
      };
      return {
        state: newState,
        visibleSections: computeVisibleSections(newState),
        pendingEdits: [
          ...s.pendingEdits,
          {
            type: 'hypothesis_add' as const,
            path: `hypotheses.${hypothesis.id}`,
            oldValue: null,
            newValue: hypothesis,
          },
        ],
      };
    });
  },

  updateHypothesisStatus: (id, status) => {
    set((s) => {
      const hypotheses = s.state.hypotheses.map((h) =>
        h.id === id ? { ...h, status } : h
      );
      const newState = { ...s.state, hypotheses };
      return {
        state: newState,
        visibleSections: computeVisibleSections(newState),
        dirtyFields: new Map(s.dirtyFields).set(`hypotheses.${id}.status`, status),
        pendingEdits: [
          ...s.pendingEdits,
          {
            type: 'hypothesis_status_change' as const,
            path: `hypotheses.${id}.status`,
            oldValue: s.state.hypotheses.find((h) => h.id === id)?.status,
            newValue: status,
          },
        ],
      };
    });
  },

  updateConfidence: (id, confidence) => {
    set((s) => {
      const oldHyp = s.state.hypotheses.find((h) => h.id === id);
      const hypotheses = s.state.hypotheses.map((h) =>
        h.id === id ? { ...h, confidence } : h
      );
      const newState = { ...s.state, hypotheses };

      const levels: ConfidenceLevel[] = ['low', 'medium', 'high'];
      const delta = oldHyp
        ? Math.abs(levels.indexOf(confidence) - levels.indexOf(oldHyp.confidence))
        : 0;

      return {
        state: newState,
        visibleSections: computeVisibleSections(newState),
        dirtyFields: new Map(s.dirtyFields).set(`hypotheses.${id}.confidence`, confidence),
        pendingEdits: [
          ...s.pendingEdits,
          {
            type: delta >= 2 ? ('confidence_major_change' as const) : ('confidence_change' as const),
            path: `hypotheses.${id}.confidence`,
            oldValue: oldHyp?.confidence,
            newValue: confidence,
            delta,
          },
        ],
      };
    });
  },

  classifyEdit: (action) => {
    const directionalActions: string[] = [
      'hypothesis_status_change',
      'hypothesis_delete',
      'layer_status_change',
      'critical_moment_delete',
      'evaluation_indicator_change',
      'confidence_major_change',
    ];
    if (directionalActions.includes(action.type)) return 'directional';
    return 'lightweight';
  },

  clearPendingEdits: () => {
    const edits = get().pendingEdits;
    set({ pendingEdits: [] });
    return edits;
  },

  loadState: (state) =>
    set({
      state,
      visibleSections: computeVisibleSections(state),
      dirtyFields: new Map(),
      pendingEdits: [],
    }),

  reset: () =>
    set({
      state: createEmptyDiagnosisState(),
      visibleSections: new Set(),
      dirtyFields: new Map(),
      pendingEdits: [],
    }),
}));

export { createEmptyDiagnosisState };
