import { NextRequest, NextResponse } from 'next/server';
import { getAuditLogs, getAuditLogById } from '@/lib/agent/audit-log';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const entry = getAuditLogById(id);
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(entry);
  }

  const logs = getAuditLogs();
  return NextResponse.json(logs);
}
