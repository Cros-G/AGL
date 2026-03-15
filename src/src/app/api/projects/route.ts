import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = body.name || '新诊断项目';

    const project = await prisma.project.create({
      data: { name },
    });

    const session = await prisma.session.create({
      data: { projectId: project.id },
    });

    await prisma.diagnosisRecord.create({
      data: { projectId: project.id, stateJson: '{}' },
    });

    return NextResponse.json({
      id: project.id,
      name: project.name,
      sessionId: session.id,
      createdAt: project.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[Projects] Create error:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { sessions: true } } },
    });
    return NextResponse.json(projects);
  } catch (error) {
    console.error('[Projects] List error:', error);
    return NextResponse.json({ error: 'Failed to list projects' }, { status: 500 });
  }
}
