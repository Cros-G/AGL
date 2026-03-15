'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useDiagnosisStore } from '@/stores/diagnosis-store';
import { useConversationStore } from '@/stores/conversation-store';
import type { EditAction } from '@/types/diagnosis';

const EDIT_LABELS: Record<string, string> = {
  text_edit: '修改了字段',
  hypothesis_add: '添加了假设',
  hypothesis_status_change: '更改了假设状态',
  hypothesis_delete: '删除了假设',
  confidence_change: '调整了置信度',
  confidence_major_change: '大幅调整了置信度',
  layer_status_change: '更改了诊断层状态',
};

function describeEdit(edit: EditAction): string {
  const label = EDIT_LABELS[edit.type] || edit.type;
  const pathParts = edit.path.split('.');
  const fieldHint = pathParts[pathParts.length - 1] || '';
  return `${label}（${fieldHint}）`;
}

export function useEditSync(projectId: string) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastEditCountRef = useRef(0);

  const saveDiagnosisToDB = useCallback(async () => {
    const state = useDiagnosisStore.getState().state;
    try {
      await fetch(`/api/projects/${projectId}/diagnosis`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stateJson: state }),
      });
    } catch (err) {
      console.error('[EditSync] Save diagnosis error:', err);
    }
  }, [projectId]);

  useEffect(() => {
    const unsub = useDiagnosisStore.subscribe((newState, prevState) => {
      const newEdits = newState.pendingEdits;
      const prevCount = lastEditCountRef.current;

      if (newEdits.length <= prevCount) return;

      const freshEdits = newEdits.slice(prevCount);
      lastEditCountRef.current = newEdits.length;

      for (const edit of freshEdits) {
        const desc = describeEdit(edit);
        useConversationStore.getState().addSystemMessage(`讲师${desc}`);

        const classification = useDiagnosisStore.getState().classifyEdit(edit);
        if (classification === 'directional') {
          useConversationStore.getState().addSystemMessage(
            '⚡ 这是一次方向性编辑，Agent 将在下次回复时重新评估'
          );
        }
      }

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(saveDiagnosisToDB, 1500);
    });

    return () => {
      unsub();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [saveDiagnosisToDB]);

  useEffect(() => {
    lastEditCountRef.current = 0;
  }, [projectId]);
}
