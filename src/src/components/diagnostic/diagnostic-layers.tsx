'use client';

import { useDiagnosisStore } from '@/stores/diagnosis-store';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/material-icon';
import { EditableField } from './editable-field';
import type { LayerName, LayerStatus } from '@/types/diagnosis';

const layerConfig: Record<
  LayerName,
  { label: string; icon: string; bgClass: string; textClass: string }
> = {
  business_context: { label: '业务背景', icon: 'business_center', bgClass: 'bg-layer-business-bg', textClass: 'text-layer-business-text' },
  performance_standard: { label: '绩效标准', icon: 'trending_up', bgClass: 'bg-layer-performance-bg', textClass: 'text-layer-performance-text' },
  capability_gap: { label: '能力缺口', icon: 'psychology', bgClass: 'bg-layer-capability-bg', textClass: 'text-layer-capability-text' },
  environment_support: { label: '环境支撑', icon: 'build', bgClass: 'bg-layer-environment-bg', textClass: 'text-layer-environment-text' },
  management_behavior: { label: '管理行为', icon: 'supervisor_account', bgClass: 'bg-layer-management-bg', textClass: 'text-layer-management-text' },
  motivation_attitude: { label: '动机态度', icon: 'emoji_objects', bgClass: 'bg-layer-motivation-bg', textClass: 'text-layer-motivation-text' },
};

const statusLabels: Record<LayerStatus, string> = { blank: '未涉及', exploring: '探索中', partial: '部分', sufficient: '充分' };
const statusColors: Record<LayerStatus, string> = {
  blank: 'bg-eliminated-bg text-eliminated-text',
  exploring: 'bg-info-bg text-info-text',
  partial: 'bg-partial-bg text-partial-text',
  sufficient: 'bg-sufficient-bg text-sufficient-text',
};

export function DiagnosticLayers() {
  const diagnosticLayers = useDiagnosisStore((s) => s.state.diagnostic_layers);
  const visibleSections = useDiagnosisStore((s) => s.visibleSections);
  const updateField = useDiagnosisStore((s) => s.updateField);

  const visibleLayers = (Object.entries(diagnosticLayers) as [LayerName, typeof diagnosticLayers[LayerName]][])
    .filter(([name]) => visibleSections.has(`layer_${name}`));

  if (visibleLayers.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <MaterialIcon name="layers" size={28} className="text-on-surface-disabled" />
        <p className="text-body-md text-on-surface-low">尚未深入任何诊断层</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {visibleLayers.map(([name, layer]) => {
        const config = layerConfig[name];
        return (
          <div
            key={name}
            className="rounded-lg border border-outline-variant bg-surface-1 p-3 transition-shadow hover:shadow-level-2"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', config.bgClass)}>
                  <MaterialIcon name={config.icon} size={16} className={config.textClass} />
                </div>
                <span className="text-title-sm text-on-surface-high">{config.label}</span>
              </div>
              <span className={cn('rounded-xs px-1.5 py-0.5 text-label-md', statusColors[layer.status])}>
                {statusLabels[layer.status]}
              </span>
            </div>

            <div className="text-body-sm text-on-surface-medium">
              <EditableField
                value={layer.summary ?? ''}
                placeholder="暂无摘要..."
                onChange={(val) => updateField(`diagnostic_layers.${name}.summary`, val)}
                multiline
              />
            </div>

            {layer.evidence_sources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {layer.evidence_sources.map((src, i) => (
                  <span key={i} className="rounded-xs bg-surface-2 px-1.5 py-0.5 text-label-md text-on-surface-low">
                    {src}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
