'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/material-icon';

interface EditableFieldProps {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}

export function EditableField({
  value,
  placeholder = '',
  onChange,
  multiline = false,
}: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [justSaved, setJustSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function handleSave() {
    setEditing(false);
    if (draft !== value) {
      onChange(draft);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    }
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    const className =
      'w-full rounded-sm border border-primary bg-surface px-1.5 py-0.5 text-body-md text-on-surface-high outline-none';

    return multiline ? (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Escape') handleCancel();
        }}
        className={cn(className, 'min-h-[60px] resize-y')}
        rows={3}
      />
    ) : (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') handleCancel();
        }}
        className={className}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={cn(
        'group flex w-full items-center gap-1 rounded-sm px-1.5 py-0.5 text-left text-body-md transition-colors hover:bg-surface-1',
        !value && 'text-on-surface-disabled',
        justSaved && 'animate-update-flash'
      )}
    >
      <span className="flex-1">{value || placeholder}</span>
      <MaterialIcon
        name={justSaved ? 'check' : 'edit'}
        size={14}
        className={cn(
          'transition-opacity',
          justSaved
            ? 'text-sufficient-icon opacity-100'
            : 'text-on-surface-disabled opacity-0 group-hover:opacity-100'
        )}
      />
    </button>
  );
}
