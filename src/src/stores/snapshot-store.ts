import { create } from 'zustand';
import type { DiagnosisState, SnapshotTrigger } from '@/types/diagnosis';

interface Snapshot {
  id: string;
  timestamp: number;
  trigger: SnapshotTrigger;
  description: string;
  stateJson: DiagnosisState;
}

interface SnapshotStore {
  snapshots: Snapshot[];
  previewingSnapshotId: string | null;

  captureSnapshot: (
    trigger: SnapshotTrigger,
    stateJson: DiagnosisState,
    description?: string
  ) => void;
  previewSnapshot: (id: string) => void;
  exitPreview: () => void;
  loadSnapshots: (snapshots: Snapshot[]) => void;
  reset: () => void;
}

export const useSnapshotStore = create<SnapshotStore>((set) => ({
  snapshots: [],
  previewingSnapshotId: null,

  captureSnapshot: (trigger, stateJson, description) => {
    const snapshot: Snapshot = {
      id: `snap_${Date.now()}`,
      timestamp: Date.now(),
      trigger,
      description: description ?? generateDescription(trigger),
      stateJson,
    };
    set((state) => ({ snapshots: [...state.snapshots, snapshot] }));
  },

  previewSnapshot: (id) => set({ previewingSnapshotId: id }),

  exitPreview: () => set({ previewingSnapshotId: null }),

  loadSnapshots: (snapshots) => set({ snapshots }),

  reset: () => set({ snapshots: [], previewingSnapshotId: null }),
}));

function generateDescription(trigger: SnapshotTrigger): string {
  const descriptions: Record<SnapshotTrigger, string> = {
    agent_update: 'Agent 更新了诊断面板',
    user_edit: '讲师编辑了面板',
    manual: '手动保存的快照',
    restore: '从历史快照恢复',
  };
  return descriptions[trigger];
}

export type { Snapshot };
