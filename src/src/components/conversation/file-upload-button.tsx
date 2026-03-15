'use client';

import { useRef, useState, type DragEvent } from 'react';
import { MaterialIcon } from '@/components/ui/material-icon';
import { cn } from '@/lib/utils';

interface FileUploadButtonProps {
  onFileProcessed: (markdown: string, filename: string) => void;
  disabled?: boolean;
}

const ACCEPT = '.pdf,.docx,.doc,.pptx,.xlsx,.txt,.md,.png,.jpg,.jpeg,.webp';

export function FileUploadButton({ onFileProcessed, disabled }: FileUploadButtonProps) {
  const [processing, setProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (processing) return;
    setProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/proxy/process-document', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        alert(`文档处理失败: ${data.error || '未知错误'}`);
        return;
      }

      onFileProcessed(data.markdown, data.filename);
    } catch {
      alert('文档处理服务未连接，请确认 Python 服务已启动');
    } finally {
      setProcessing(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        className="hidden"
      />
      <button
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        disabled={disabled || processing}
        title="上传文档（PDF/Word/图片等）"
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
          dragOver
            ? 'bg-primary-container text-primary ring-2 ring-primary'
            : 'text-on-surface-low hover:bg-surface-2 hover:text-on-surface-medium',
          (disabled || processing) && 'opacity-50 pointer-events-none'
        )}
      >
        <MaterialIcon
          name={processing ? 'hourglass_empty' : 'attach_file'}
          size={20}
          className={processing ? 'animate-spin' : ''}
        />
      </button>
    </>
  );
}
