import https from 'https';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { AGENT_TOOLS } from './tools';
import { validateDiagnosisUpdate } from '@/schemas/diagnosis';
import type { DiagnosisUpdate } from '@/types/diagnosis';

const MAX_TURNS = 5;

export interface AgentLoopConfig {
  systemPrompt: string;
  messages: Array<{ role: string; content: unknown }>;
  model: string;
  projectId: string;
}

export interface TurnAuditData {
  turnIndex: number;
  rawRequest: Record<string, unknown>;
  rawResponseBlocks: unknown[];
  stopReason: string;
  toolCalls: Array<{ id: string; name: string; input: unknown; result: { success: boolean; content: string } }>;
}

export type AgentEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'tool_call_start'; id: string; name: string }
  | { type: 'tool_call'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; success: boolean; diagnosisUpdate?: DiagnosisUpdate; questionsPayload?: AskQuestionsPayload }
  | { type: 'turn_end'; turnIndex: number; stopReason: string; audit: TurnAuditData }
  | { type: 'done'; fullText: string }
  | { type: 'error'; message: string };

// -- Async channel: push from callbacks, yield from generator --

interface AsyncChannel<T> {
  push: (value: T) => void;
  end: () => void;
  throw: (err: Error) => void;
  [Symbol.asyncIterator](): AsyncIterator<T>;
}

function createChannel<T>(): AsyncChannel<T> {
  const queue: T[] = [];
  let resolve: (() => void) | null = null;
  let done = false;
  let error: Error | null = null;

  return {
    push(value: T) {
      queue.push(value);
      if (resolve) { resolve(); resolve = null; }
    },
    end() {
      done = true;
      if (resolve) { resolve(); resolve = null; }
    },
    throw(err: Error) {
      error = err;
      done = true;
      if (resolve) { resolve(); resolve = null; }
    },
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<T>> {
          while (queue.length === 0 && !done) {
            await new Promise<void>(r => { resolve = r; });
          }
          if (error) throw error;
          if (queue.length > 0) return { value: queue.shift()!, done: false };
          return { value: undefined as unknown as T, done: true };
        },
      };
    },
  };
}

// -- Content block tracking --

interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  text?: string;
  inputJson?: string;
  input?: Record<string, unknown>;
}

// -- Raw HTTP call --

function callClaudeStream(
  apiKey: string,
  model: string,
  system: string,
  messages: Array<{ role: string; content: unknown }>,
  proxyUrl?: string
): Promise<{ statusCode: number; stream: NodeJS.ReadableStream; errorBody?: string; rawRequestBody: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    const requestObj = {
      model,
      max_tokens: 4096,
      system,
      messages,
      tools: AGENT_TOOLS,
      stream: true,
    };
    const postBody = JSON.stringify(requestObj);

    const options: https.RequestOptions = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(postBody),
      },
    };

    if (proxyUrl) {
      options.agent = new HttpsProxyAgent(proxyUrl);
    }

    const req = https.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let body = '';
        res.on('data', (chunk) => { body += chunk.toString(); });
        res.on('end', () => resolve({ statusCode: res.statusCode!, stream: res, errorBody: body, rawRequestBody: requestObj }));
      } else {
        resolve({ statusCode: res.statusCode!, stream: res, rawRequestBody: requestObj });
      }
    });

    req.setTimeout(60_000, () => {
      req.destroy(new Error('Claude API request timeout (60s)'));
    });
    req.on('error', reject);
    req.write(postBody);
    req.end();
  });
}

// -- Stream -> channel bridge --

interface TurnResult {
  stopReason: string;
  contentBlocks: ContentBlock[];
}

function pipeStreamToChannel(
  stream: NodeJS.ReadableStream,
  channel: AsyncChannel<AgentEvent>,
): Promise<TurnResult> {
  return new Promise((resolve, reject) => {
    let sseBuffer = '';
    let stopReason = 'end_turn';
    const contentBlocks: ContentBlock[] = [];

    stream.on('data', (chunk: Buffer) => {
      sseBuffer += chunk.toString();
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ') || line.trim() === 'data: [DONE]') continue;
        try {
          const evt = JSON.parse(line.slice(6));

          switch (evt.type) {
            case 'content_block_start': {
              const block = evt.content_block;
              contentBlocks[evt.index] = {
                type: block.type,
                id: block.id,
                name: block.name,
                text: block.type === 'text' ? '' : undefined,
                inputJson: block.type === 'tool_use' ? '' : undefined,
              };
              if (block.type === 'tool_use' && block.id && block.name) {
                channel.push({ type: 'tool_call_start', id: block.id, name: block.name });
              }
              break;
            }

            case 'content_block_delta': {
              const delta = evt.delta;
              if (delta.type === 'text_delta') {
                if (contentBlocks[evt.index]) {
                  contentBlocks[evt.index].text = (contentBlocks[evt.index].text ?? '') + delta.text;
                }
                channel.push({ type: 'text_delta', content: delta.text });
              } else if (delta.type === 'input_json_delta') {
                if (contentBlocks[evt.index]) {
                  contentBlocks[evt.index].inputJson =
                    (contentBlocks[evt.index].inputJson ?? '') + delta.partial_json;
                }
              }
              break;
            }

            case 'content_block_stop': {
              const block = contentBlocks[evt.index];
              if (block?.type === 'tool_use' && block.inputJson) {
                try {
                  block.input = JSON.parse(block.inputJson);
                } catch {
                  block.input = {};
                }
              }
              break;
            }

            case 'message_delta': {
              if (evt.delta?.stop_reason) {
                stopReason = evt.delta.stop_reason;
              }
              break;
            }
          }
        } catch { /* skip malformed SSE */ }
      }
    });

    stream.on('end', () => resolve({ stopReason, contentBlocks }));
    stream.on('error', reject);
  });
}

