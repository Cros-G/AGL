'use client';

import { useState, useRef, useEffect } from 'react';
import { useDiagnosisStore } from '@/stores/diagnosis-store';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/material-icon';
import type { Hypothesis, HypothesisCategory, HypothesisStatus, ConfidenceLevel, Evidence } from '@/types/diagnosis';

const CATEGORY_META: Record<HypothesisCategory, { label: string; desc: string; icon: string; bg: string; text: string; trainable: string }> = {
  capability: {
    label: '能力问题', desc: '不会做', icon: 'school',
    bg: 'bg-layer-capability-bg', text: 'text-layer-capability-text',
    trainable: '培训可解决',
  },
  motivation: {
    label: '动机问题', desc: '不愿做', icon: 'emoji_objects',
    bg: 'bg-layer-motivation-bg', text: 'text-layer-motivation-text',
    trainable: '需激励机制',
  },
  environment: {
    label: '环境问题', desc: '做不了', icon: 'build',
    bg: 'bg-layer-environment-bg', text: 'text-layer-environment-text',
    trainable: '培训无法解决',
  },
};

const CATEGORY_ORDER: HypothesisCategory[] = ['capability', 'motivation', 'environment'];

const STATUS_CFG: Record<HypothesisStatus, { label: string; color: string }> = {
  active: { label: '活跃', color: 'bg-info-bg text-info-text' },
  strengthened: { label: '增强', color: 'bg-sufficient-bg text-sufficient-text' },
  weakened: { label: '减弱', color: 'bg-partial-bg text-partial-text' },
  eliminated: { label: '排除', color: 'bg-eliminated-bg text-eliminated-text' },
};

const CONF_CFG: Record<ConfidenceLevel, { label: string; width: string; color: string }> = {
  low: { label: '低', width: 'w-1/4', color: 'bg-partial-icon' },
  medium: { label: '中', width: 'w-1/2', color: 'bg-info-icon' },
  high: { label: '高', width: 'w-3/4', color: 'bg-sufficient-icon' },
};

