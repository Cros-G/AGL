'use client';

import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar } from '@/components/layout/top-bar';
import { ResizablePanels } from '@/components/layout/resizable-panels';
import { ConversationPanel } from '@/components/conversation/conversation-panel';
import { DiagnosticPanel } from '@/components/diagnostic/diagnostic-panel';
import { useConversationStore } from '@/stores/conversation-store';
import { useDiagnosisStore } from '@/stores/diagnosis-store';
import { validateDiagnosisUpdate } from '@/schemas/diagnosis';
import { useEditSync } from '@/hooks/use-edit-sync';
import { describeDiagnosisUpdate } from '@/lib/agent/describe-update';

export default function DiagnosisWorkspace() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const [projectName, setProjectName] = useState('新诊断项目');
  const [loading, setLoading] = useState(true);
  const coldStartTriggered = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sufficiency = useDiagnosisStore((s) => s.state.evidence_sufficiency);

  useEditSync(projectId);

  const consumeSSE = useCallback(
    async (response: Response) => {
      const store = useConversationStore.getState();

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';
      let finalized = false;

      const timeoutId = setTimeout(() => {
        if (!finalized && useConversationStore.getState().isStreaming) {
          finalized = true;
          useConversationStore.getState().finalizeAgentMessage(
            fullText || '（响应超时，请重试）', null
          );
          reader.cancel().catch(() => {});
        }
      }, 150_000);

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'text':
                  fullText += event.content;
                  store.appendStreamChunk(event.content);
                  break;

                case 'tool_call_start': {
                  const TOOL_LABELS: Record<string, string> = {
                    update_diagnosis: '诊断面板更新',
                    ask_questions: '提问',
                  };
                  // 先 finalize 已积累的文本（如果有）
                  if (fullText.trim() && useConversationStore.getState().isStreaming) {
                    useConversationStore.getState().finalizeAgentMessage(fullText, null);
                    fullText = '';
                    useConversationStore.getState().startStreaming();
                  }
                  useConversationStore.getState().addToolMessage({
                    toolName: event.name,
                    summary: `${TOOL_LABELS[event.name] || event.name}`,
                    details: [],
                    pending: true,
                  });
                  break;
                }

                case 'tool_call': {
                  // 工具 input 已完整解析，更新最后一条 tool 消息
                  const toolCall = describeDiagnosisUpdate(event.input);
                  toolCall.toolName = event.name;
                  useConversationStore.getState().updateLastToolMessage(toolCall);
                  break;
                }

                case 'diagnosis_update': {
                  const validation = validateDiagnosisUpdate(event.data);
                  const update = validation.success && validation.data ? validation.data : event.data;
                  const diagStore = useDiagnosisStore.getState();
                  const conflicts = diagStore.applyAgentUpdate(update);
                  if (conflicts.length > 0) {
                    useConversationStore.getState().addSystemMessage(
                      `检测到 ${conflicts.length} 个冲突字段，已保留你的编辑`
                    );
                  }
                  break;
                }

                case 'questions':
                  useConversationStore.getState().addQuestionsMessage(event.data);
                  break;

                case 'error':
                  finalized = true;
                  useConversationStore.getState().finalizeAgentMessage(
                    `⚠ Agent 处理失败: ${event.message || '未知错误'}`, null
                  );
                  return;

                case 'done': {
                  finalized = true;
                  const remaining = fullText.trim();
                  if (remaining) {
                    useConversationStore.getState().finalizeAgentMessage(remaining, null);
                  } else {
                    // No remaining text — just stop streaming, don't add empty/duplicate message
                    const s = useConversationStore.getState();
                    if (s.isStreaming) {
                      useConversationStore.setState({ isStreaming: false, streamingContent: '' });
                    }
                  }
                  return;
                }
              }
            } catch {
              /* skip malformed SSE */
            }
          }
        }
      } finally {
        clearTimeout(timeoutId);
        if (!finalized) {
          const s = useConversationStore.getState();
          if (s.isStreaming) {
            const remaining = fullText.trim();
            if (remaining) {
              s.finalizeAgentMessage(remaining, null);
            } else {
              useConversationStore.setState({ isStreaming: false, streamingContent: '' });
            }
          }
        }
      }
    },
    []
  );

  const handleSend = useCallback(
    async (content: string, options?: { silent?: boolean }) => {
      const store = useConversationStore.getState();
      if (!options?.silent) {
        store.addUserMessage(content);
      }
      store.startStreaming();

      const pendingEdits = useDiagnosisStore.getState().clearPendingEdits();
      const currentDiagnosis = useDiagnosisStore.getState().state;

      const ac = new AbortController();
      abortControllerRef.current = ac;

      try {
        const res = await fetch(`/api/projects/${projectId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, currentDiagnosis, pendingEdits }),
          signal: ac.signal,
        });

        if (!res.ok) throw new Error('API request failed');
        await consumeSSE(res);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          useConversationStore.getState().finalizeAgentMessage('（已停止生成）', null);
        } else {
          useConversationStore.getState().finalizeAgentMessage('抱歉，处理时遇到了问题。请重试。', null);
          console.error('Send message error:', error);
        }
      } finally {
        abortControllerRef.current = null;
      }
    },
    [projectId, consumeSSE]
  );

  const handleAbort = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const triggerColdStart = useCallback(async () => {
    const store = useConversationStore.getState();
    store.startStreaming();

    const currentDiagnosis = useDiagnosisStore.getState().state;

    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '[系统] 这是一个新项目，请生成开场白。向讲师介绍自己，并引导讲师描述培训需求。',
          currentDiagnosis,
          pendingEdits: [],
          coldStart: true,
        }),
      });

      if (!res.ok) throw new Error('Cold start failed');
      await consumeSSE(res);
    } catch (error) {
      useConversationStore.getState().finalizeAgentMessage(
        '你好！我是你的学习需求诊断顾问。请告诉我你面临的培训需求，比如"我们想给店长做一场执行力培训"——越具体越好。',
        null
      );
      console.error('Cold start error:', error);
    }
  }, [projectId, consumeSSE]);

  useEffect(() => {
    let cancelled = false;
    async function loadProject() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) throw new Error('Failed to load project');
        const data = await res.json();
        if (cancelled) return;

        setProjectName(data.project.name);
        useConversationStore.getState().setProject(projectId, data.sessionId || `session_${Date.now()}`);

        if (data.messages?.length > 0) {
          useConversationStore.getState().loadMessages(data.messages);
        }
        if (data.diagnosisState && Object.keys(data.diagnosisState).length > 0) {
          useDiagnosisStore.getState().loadState(data.diagnosisState);
        }

        setLoading(false);

        if (!data.messages || data.messages.length === 0) {
          if (!coldStartTriggered.current) {
            coldStartTriggered.current = true;
            triggerColdStart();
          }
        }
      } catch (err) {
        console.error('Load project error:', err);
        if (!cancelled) {
          setLoading(false);
          router.replace('/');
        }
      }
    }
    loadProject();

    return () => {
      cancelled = true;
      useConversationStore.getState().reset();
      useDiagnosisStore.getState().reset();
    };
  }, [projectId, triggerColdStart]);

  const handleExport = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/export`, { method: 'POST' });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}_判决书.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  }, [projectId, projectName]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-dim">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-on-surface-medium text-body-md">加载项目中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        projectName={projectName}
        onNameChange={setProjectName}
        sufficiency={sufficiency}
        onExport={handleExport}
      />
      <div className="flex-1 overflow-hidden">
        <ResizablePanels
          left={<ConversationPanel onSend={handleSend} onAbort={handleAbort} />}
          right={<DiagnosticPanel />}
        />
      </div>
    </div>
  );
}
