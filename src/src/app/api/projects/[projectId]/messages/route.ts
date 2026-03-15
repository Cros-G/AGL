import { NextRequest } from 'next/server';
import { buildSystemPrompt, buildContextMessages } from '@/lib/agent/system-prompt';
import { runAgentLoop, type AgentEvent, type TurnAuditData } from '@/lib/agent/agent-loop';
import { addAuditLog, generateAuditId, type AuditTurn } from '@/lib/agent/audit-log';
import { prisma } from '@/lib/db/prisma';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();
  const { content, currentDiagnosis, pendingEdits = [], coldStart = false } = body;

  if (!content) {
    return new Response(JSON.stringify({ error: 'Content is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let session = await prisma.session.findFirst({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
  });
  if (!session) {
    session = await prisma.session.create({ data: { projectId } });
  }

  if (!coldStart) {
    await prisma.message.create({
      data: { sessionId: session.id, role: 'user', content },
    });
  }

  const dbMessages = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  });
  const messageHistory = dbMessages.map((m) => ({ role: m.role, content: m.content }));

  const model = process.env.ANTHROPIC_MINI_MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  console.log('[Agent] model:', model, '| proxy:', proxyUrl || 'direct', '| tool_use: true');

  const systemPrompt = buildSystemPrompt(currentDiagnosis);
  const contextMessages = buildContextMessages(messageHistory.slice(0, -1), pendingEdits);
  contextMessages.push({ role: 'user', content });

  const enc = new TextEncoder();
  const auditId = generateAuditId();
  const startTime = Date.now();

  const readable = new ReadableStream({
    async start(controller) {
      let fullText = '';
      let lastDiagnosisUpdate: Record<string, unknown> | null = null;
      const auditTurns: AuditTurn[] = [];

      function send(data: Record<string, unknown>) {
        try {
          console.log('[SSE]', data.type, data.type === 'text' ? `(${(data.content as string)?.length}ch)` : '');
          controller.enqueue(enc.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* client disconnected */ }
      }

      try {
        const loop = runAgentLoop({
          systemPrompt,
          messages: contextMessages,
          model,
          projectId,
        });

        for await (const event of loop) {
          switch (event.type) {
            case 'text_delta':
              fullText += event.content;
              send({ type: 'text', content: event.content });
              break;

            case 'tool_call_start':
              send({ type: 'tool_call_start', id: event.id, name: event.name });
              break;

            case 'tool_call':
              send({
                type: 'tool_call',
                id: event.id,
                name: event.name,
                input: event.input,
              });
              break;

            case 'tool_result':
              send({
                type: 'tool_result',
                id: event.id,
                name: event.name,
                success: event.success,
              });
              if (event.diagnosisUpdate) {
                lastDiagnosisUpdate = event.diagnosisUpdate as Record<string, unknown>;
                send({ type: 'diagnosis_update', data: event.diagnosisUpdate });
              }
              if (event.questionsPayload) {
                send({ type: 'questions', data: event.questionsPayload });
              }
              break;

            case 'turn_end':
              send({ type: 'turn_end', turnIndex: event.turnIndex, stopReason: event.stopReason });
              if (event.audit) {
                auditTurns.push(event.audit);
              }
              break;

            case 'error':
              send({ type: 'error', message: event.message });
              break;

            case 'done':
              fullText = event.fullText || fullText;
              break;
          }
        }

        addAuditLog({
          id: auditId,
          timestamp: startTime,
          projectId,
          model,
          proxy: proxyUrl || null,
          durationMs: Date.now() - startTime,
          turns: auditTurns,
          finalText: fullText,
        });

        try {
          await prisma.message.create({
            data: {
              sessionId: session!.id,
              role: 'assistant',
              content: fullText,
              diagnosisUpdateJson: lastDiagnosisUpdate ? JSON.stringify(lastDiagnosisUpdate) : null,
            },
          });

          if (lastDiagnosisUpdate) {
            const merged = { ...currentDiagnosis, ...lastDiagnosisUpdate };
            await prisma.diagnosisRecord.upsert({
              where: { projectId },
              update: { stateJson: JSON.stringify(merged), version: { increment: 1 } },
              create: { projectId, stateJson: JSON.stringify(merged) },
            });
          }
        } catch (dbErr) {
          console.error('[Agent] DB save error:', dbErr);
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[Agent] Fatal error:', msg);
        send({ type: 'error', message: msg });
      } finally {
        try {
          send({ type: 'done', conversationalText: fullText });
        } catch { /* already closed */ }
        try {
          controller.close();
        } catch { /* already closed */ }
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
