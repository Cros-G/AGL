'use client';

import { useEffect, useRef, useState } from 'react';
import { useConversationStore } from '@/stores/conversation-store';
import { cn } from '@/lib/utils';
import { MaterialIcon } from '@/components/ui/material-icon';
import { MarkdownContent } from './markdown-content';
import { QuestionCard } from './question-card';
import type { ToolCallData } from '@/types/diagnosis';

interface MessageListProps {
  onSendAnswer?: (content: string) => void;
}

export function MessageList({ onSendAnswer }: MessageListProps = {}) {
  const messages = useConversationStore((s) => s.messages);
  const isStreaming = useConversationStore((s) => s.isStreaming);
  const streamingContent = useConversationStore((s) => s.streamingContent);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distFromBottom = scrollHeight - scrollTop - clientHeight;
      if (scrollTop < lastScrollTopRef.current && distFromBottom > 60) {
        autoScrollRef.current = false;
      } else if (distFromBottom < 15) {
        autoScrollRef.current = true;
      }
      lastScrollTopRef.current = scrollTop;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (autoScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, streamingContent]);

  useEffect(() => {
    autoScrollRef.current = true;
  }, [messages.length]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-container">
          <MaterialIcon name="chat" size={28} className="text-primary" />
        </div>
        <h2 className="text-headline-sm text-on-surface-high">开始诊断</h2>
        <p className="max-w-sm text-body-md text-on-surface-medium">
          粘贴培训需求、描述业务问题，或者直接告诉我你想解决什么
        </p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {messages.map((msg) => {
          if (msg.role === 'user') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary-container px-4 py-2.5 text-body-md text-on-surface-high">
                  {msg.content}
                </div>
              </div>
            );
          }
          if (msg.role === 'assistant') {
            return (
              <div key={msg.id} className="flex">
                <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-outline-variant bg-surface px-4 py-2.5 text-body-md text-on-surface-high">
                  <MarkdownContent content={msg.content} />
                </div>
              </div>
            );
          }
          if (msg.role === 'tool' && msg.toolCall) {
            return (
              <div key={msg.id} className="flex">
                <ToolCallBubble toolCall={msg.toolCall} />
              </div>
            );
          }
          if (msg.role === 'questions' && msg.questionsData) {
            return (
              <div key={msg.id} className="w-full">
                <QuestionCard
                  messageId={msg.id}
                  data={msg.questionsData}
                  onSubmit={(answers) => onSendAnswer?.(answers)}
                onMarkAnswered={(id, savedAnswers) =>
                  useConversationStore.getState().markQuestionsAnswered(id, savedAnswers)
                }
                />
              </div>
            );
          }
          if (msg.role === 'system') {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="flex items-center gap-1.5 py-1 text-body-sm text-on-surface-low">
                  <span className="h-1.5 w-1.5 rounded-full bg-on-surface-disabled" />
                  {msg.content}
                </div>
              </div>
            );
          }
          return null;
        })}

        {isStreaming && (
          <div className="flex">
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-outline-variant bg-surface px-4 py-2.5 text-body-md text-on-surface-high">
              {streamingContent ? (
                <>
                  <MarkdownContent content={streamingContent} />
                  <span className="ml-0.5 inline-block h-4 w-0.5 animate-cursor-blink bg-primary align-text-bottom" />
                </>
              ) : (
                <div className="flex items-center gap-2 text-on-surface-medium">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                  </div>
                  <span className="text-body-sm">正在思考...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function ToolCallBubble({ toolCall }: { toolCall: ToolCallData }) {
  const [expanded, setExpanded] = useState(false);
  const isPending = toolCall.pending === true;

  const TOOL_ICONS: Record<string, string> = {
    update_diagnosis: 'clinical_notes',
    diagnosis_update: 'clinical_notes',
  };
  const TOOL_LABELS: Record<string, string> = {
    update_diagnosis: '诊断面板更新',
    diagnosis_update: '诊断面板更新',
  };

  const label = TOOL_LABELS[toolCall.toolName] || toolCall.toolName;

  return (
    <div className="w-full max-w-md">
      <button
        onClick={() => !isPending && setExpanded(!expanded)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
          isPending
            ? 'border-primary/30 bg-primary-container/30'
            : 'border-primary/20 bg-primary-container/40 hover:bg-primary-container/60'
        )}
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          {isPending ? (
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          ) : (
            <MaterialIcon
              name={TOOL_ICONS[toolCall.toolName] || 'build'}
              size={14}
              className="text-primary"
            />
          )}
        </div>
        <div className="flex-1">
          <span className="text-label-md text-primary">{label}</span>
          {isPending ? (
            <span className="ml-1.5 text-body-sm text-on-surface-low">执行中...</span>
          ) : toolCall.details.length > 0 ? (
            <span className="ml-1.5 text-body-sm text-on-surface-low">
              {toolCall.details.length} 项变更
            </span>
          ) : null}
        </div>
        {!isPending && toolCall.details.length > 0 && (
          <MaterialIcon
            name="expand_more"
            size={16}
            className={cn(
              'text-on-surface-low transition-transform',
              expanded && 'rotate-180'
            )}
          />
        )}
      </button>

      {expanded && !isPending && toolCall.details.length > 0 && (
        <div className="mt-1 rounded-lg border border-outline-variant bg-surface-1 px-3 py-2">
          <ul className="flex flex-col gap-1">
            {toolCall.details.map((detail, i) => (
              <li key={i} className="flex items-start gap-1.5 text-body-sm text-on-surface-medium">
                <MaterialIcon name="arrow_right" size={14} className="mt-0.5 text-primary" />
                {detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
