'use client';

import { useEffect, useState } from 'react';
import { MaterialIcon } from '@/components/ui/material-icon';
import { cn } from '@/lib/utils';

type AuditTurn = {
  turnIndex: number;
  rawRequest: Record<string, unknown>;
  rawResponseBlocks: unknown[];
  stopReason: string;
  toolCalls: Array<{ id: string; name: string; input: unknown; result: { success: boolean; content: string } }>;
};

type AuditEntry = {
  id: string;
  timestamp: number;
  projectId: string;
  model: string;
  proxy: string | null;
  durationMs: number;
  turns: AuditTurn[];
  finalText: string;
  error?: string;
};

type Tool = { name: string; description: string; status: string; implementation: string };
type ToolSchema = { name: string; description: string; inputSchema: Record<string, unknown> };

type Tab = 'audit' | 'registry' | 'prompts';

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('audit');
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [promptDraft, setPromptDraft] = useState('');
  const [promptEditing, setPromptEditing] = useState(false);
  const [promptCustomized, setPromptCustomized] = useState(false);
  const [promptSaving, setPromptSaving] = useState(false);
  const [toolSchemas, setToolSchemas] = useState<ToolSchema[]>([]);
  const [jsonView, setJsonView] = useState<'request' | 'response'>('request');

  useEffect(() => {
    fetchLogs();
    fetchRegistry();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs');
      const data = await res.json();
      setLogs(data);
    } catch { /* ignore */ }
  }

  async function fetchRegistry() {
    try {
      const res = await fetch('/api/admin/registry');
      const data = await res.json();
      if (data.tools) setTools(data.tools);
      if (data.prompts?.systemPrompt) {
        setSystemPrompt(data.prompts.systemPrompt);
        setPromptDraft(data.prompts.systemPrompt);
        setPromptCustomized(data.prompts.isCustomized ?? false);
      }
      if (data.toolSchemas) setToolSchemas(data.toolSchemas);
    } catch { /* ignore */ }
  }

  return (
    <div className="flex h-screen flex-col bg-surface-1">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-outline-variant bg-surface px-6">
        <div className="flex items-center gap-3">
          <MaterialIcon name="admin_panel_settings" size={24} className="text-primary" />
          <h1 className="text-title-md text-on-surface-high">AGL 后台</h1>
        </div>
        <a href="/" className="flex items-center gap-1 text-label-lg text-primary hover:underline">
          <MaterialIcon name="arrow_back" size={18} />
          返回诊断
        </a>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant bg-surface px-6">
        {([['audit', '审计日志', 'receipt_long'], ['registry', 'Tools', 'extension'], ['prompts', 'Prompts', 'description']] as const).map(
          ([key, label, icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-3 text-label-lg transition-colors',
                tab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-medium hover:text-on-surface-high'
              )}
            >
              <MaterialIcon name={icon} size={18} />
              {label}
            </button>
          )
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {tab === 'audit' && (
          <>
            {/* Log List */}
            <div className="w-96 shrink-0 overflow-y-auto border-r border-outline-variant bg-surface">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-center">
                  <MaterialIcon name="inbox" size={32} className="text-on-surface-disabled" />
                  <p className="text-body-md text-on-surface-low">暂无调用记录</p>
                  <p className="text-body-sm text-on-surface-disabled">发送一条消息后这里会出现日志</p>
                </div>
              ) : (
                logs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={cn(
                      'flex w-full flex-col gap-1 border-b border-outline-variant px-4 py-3 text-left transition-colors hover:bg-surface-1',
                      selectedLog?.id === log.id && 'bg-primary-container/30'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-label-md text-on-surface-high">{log.model}</span>
                      <span
                        className={cn(
                          'rounded-sm px-1.5 py-0.5 text-label-md',
                          log.error
                            ? 'bg-insufficient-bg text-insufficient-text'
                            : 'bg-sufficient-bg text-sufficient-text'
                        )}
                      >
                        {log.error ? 'ERROR' : `${log.turns?.length ?? 0} 轮`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-body-sm text-on-surface-low">
                      <span>{new Date(log.timestamp).toLocaleTimeString('zh-CN')}</span>
                      <span>{log.durationMs}ms</span>
                      <span>{(log.turns ?? []).reduce((s: number, t: AuditTurn) => s + t.toolCalls.length, 0)} tool calls</span>
                    </div>
                    <div className="truncate text-body-sm text-on-surface-medium">
                      {log.finalText?.slice(0, 60) || log.error || '...'}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Log Detail */}
            <div className="flex-1 overflow-y-auto p-6">
              {selectedLog ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-headline-sm text-on-surface-high">调用详情</h2>
                    <span className="text-body-sm text-on-surface-low">{selectedLog.id}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    {[
                      ['模型', selectedLog.model],
                      ['耗时', `${selectedLog.durationMs}ms`],
                      ['代理', selectedLog.proxy || '直连'],
                      ['轮数', `${selectedLog.turns?.length ?? 0} 轮`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md border border-outline-variant bg-surface p-3">
                        <div className="text-label-md text-on-surface-low">{label}</div>
                        <div className="mt-1 text-title-sm text-on-surface-high">{value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedLog.error && (
                    <div className="rounded-lg bg-insufficient-bg p-3 text-body-md text-insufficient-text">
                      {selectedLog.error}
                    </div>
                  )}

                  {(selectedLog.turns ?? []).map((turn) => (
                    <div key={turn.turnIndex} className="flex flex-col gap-3 rounded-lg border border-outline-variant bg-surface p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-title-sm text-on-surface-high">Turn {turn.turnIndex + 1}</span>
                        <span className="rounded-sm bg-info-bg px-1.5 py-0.5 text-label-md text-info-text">
                          stop: {turn.stopReason}
                        </span>
                        {turn.toolCalls.length > 0 && (
                          <span className="rounded-sm bg-partial-bg px-1.5 py-0.5 text-label-md text-partial-text">
                            {turn.toolCalls.length} tool calls
                          </span>
                        )}
                      </div>

                      <details>
                        <summary className="cursor-pointer text-label-lg text-primary hover:underline">
                          原始请求 JSON
                        </summary>
                        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-dim p-3 text-body-sm font-mono text-on-surface-high">
{JSON.stringify(turn.rawRequest, null, 2)}
                        </pre>
                      </details>

                      <details>
                        <summary className="cursor-pointer text-label-lg text-primary hover:underline">
                          原始响应 content blocks
                        </summary>
                        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-dim p-3 text-body-sm font-mono text-on-surface-high">
{JSON.stringify(turn.rawResponseBlocks, null, 2)}
                        </pre>
                      </details>

                      {turn.toolCalls.map((tc) => (
                        <details key={tc.id}>
                          <summary className="cursor-pointer text-label-lg text-partial-text hover:underline">
                            Tool: {tc.name} ({tc.id})
                          </summary>
                          <div className="mt-2 flex flex-col gap-2">
                            <div>
                              <div className="mb-1 text-label-md text-on-surface-low">Input:</div>
                              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-dim p-3 text-body-sm font-mono text-on-surface-high">
{JSON.stringify(tc.input, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <div className="mb-1 text-label-md text-on-surface-low">Result:</div>
                              <pre className="whitespace-pre-wrap break-words rounded-md bg-surface-dim p-3 text-body-sm font-mono text-on-surface-high">
{JSON.stringify(tc.result, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </details>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <MaterialIcon name="select" size={32} className="text-on-surface-disabled" />
                  <p className="text-body-md text-on-surface-low">选择左侧的日志条目查看详情</p>
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'registry' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-8">
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-headline-sm text-on-surface-high">
                  <MaterialIcon name="build" size={22} className="text-primary" />
                  Claude Tool Use（实际注册）
                </h2>
                <div className="flex flex-col gap-3">
                  {tools.map((tool) => (
                    <div key={tool.name} className="rounded-lg border border-outline-variant bg-surface p-4">
                      <div className="flex items-center gap-2">
                        <span className="text-title-sm text-on-surface-high">{tool.name}</span>
                        <span className="rounded-sm bg-primary-container px-1.5 py-0.5 text-label-md text-primary">
                          {tool.implementation}
                        </span>
                        <span className={cn(
                          'rounded-sm px-1.5 py-0.5 text-label-md',
                          tool.status === 'active' ? 'bg-sufficient-bg text-sufficient-text' : 'bg-eliminated-bg text-eliminated-text'
                        )}>
                          {tool.status}
                        </span>
                      </div>
                      <p className="mt-1 text-body-md text-on-surface-medium">{tool.description}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
        {tab === 'prompts' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mx-auto flex max-w-4xl flex-col gap-8">
              {/* System Prompt */}
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-headline-sm text-on-surface-high">
                    <MaterialIcon name="smart_toy" size={22} className="text-primary" />
                    System Prompt
                    {promptCustomized && (
                      <span className="rounded-sm bg-partial-bg px-2 py-0.5 text-label-md text-partial-text">
                        已自定义
                      </span>
                    )}
                  </h2>
                  <div className="flex gap-2">
                    {promptEditing ? (
                      <>
                        <button
                          onClick={async () => {
                            setPromptSaving(true);
                            try {
                              const res = await fetch('/api/admin/registry', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ systemPrompt: promptDraft }),
                              });
                              const data = await res.json();
                              setSystemPrompt(promptDraft);
                              setPromptCustomized(data.isCustomized);
                              setPromptEditing(false);
                            } catch { /* ignore */ }
                            setPromptSaving(false);
                          }}
                          disabled={promptSaving}
                          className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-label-lg text-white transition-colors hover:bg-primary-30 disabled:opacity-50"
                        >
                          <MaterialIcon name="save" size={16} />
                          {promptSaving ? '保存中...' : '保存'}
                        </button>
                        <button
                          onClick={() => { setPromptDraft(systemPrompt); setPromptEditing(false); }}
                          className="flex items-center gap-1 rounded-lg bg-surface-2 px-4 py-2 text-label-lg text-on-surface-medium hover:bg-surface-3"
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setPromptEditing(true)}
                          className="flex items-center gap-1 rounded-lg bg-surface-2 px-4 py-2 text-label-lg text-on-surface-medium hover:bg-surface-3"
                        >
                          <MaterialIcon name="edit" size={16} />
                          编辑
                        </button>
                        {promptCustomized && (
                          <button
                            onClick={async () => {
                              const res = await fetch('/api/admin/registry', {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ systemPrompt: null }),
                              });
                              const data = await res.json();
                              setSystemPrompt(data.systemPrompt);
                              setPromptDraft(data.systemPrompt);
                              setPromptCustomized(false);
                            }}
                            className="flex items-center gap-1 rounded-lg bg-insufficient-bg px-4 py-2 text-label-lg text-insufficient-text hover:opacity-80"
                          >
                            <MaterialIcon name="restart_alt" size={16} />
                            恢复默认
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-outline-variant bg-surface">
                  {promptEditing ? (
                    <textarea
                      value={promptDraft}
                      onChange={(e) => setPromptDraft(e.target.value)}
                      className="w-full resize-y rounded-lg bg-transparent p-4 text-body-md leading-relaxed text-on-surface-high outline-none focus:ring-2 focus:ring-primary/20"
                      rows={20}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap p-4 text-body-md leading-relaxed text-on-surface-high">
                      {systemPrompt || '加载中...'}
                    </pre>
                  )}
                </div>
              </section>

              {/* Tool Schemas */}
              <section>
                <h2 className="mb-4 flex items-center gap-2 text-headline-sm text-on-surface-high">
                  <MaterialIcon name="data_object" size={22} className="text-primary" />
                  Tool JSON Schemas
                </h2>
                <div className="flex flex-col gap-4">
                  {toolSchemas.map((schema) => (
                    <div key={schema.name} className="rounded-lg border border-outline-variant bg-surface p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="rounded-sm bg-primary-container px-2 py-0.5 text-label-lg text-primary">
                          {schema.name}
                        </span>
                      </div>
                      <p className="mb-3 text-body-md text-on-surface-medium">{schema.description}</p>
                      <details>
                        <summary className="cursor-pointer text-label-lg text-primary hover:underline">
                          查看 input_schema JSON
                        </summary>
                        <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-surface-dim p-3 text-body-sm font-mono text-on-surface-high">
                          {JSON.stringify(schema.inputSchema, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
