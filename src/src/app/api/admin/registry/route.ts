import { NextRequest, NextResponse } from 'next/server';
import { registeredTools } from '@/lib/agent/tool-registry';
import { getSystemPrompt, getBasePrompt, setSystemPrompt, resetSystemPrompt, getDefaultSystemPrompt } from '@/lib/agent/system-prompt';
import { AGENT_TOOLS } from '@/lib/agent/tools';

export async function GET() {
  return NextResponse.json({
    tools: registeredTools,
    prompts: {
      systemPrompt: getBasePrompt(),
      defaultSystemPrompt: getDefaultSystemPrompt(),
      isCustomized: getBasePrompt() !== getDefaultSystemPrompt(),
    },
    toolSchemas: AGENT_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.input_schema,
    })),
  });
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();

  if (body.systemPrompt !== undefined) {
    if (body.systemPrompt === null || body.systemPrompt === '') {
      resetSystemPrompt();
    } else {
      setSystemPrompt(body.systemPrompt);
    }
  }

  return NextResponse.json({
    systemPrompt: getBasePrompt(),
    isCustomized: getBasePrompt() !== getDefaultSystemPrompt(),
  });
}
