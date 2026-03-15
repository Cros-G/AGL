import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { generateInterventionMemo } from '@/lib/export/generate-memo';
import type { DiagnosisState } from '@/types/diagnosis';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { diagnosis: true },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const diagnosisState: DiagnosisState | null = project.diagnosis?.stateJson
      ? JSON.parse(project.diagnosis.stateJson)
      : null;

    if (!diagnosisState) {
      return NextResponse.json({ error: 'No diagnosis data' }, { status: 400 });
    }

    const markdown = generateInterventionMemo(diagnosisState, project.name);

    return new Response(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(project.name)}_judgment.md"`,
      },
    });
  } catch (error) {
    console.error('[Export] Error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
