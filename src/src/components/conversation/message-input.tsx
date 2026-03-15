'use client';

import { useState, useRef, useCallback, type KeyboardEvent } from 'react';
import { useConversationStore } from '@/stores/conversation-store';
import { MaterialIcon } from '@/components/ui/material-icon';
import { FileUploadButton } from './file-upload-button';
import { VoiceInputButton } from './voice-input-button';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSend: (content: string) => void;
  onAbort?: () => void;
}

export function MessageInput({ onSend, onAbort }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [attachedFile, setAttachedFile] = useState<{ filename: string; markdown: string } | null>(null);
  const isStreaming = useConversationStore((s) => s.isStreaming);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    let message = content.trim();

    if (attachedFile) {
      const fileBlock = `📎 **${attachedFile.filename}**\n\n${attachedFile.markdown}`;
      message = message ? `${fileBlock}\n\n---\n\n${message}` : fileBlock;
    }

    if (!message || isStreaming) return;
    onSend(message);
    setContent('');
    setAttachedFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [content, attachedFile, isStreaming, onSend]);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  function handleFileProcessed(markdown: string, filename: string) {
    setAttachedFile({ filename, markdown });
    textareaRef.current?.focus();
  }

  function handleVoiceTranscribed(text: string) {
    setContent((prev) => (prev ? `${prev} ${text}` : text));
    textareaRef.current?.focus();
  }

  return (
    <div className="border-t border-outline-variant bg-surface px-4 py-3">
      {/* Attached file preview */}
      {attachedFile && (
        <div className="mx-auto mb-2 flex max-w-2xl items-center gap-2 rounded-lg bg-info-bg px-3 py-2">
          <MaterialIcon name="description" size={18} className="text-info-icon" />
          <span className="flex-1 truncate text-body-sm text-info-text">
            {attachedFile.filename}（{attachedFile.markdown.length} 字符已提取）
          </span>
          <button
            onClick={() => setAttachedFile(null)}
            className="text-info-text hover:text-on-surface-high"
          >
            <MaterialIcon name="close" size={16} />
          </button>
        </div>
      )}

      <div className="mx-auto flex max-w-2xl items-end gap-1.5">
        <FileUploadButton
          onFileProcessed={handleFileProcessed}
          disabled={isStreaming}
        />

        <VoiceInputButton
          onTranscribed={handleVoiceTranscribed}
          disabled={isStreaming}
        />

        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={
              isStreaming
                ? 'Agent 正在回复中...'
                : attachedFile
                  ? '可以补充说明，或直接发送...'
                  : '描述你的培训需求...'
            }
            disabled={isStreaming}
            rows={1}
            className={cn(
              'w-full resize-none rounded-xl border bg-surface-1 px-4 py-2.5 text-body-md text-on-surface-high placeholder:text-on-surface-disabled focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
              isStreaming ? 'border-outline-variant opacity-60' : 'border-outline'
            )}
          />
        </div>

        {isStreaming && onAbort ? (
          <button
            onClick={onAbort}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-insufficient-bg text-insufficient-text transition-all hover:bg-insufficient-bg/80"
            title="停止生成"
          >
            <MaterialIcon name="stop" size={20} />
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={(!content.trim() && !attachedFile) || isStreaming}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-all',
              (content.trim() || attachedFile) && !isStreaming
                ? 'bg-primary text-white shadow-level-2 hover:shadow-level-3'
                : 'bg-surface-1 text-on-surface-disabled'
            )}
          >
            <MaterialIcon name="send" size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
