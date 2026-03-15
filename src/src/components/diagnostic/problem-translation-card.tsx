'use client';

import { useDiagnosisStore } from '@/stores/diagnosis-store';
import { MaterialIcon } from '@/components/ui/material-icon';
import { EditableField } from './editable-field';

const FIELDS = [
  { key: 'surface_request', label: '表层请求', icon: 'format_quote', color: 'bg-info-bg text-info-text' },
  { key: 'business_intent', label: '业务意图', icon: 'business_center', color: 'bg-layer-business-bg text-layer-business-text' },
  { key: 'behavioral_hypothesis', label: '行为假设', icon: 'psychology', color: 'bg-layer-capability-bg text-layer-capability-text' },
  { key: 'causal_hypothesis', label: '成因假设', icon: 'account_tree', color: 'bg-layer-management-bg text-layer-management-text' },
] as const;

export function ProblemTranslationCard() {
  const pt = useDiagnosisStore((s) => s.state.problem_translation);
  const updateField = useDiagnosisStore((s) => s.updateField);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, icon, color }) => (
          <div
            key={key}
            className="rounded-lg border border-outline-variant bg-surface-1 p-3 transition-shadow hover:shadow-level-2"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${color.split(' ')[0]}`}>
                <MaterialIcon name={icon} size={14} className={color.split(' ')[1]} />
              </div>
              <span className="text-label-md text-on-surface-medium">{label}</span>
            </div>
            <EditableField
              value={pt[key] ?? ''}
              placeholder="等待分析..."
              onChange={(val) => updateField(`problem_translation.${key}`, val)}
              multiline
            />
          </div>
        ))}
      </div>

      {pt.narrative_bias_warning && (
        <div className="flex items-start gap-2 rounded-lg border-l-3 border-partial-icon bg-partial-bg px-4 py-3">
          <MaterialIcon name="warning" size={18} className="mt-0.5 text-partial-icon" />
          <div>
            <div className="text-label-md text-partial-text">叙事偏差风险</div>
            <p className="mt-0.5 text-body-sm text-partial-text">{pt.narrative_bias_warning}</p>
          </div>
        </div>
      )}
    </div>
  );
}