export function HypothesesBoard() {
  const hypotheses = useDiagnosisStore((s) => s.state.hypotheses);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (hypotheses.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <MaterialIcon name="lightbulb" size={28} className="text-on-surface-disabled" />
        <p className="text-body-md text-on-surface-low">尚未形成假设</p>
      </div>
    );
  }

  const grouped = new Map<HypothesisCategory, Hypothesis[]>();
  for (const h of hypotheses) {
    const cat = (h.category || 'capability') as HypothesisCategory;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(h);
  }

  const activeCats = CATEGORY_ORDER.filter((c) => grouped.has(c));

  return (
    <div className="flex flex-col gap-5">
      {activeCats.map((cat) => {
        const meta = CATEGORY_META[cat];
        const catHyps = grouped.get(cat)!;
        const activeCount = catHyps.filter((h) => h.status !== 'eliminated').length;

        return (
          <div key={cat}>
            <div className="mb-2 flex items-center gap-2">
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', meta.bg)}>
                <MaterialIcon name={meta.icon} size={16} className={meta.text} />
              </div>
              <div>
                <span className="text-label-lg text-on-surface-high">{meta.label}</span>
                <span className="ml-1.5 text-body-sm text-on-surface-low">{meta.desc}</span>
              </div>
              <span className={cn('ml-auto rounded-full px-2 py-0.5 text-label-md', meta.bg, meta.text)}>
                {meta.trainable}
              </span>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-label-md text-on-surface-low">
                {activeCount}/{catHyps.length}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {catHyps.map((h) => (
                <HypothesisRow
                  key={h.id}
                  hypothesis={h}
                  isExpanded={expandedId === h.id}
                  onToggle={() => setExpandedId(expandedId === h.id ? null : h.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HypothesisRow({
  hypothesis: h,
  isExpanded,
  onToggle,
}: {
  hypothesis: Hypothesis;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const updateHypothesisStatus = useDiagnosisStore((s) => s.updateHypothesisStatus);
  const updateConfidence = useDiagnosisStore((s) => s.updateConfidence);
  const statusCfg = STATUS_CFG[h.status];
  const confCfg = CONF_CFG[h.confidence];
  const evidenceCount = h.supporting_evidence.length + h.contradicting_evidence.length;

  function cycleStatus(e: React.MouseEvent) {
    e.stopPropagation();
    const list: HypothesisStatus[] = ['active', 'strengthened', 'weakened', 'eliminated'];
    updateHypothesisStatus(h.id, list[(list.indexOf(h.status) + 1) % list.length]);
  }

  function cycleConfidence(e: React.MouseEvent) {
    e.stopPropagation();
    const list: ConfidenceLevel[] = ['low', 'medium', 'high'];
    updateConfidence(h.id, list[(list.indexOf(h.confidence) + 1) % list.length]);
  }

  return (
    <div className={cn(
      'rounded-lg border border-outline-variant bg-surface-1 transition-shadow hover:shadow-level-2',
      h.status === 'eliminated' && 'opacity-45',
    )}>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <div className="min-w-0 flex-1">
          <p className="text-body-md text-on-surface-high">{h.content}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1 w-16 rounded-full bg-outline-variant">
              <div className={cn('h-full rounded-full transition-all', confCfg.color, confCfg.width)} />
            </div>
            <button onClick={cycleConfidence} className="text-label-md text-on-surface-low hover:text-primary">
              {confCfg.label}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={cycleStatus} className={cn('rounded-xs px-1.5 py-0.5 text-label-md', statusCfg.color)}>
            {statusCfg.label}
          </button>
          {evidenceCount > 0 && (
            <span className="flex items-center gap-0.5 text-label-md text-on-surface-low">
              <MaterialIcon name="description" size={12} />{evidenceCount}
            </span>
          )}
          <MaterialIcon name="expand_more" size={16} className={cn('text-on-surface-disabled transition-transform', isExpanded && 'rotate-180')} />
        </div>
      </button>

      <EvidencePanel isOpen={isExpanded} supporting={h.supporting_evidence} contradicting={h.contradicting_evidence} />
    </div>
  );
}

function EvidencePanel({ isOpen, supporting, contradicting }: { isOpen: boolean; supporting: Evidence[]; contradicting: Evidence[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    setHeight(isOpen && ref.current ? ref.current.scrollHeight : 0);
  }, [isOpen, supporting.length, contradicting.length]);

  const hasAny = supporting.length > 0 || contradicting.length > 0;

  return (
    <div className="overflow-hidden transition-all duration-300 ease-out" style={{ maxHeight: height }}>
      <div ref={ref} className="border-t border-outline-variant px-3 py-2.5">
        {!hasAny ? (
          <p className="text-body-sm text-on-surface-disabled">暂无证据</p>
        ) : (
          <div className="flex flex-col gap-2">
            {supporting.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-label-md text-sufficient-text">
                  <MaterialIcon name="add_circle" size={13} />支持 ({supporting.length})
                </div>
                <ul className="flex flex-col gap-1">
                  {supporting.map((ev, i) => (
                    <li key={ev.id || i} className="rounded-sm bg-sufficient-bg/50 px-2.5 py-1.5 text-body-sm text-on-surface-high">
                      {ev.content}{ev.source && <span className="ml-1 text-on-surface-low">— {ev.source}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {contradicting.length > 0 && (
              <div>
                <div className="mb-1 flex items-center gap-1 text-label-md text-insufficient-text">
                  <MaterialIcon name="remove_circle" size={13} />反面 ({contradicting.length})
                </div>
                <ul className="flex flex-col gap-1">
                  {contradicting.map((ev, i) => (
                    <li key={ev.id || i} className="rounded-sm bg-insufficient-bg/50 px-2.5 py-1.5 text-body-sm text-on-surface-high">
                      {ev.content}{ev.source && <span className="ml-1 text-on-surface-low">— {ev.source}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