// -- Tool execution --

export interface QuestionData {
  id: string;
  question: string;
  hint?: string;
  required?: boolean;
}

export interface AskQuestionsPayload {
  context?: string;
  questions: QuestionData[];
}

function executeToolCall(
  name: string,
  input: Record<string, unknown>
): { success: boolean; content: string; diagnosisUpdate?: DiagnosisUpdate; questionsPayload?: AskQuestionsPayload } {
  if (name === 'update_diagnosis') {
    // Normalize hypotheses: map old 6-layer to 3-category
    if (Array.isArray(input.hypotheses)) {
      const LAYER_TO_CATEGORY: Record<string, string> = {
        capability_gap: 'capability', capability: 'capability',
        motivation_attitude: 'motivation', motivation: 'motivation',
        business_context: 'environment', performance_standard: 'environment',
        environment_support: 'environment', management_behavior: 'environment',
        environment: 'environment',
      };
      input.hypotheses = (input.hypotheses as Array<Record<string, unknown>>).map(h => {
        if (!h.category && h.layer) {
          h.category = LAYER_TO_CATEGORY[String(h.layer)] || 'capability';
        }
        if (!h.category) h.category = 'capability';
        return h;
      });
    }
    const validation = validateDiagnosisUpdate(input);
    const resultContent = '诊断面板已同步更新。请继续你的分析——向讲师提问、分享洞察、或推进诊断。不要重复之前已经说过的内容。';
    if (validation.success && validation.data) {
      return {
        success: true,
        content: resultContent,
        diagnosisUpdate: validation.data as DiagnosisUpdate,
      };
    }
    return {
      success: true,
      content: resultContent,
      diagnosisUpdate: input as DiagnosisUpdate,
    };
  }
  if (name === 'ask_questions') {
    let rawQuestions = input.questions;
    // Claude sometimes stringifies nested arrays — parse defensively
    if (typeof rawQuestions === 'string') {
      try { rawQuestions = JSON.parse(rawQuestions); } catch { rawQuestions = []; }
    }
    const questionsArr = Array.isArray(rawQuestions) ? rawQuestions : [];
    // Normalize field names: Claude might use "text" or "content" instead of "question"
    const questions: QuestionData[] = questionsArr.map((q: Record<string, unknown>, i: number) => ({
      id: String(q.id ?? `Q${i + 1}`),
      question: String(q.question ?? q.text ?? q.content ?? ''),
      hint: q.hint ? String(q.hint) : undefined,
      required: q.required === true,
    }));
    return {
      success: true,
      content: `已向讲师展示 ${questions.length} 个问题，等待回答。`,
      questionsPayload: {
        context: input.context ? String(input.context) : undefined,
        questions,
      },
    };
  }
  return { success: false, content: `未知工具: ${name}` };
}

// -- Main agent loop --

