'use client';

import { useState } from 'react';
import { useDiagnosisStore } from '@/stores/diagnosis-store';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/material-icon';
import { ProblemTranslationCard } from './problem-translation-card';
import { HypothesesBoard } from './hypotheses-board';
import { DiagnosticLayers } from './diagnostic-layers';

type PanelTab = 'translation' | 'hypotheses' | 'layers';

const TABS: { key: PanelTab; label: string; icon: string }[] = [
  { key: 'translation', label: '问题转译', icon: 'translate' },
  { key: 'hypotheses', label: '竞争假设', icon: 'lightbulb' },
  { key: 'layers', label: '六层诊断', icon: 'layers' },
];

export function DiagnosticPanel() {
  const visibleSections = useDiagnosisStore((s) => s.visibleSections);
  const isEmpty = visibleSections.size === 0;
  const [activeTab, setActiveTab] = useState<PanelTab>('translation');

  if (isEmpty) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface-dim px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
          <MaterialIcon name="analytics" size={28} className="text-on-surface-low" />
        </div>
        <h3 className="text-title-md text-on-surface-medium">诊断面板</h3>
        <p className="max-w-xs text-body-sm text-on-surface-low">
          开始对话后，诊断结构会随着分析的深入逐步出现在这里
        </p>
      </div>
    );
  }

  const availableTabs = TABS.filter((t) => {
    if (t.key === 'translation') return visibleSections.has('problem_translation');
    if (t.key === 'hypotheses') return visibleSections.has('hypotheses');
    if (t.key === 'layers') return visibleSections.has('diagnostic_layers');
    return false;
  });

  const currentTab = availableTabs.find((t) => t.key === activeTab) ? activeTab : availableTabs[0]?.key;

  return (
    <div className="flex h-full flex-col bg-surface-dim">
      {/* Tab Bar */}
      <div className="flex shrink-0 border-b border-outline-variant bg-surface">
        {availableTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-label-lg transition-colors',
              currentTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-medium hover:text-on-surface-high'
            )}
          >
            <MaterialIcon name={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {currentTab === 'translation' && <ProblemTranslationCard />}
        {currentTab === 'hypotheses' && <HypothesesBoard />}
        {currentTab === 'layers' && <DiagnosticLayers />}
      </div>
    </div>
  );
}
