'use client';

import { useState } from 'react';
import { MaterialIcon } from '@/components/ui/material-icon';
import { cn } from '@/lib/utils';
import type { SufficiencyLevel } from '@/types/diagnosis';

interface TopBarProps {
  projectName: string;
  onNameChange: (name: string) => void;
  sufficiency: SufficiencyLevel;
  onExport?: () => void;
}

const sufficiencyConfig: Record<
  SufficiencyLevel,
  { label: string; bg: string; text: string; icon: string }
> = {
  insufficient: {
    label: '证据不足',
    bg: 'bg-insufficient-bg',
    text: 'text-insufficient-text',
    icon: 'error',
  },
  borderline: {
    label: '证据待补充',
    bg: 'bg-partial-bg',
    text: 'text-partial-text',
    icon: 'warning',
  },
  sufficient: {
    label: '证据充分',
    bg: 'bg-sufficient-bg',
    text: 'text-sufficient-text',
    icon: 'check_circle',
  },
};

export function TopBar({ projectName, onNameChange, sufficiency, onExport }: TopBarProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(projectName);
  const config = sufficiencyConfig[sufficiency];

  function handleSave() {
    setEditing(false);
    if (name.trim() && name !== projectName) {
      onNameChange(name.trim());
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-outline-variant bg-surface px-4">
      <div className="flex items-center gap-3">
        <a
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-on-surface-medium transition-colors hover:bg-surface-1 hover:text-primary"
          title="返回首页"
        >
          <MaterialIcon name="arrow_back" size={20} />
        </a>
        <div className="h-5 w-px bg-outline-variant" />
        <MaterialIcon name="diagnosis" size={24} className="text-primary" />
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="rounded-sm border border-primary bg-transparent px-1 text-title-md text-on-surface-high outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="group flex items-center gap-1 text-title-md text-on-surface-high hover:text-primary"
          >
            {projectName}
            <MaterialIcon
              name="edit"
              size={16}
              className="text-on-surface-disabled opacity-0 transition-opacity group-hover:opacity-100"
            />
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-label-md',
            config.bg,
            config.text
          )}
        >
          <MaterialIcon name={config.icon} size={16} />
          {config.label}
        </div>

        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-label-md text-on-surface-medium hover:bg-surface-1"
          >
            <MaterialIcon name="download" size={18} />
            导出
          </button>
        )}
      </div>
    </header>
  );
}
