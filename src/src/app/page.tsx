'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

interface Project {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function HomePage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingProjects(false));
  }, []);

  async function handleNewProject() {
    setCreating(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '新诊断项目' }),
      });
      const data = await res.json();
      router.push(`/projects/${data.id}`);
    } catch {
      setCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, projectId: string) {
    e.stopPropagation();
    if (!confirm('确定删除这个项目？所有对话和诊断数据将被永久删除。')) return;
    setDeletingId(projectId);
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch { /* ignore */ }
    setDeletingId(null);
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-surface-dim px-4 py-12">
      <div className="flex w-full max-w-3xl flex-col items-center gap-10">
        {/* Header */}
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary-container">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 32 }}>
              diagnosis
            </span>
          </div>
          <h1 className="text-display-md font-normal text-on-surface-high">
            学习需求诊断
          </h1>
          <p className="max-w-md text-body-lg text-on-surface-medium">
            从模糊的培训需求出发，通过系统化诊断，找到真正有效的干预方案
          </p>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className="mt-2 flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-label-lg text-white shadow-level-2 transition-all hover:shadow-level-3 disabled:opacity-50"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add</span>
            {creating ? '创建中...' : '开始新诊断'}
          </button>
        </div>

        {/* Project Cards */}
        {loadingProjects ? (
          <div className="text-on-surface-low text-body-md">加载项目列表...</div>
        ) : projects.length > 0 ? (
          <div className="w-full">
            <h2 className="mb-4 text-title-md text-on-surface-high">历史项目</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <div
                  key={p.id}
                  onClick={() => router.push(`/projects/${p.id}`)}
                  className="group relative cursor-pointer rounded-lg border border-outline-variant bg-surface p-5 transition-all hover:border-primary/30 hover:shadow-level-2"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="text-title-sm text-on-surface-high group-hover:text-primary transition-colors">
                      {p.name}
                    </h3>
                    <button
                      onClick={(e) => handleDelete(e, p.id)}
                      disabled={deletingId === p.id}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-on-surface-disabled opacity-0 transition-all hover:bg-insufficient-bg hover:text-insufficient-text group-hover:opacity-100"
                      title="删除项目"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        {deletingId === p.id ? 'hourglass_empty' : 'delete'}
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-body-sm text-on-surface-low">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                      {timeAgo(p.updatedAt)}
                    </span>
                    <span>{formatDate(p.createdAt)}</span>
                  </div>
                  <span
                    className="absolute bottom-3 right-4 material-symbols-outlined text-on-surface-disabled opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ fontSize: 18 }}
                  >
                    arrow_forward
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <a
          href="/admin"
          className="mt-2 text-body-sm text-on-surface-low hover:text-primary transition-colors"
        >
          后台管理
        </a>
      </div>
    </div>
  );
}
