'use client';

import { useState, useRef, useEffect } from 'react';
import { MaterialIcon } from '@/components/ui/material-icon';
import { cn } from '@/lib/utils';
import type { QuestionsData } from '@/types/diagnosis';

interface QuestionCardProps {
  messageId: string;
  data: QuestionsData;
  onSubmit: (answers: string) => void;
  onMarkAnswered: (messageId: string, savedAnswers?: Record<string, string>) => void;
}

export function QuestionCard({ messageId, data, onSubmit, onMarkAnswered }: QuestionCardProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLTextAreaElement>(null);
  const isAnswered = data.answered === true;

  useEffect(() => {
    if (!isAnswered && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isAnswered]);

  if (!data.questions || data.questions.length === 0) {
    return (
      <div className="w-full rounded-lg border border-outline-variant bg-surface-1 px-4 py-3">
        <p className="text-body-sm text-on-surface-low">（问题加载异常）</p>
      </div>
    );
  }

  function handleChange(qId: string, value: string) {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
  }

  function handleSubmit() {
    const lines = data.questions.map((q) => {
      const answer = answers[q.id]?.trim() || '（未回答）';
      return `- 问题：${q.question}\n- 回答：${answer}`;
    });

    const hasAnyAnswer = data.questions.some((q) => answers[q.id]?.trim());
    if (!hasAnyAnswer) return;

    onSubmit(lines.join('\n\n'));
    onMarkAnswered(messageId, answers);
  }

  function handleSkip() {
    onSubmit('（跳过了这组问题，请继续诊断）');
    onMarkAnswered(messageId, {});
  }

  const displayAnswers = isAnswered ? (data.savedAnswers || {}) : answers;
  const canSubmit = data.questions.some((q) => answers[q.id]?.trim());
  const requiredMissing = data.questions
    .filter((q) => q.required)
    .some((q) => !answers[q.id]?.trim());

  return (
    <div className="w-full">
      {data.context && (
        <p className="mb-2 text-body-sm text-on-surface-medium">{data.context}</p>
      )}
      <div className={cn(
        'flex flex-col gap-3 rounded-lg border p-4',
        isAnswered ? 'border-outline-variant bg-surface-1' : 'border-primary/20 bg-surface'
      )}>
        {data.questions.map((q, idx) => (
          <div key={q.id} className="flex flex-col gap-1.5">
            <label className="flex items-start gap-1.5 text-title-sm text-on-surface-high">
              <MaterialIcon name="help_outline" size={16} className="mt-0.5 text-primary" />
              {q.question}
              {q.required && !isAnswered && <span className="text-insufficient-text">*</span>}
            </label>
            {isAnswered ? (
              <div className="rounded-md bg-surface-2 px-3 py-2 text-body-md text-on-surface-high">
                {displayAnswers[q.id]?.trim() || <span className="text-on-surface-disabled">（未回答）</span>}
              </div>
            ) : (
              <textarea
                ref={idx === 0 ? firstInputRef : undefined}
                value={answers[q.id] || ''}
                onChange={(e) => handleChange(q.id, e.target.value)}
                placeholder={q.hint || '请输入...'}
                rows={2}
                className="w-full resize-y rounded-md border border-outline bg-surface-1 px-3 py-2 text-body-md text-on-surface-high placeholder:text-on-surface-disabled focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            )}
          </div>
        ))}

        <div className="flex items-center justify-end gap-2 pt-1">
          {isAnswered ? (
            <span className="flex items-center gap-1.5 text-label-md text-sufficient-text">
              <MaterialIcon name="check_circle" size={16} />
              已回答
            </span>
          ) : (
            <>
              <button
                onClick={handleSkip}
                className="rounded-lg px-4 py-2 text-label-lg text-on-surface-medium transition-colors hover:bg-surface-2"
              >
                跳过
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit || requiredMissing}
                className={cn(
                  'flex items-center gap-1 rounded-lg px-5 py-2 text-label-lg transition-all',
                  canSubmit && !requiredMissing
                    ? 'bg-primary text-white shadow-level-2 hover:shadow-level-3'
                    : 'bg-surface-2 text-on-surface-disabled'
                )}
              >
                <MaterialIcon name="send" size={16} />
                提交回答
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
