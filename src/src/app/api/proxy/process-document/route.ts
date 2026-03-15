import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const DOC_SERVICE_URL = process.env.DOC_PROCESSOR_URL || 'http://127.0.0.1:8100';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const res = await fetch(`${DOC_SERVICE_URL}/api/process-document`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), { status: res.status });
    }

    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Proxy] process-document error:', error);
    return new Response(
      JSON.stringify({ error: '文档处理服务未启动。请先运行 services/doc-processor/start.bat' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
