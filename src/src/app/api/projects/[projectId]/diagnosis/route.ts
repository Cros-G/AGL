import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();

  try {
    const record = await prisma.diagnosisRecord.upsert({
      where: { projectId },
      update: {
        stateJson: JSON.stringify(body.stateJson),
        version: { increment: 1 },
      },
      create: {
        projectId,
        stateJson: JSON.stringify(body.stateJson),
      },
    });

    return NextResponse.json({ version: record.version });
  } catch (error) {
    console.error('[Diagnosis] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to save diagnosis' }, { status: 500 });
  }
}
