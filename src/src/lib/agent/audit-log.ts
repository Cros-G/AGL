export interface AuditTurn {
  turnIndex: number;
  rawRequest: Record<string, unknown>;
  rawResponseBlocks: unknown[];
  stopReason: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: unknown;
    result: { success: boolean; content: string };
  }>;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  projectId: string;
  model: string;
  proxy: string | null;
  durationMs: number;
  turns: AuditTurn[];
  finalText: string;
  error?: string;
}

const MAX_ENTRIES = 200;

const globalForAudit = globalThis as unknown as { __auditLogs?: AuditLogEntry[] };
if (!globalForAudit.__auditLogs) {
  globalForAudit.__auditLogs = [];
}
const auditLogs = globalForAudit.__auditLogs;

export function addAuditLog(entry: AuditLogEntry) {
  auditLogs.unshift(entry);
  if (auditLogs.length > MAX_ENTRIES) {
    auditLogs.pop();
  }
  const turnCount = entry.turns.length;
  const toolCount = entry.turns.reduce((s, t) => s + t.toolCalls.length, 0);
  console.log(`[Audit] #${entry.id} | ${entry.model} | ${entry.durationMs}ms | ${turnCount} turns | ${toolCount} tool calls`);
}

export function getAuditLogs(): AuditLogEntry[] {
  return auditLogs;
}

export function getAuditLogById(id: string): AuditLogEntry | undefined {
  return auditLogs.find((e) => e.id === id);
}

export function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