export async function* runAgentLoop(
  config: AgentLoopConfig
): AsyncGenerator<AgentEvent> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  const conversationMessages: Array<{ role: string; content: unknown }> = [...config.messages];
  let fullText = '';

  console.log('[AgentLoop] Starting | model:', config.model, '| proxy:', proxyUrl || 'direct', '| tools:', AGENT_TOOLS.length);

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    console.log(`[AgentLoop] Turn ${turn + 1}/${MAX_TURNS}`);

    try {
      const apiRes = await callClaudeStream(
        apiKey, config.model, config.systemPrompt,
        conversationMessages, proxyUrl
      );

      if (apiRes.errorBody) {
        console.error('[AgentLoop] API error:', apiRes.statusCode, apiRes.errorBody);
        yield { type: 'error', message: `API ${apiRes.statusCode}: ${apiRes.errorBody}` };
        return;
      }

      const channel = createChannel<AgentEvent>();

      const turnPromise = pipeStreamToChannel(apiRes.stream, channel);

      // Yield text_delta events as they arrive from the channel
      // We do this concurrently: pipeStreamToChannel pushes events,
      // and we yield them here.
      // When the stream ends, turnPromise resolves and we signal the channel.
      const turnResultPromise = turnPromise.then((result) => {
        channel.end();
        return result;
      }).catch((err) => {
        channel.throw(err instanceof Error ? err : new Error(String(err)));
        return null;
      });

      for await (const event of channel) {
        if (event.type === 'text_delta') {
          fullText += event.content;
        }
        yield event;
      }

      const turnResult = await turnResultPromise;
      if (!turnResult) {
        yield { type: 'error', message: 'Stream processing failed' };
        return;
      }

      const { stopReason, contentBlocks } = turnResult;
      const toolUseBlocks = contentBlocks.filter(b => b.type === 'tool_use');

      console.log(`[AgentLoop] Turn ${turn + 1} done | stop: ${stopReason} | tools: ${toolUseBlocks.length}`);

      // Build raw response blocks for audit
      const rawResponseBlocks = contentBlocks.map(b => {
        if (b.type === 'text') return { type: 'text', text: b.text };
        if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
        return { type: b.type };
      });

      if (toolUseBlocks.length === 0 || stopReason === 'end_turn') {
        const audit: TurnAuditData = {
          turnIndex: turn, rawRequest: apiRes.rawRequestBody,
          rawResponseBlocks, stopReason, toolCalls: [],
        };
        yield { type: 'turn_end', turnIndex: turn, stopReason, audit };
        yield { type: 'done', fullText };
        return;
      }

      // Check if ask_questions is among the tools — if so, it takes priority
      // and we stop the loop (wait for user to answer before continuing)
      const hasAskQuestions = toolUseBlocks.some(b => b.name === 'ask_questions');
      const blocksToExecute = hasAskQuestions
        ? toolUseBlocks.filter(b => b.name === 'ask_questions')
        : toolUseBlocks;

      const assistantContent = contentBlocks.map(b => {
        if (b.type === 'text') return { type: 'text' as const, text: b.text ?? '' };
        if (b.type === 'tool_use') return { type: 'tool_use' as const, id: b.id!, name: b.name!, input: b.input ?? {} };
        return null;
      }).filter(Boolean);

      conversationMessages.push({ role: 'assistant', content: assistantContent });

      const toolResultContent: Array<{ type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }> = [];
      const auditToolCalls: TurnAuditData['toolCalls'] = [];

      for (const toolUse of blocksToExecute) {
        const input = toolUse.input ?? {};
        yield { type: 'tool_call', id: toolUse.id!, name: toolUse.name!, input };

        const result = executeToolCall(toolUse.name!, input);
        toolResultContent.push({
          type: 'tool_result',
          tool_use_id: toolUse.id!,
          content: result.content,
          is_error: !result.success,
        });
        auditToolCalls.push({
          id: toolUse.id!, name: toolUse.name!, input,
          result: { success: result.success, content: result.content },
        });

        yield {
          type: 'tool_result',
          id: toolUse.id!,
          name: toolUse.name!,
          success: result.success,
          diagnosisUpdate: result.diagnosisUpdate,
          questionsPayload: result.questionsPayload,
        };
      }

      // For skipped tools (e.g. update_diagnosis when ask_questions takes priority),
      // still send tool_result to Claude so message format is valid
      for (const toolUse of toolUseBlocks) {
        if (blocksToExecute.includes(toolUse)) continue;
        toolResultContent.push({
          type: 'tool_result',
          tool_use_id: toolUse.id!,
          content: '已跳过（优先处理用户交互）',
          is_error: false,
        });
      }

      conversationMessages.push({ role: 'user', content: toolResultContent });

      const auditStopReason = hasAskQuestions ? 'ask_questions' : 'tool_use';
      const audit: TurnAuditData = {
        turnIndex: turn, rawRequest: apiRes.rawRequestBody,
        rawResponseBlocks, stopReason: auditStopReason,
        toolCalls: auditToolCalls,
      };
      yield { type: 'turn_end', turnIndex: turn, stopReason: auditStopReason, audit };

      // ask_questions = wait for user input, stop loop
      if (hasAskQuestions) {
        console.log('[AgentLoop] ask_questions → stopping loop, waiting for user');
        yield { type: 'done', fullText };
        return;
      }

      // update_diagnosis etc. → continue loop so Claude can follow up
      console.log(`[AgentLoop] Tool executed, continuing loop for follow-up`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[AgentLoop] Turn ${turn} error:`, msg);
      yield { type: 'error', message: msg };
      return;
    }
  }

  console.log('[AgentLoop] Max turns reached');
  yield { type: 'done', fullText };
}
