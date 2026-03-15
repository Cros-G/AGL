import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        diagnosis: true,
        sessions: {
          orderBy: { startedAt: 'desc' },
          take: 1,
          include: {
            messages: { orderBy: { createdAt: 'asc' } },
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const session = project.sessions[0];
    const messages = (session?.messages ?? []).map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.createdAt.getTime(),
      diagnosisUpdate: m.diagnosisUpdateJson ? JSON.parse(m.diagnosisUpdateJson) : undefined,
    }));

    const diagnosisState = project.diagnosis?.stateJson
      ? JSON.parse(project.diagnosis.stateJson)
      : null;

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
      },
      sessionId: session?.id ?? null,
      messages,
      diagnosisState,
    });
  } catch (error) {
    console.error('[Project] GET error:', error);
    return NextResponse.json({ error: 'Failed to load project' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  try {
    await prisma.project.delete({ where: { id: projectId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Project] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const body = await request.json();

  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { name: body.name },
    });
    return NextResponse.json(project);
  } catch (error) {
    console.error('[Project] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
