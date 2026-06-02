'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import UserMenu from './components/UserMenu';
import NewProjectModal from './components/NewProjectModal';
import SettingsModal from './components/SettingsModal';
import { createProject, getMe, listProjects, saveCdnKey } from './lib/store';
import type { ProjectWithCounts, User, ToastInfo } from './lib/types';
import { relTime } from './lib/utils';

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<ProjectWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKeyState] = useState('');
  const [toast, setToast] = useState<ToastInfo>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        if (!me.user) {
          router.replace('/login');
          return;
        }
        setUser(me.user);
        setApiKeyState(me.user.cdn_api_key || '');
        const data = await listProjects();
        setProjects(data.projects);
      } catch (e: any) {
        if (e.status === 401) {
          router.replace('/login');
          return;
        }
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  function showToast(msg: string, type?: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2400);
  }

  async function onCreate(data: { name: string; color: string; cover_image: string | null }) {
    try {
      const { project } = await createProject(data);
      setModalOpen(false);
      router.push(`/projects/${project.id}`);
    } catch (e: any) {
      showToast(e.message || 'Failed to create project', 'error');
    }
  }

  if (loading) return <div className="loading">loading dashboard…</div>;
  if (error) {
    return (
      <div className="dashboard-error">
        <div className="error-card">
          <strong>Something went wrong.</strong>
          <div className="err-msg">{error}</div>
          <div className="err-hint">Check that your <code>DATABASE_URL</code> is set in <code>.env.local</code> and the database is reachable.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="db-topbar">
        <div className="db-brand">
          <img src="/tinymd-logo-white.png" alt="" className="brand-mark" />
          <div className="brand-text">
          </div>
        </div>
        <div className="db-topbar-actions">
          <button className="ghost-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Settings
          </button>
          <button className="primary-btn" onClick={() => setModalOpen(true)}>
            <span style={{ marginRight: 6 }}>+</span> New project
          </button>
          {user && <UserMenu user={user} />}
        </div>
      </header>

      <main className="db-main">
        <div className="db-hero">
          <h1 className="db-title">
            {user?.first_name ? `Hey, ${user.first_name}!` : 'Welcome back.'}
          </h1>
          <p className="db-subtitle">watcha gonna cook today</p>
        </div>

        {projects.length === 0 ? (
          <EmptyState onNew={() => setModalOpen(true)} />
        ) : (
          <div className="project-grid">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} onClick={() => router.push(`/projects/${p.id}`)} />
            ))}
            <button className="project-card project-card-new" onClick={() => setModalOpen(true)}>
              <div className="new-plus">+</div>
              <div className="new-label">New project</div>
            </button>
          </div>
        )}
      </main>

      <NewProjectModal
        open={modalOpen}
        apiKey={apiKey}
        onClose={() => setModalOpen(false)}
        onCreate={onCreate}
        onNeedApiKey={() => { setModalOpen(false); setSettingsOpen(true); }}
      />

      <SettingsModal
        open={settingsOpen}
        initialKey={apiKey}
        onClose={() => setSettingsOpen(false)}
        onSave={async (k) => { await saveCdnKey(k); setApiKeyState(k); }}
        onToast={showToast}
      />

      {toast && <div className={'toast' + (toast.type ? ' ' + toast.type : '')}>{toast.msg}</div>}
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: ProjectWithCounts; onClick: () => void }) {
  const updated = project.last_entry_at || project.updated_at;
  return (
    <button className={'project-card accent-' + project.color} onClick={onClick}>
      <div className="card-media">
        {project.cover_image ? (
          <img src={project.cover_image} alt="" className="card-cover" loading="lazy" />
        ) : (
          <div className="card-cover-fallback" />
        )}
        <div className="card-media-gradient" />
        <div className="card-count">{project.entry_count} {project.entry_count === 1 ? 'entry' : 'entries'}</div>
      </div>
      <div className="card-body">
        <div className="card-name">{project.name}</div>
        {project.last_entry_title ? (
          <div className="card-snippet">Latest · {project.last_entry_title}</div>
        ) : (
          <div className="card-snippet muted">No entries yet</div>
        )}
        <div className="card-foot">
          <span>Updated {relTime(new Date(updated))}</span>
          <span className="card-arrow">→</span>
        </div>
      </div>
    </button>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="empty-state">
      <div className="empty-illustration">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
      </div>
      <h2>No projects yet</h2>
      <p>Start your first build journal. You can add daily entries, photos, BOMs, pinouts and more.</p>
      <button className="primary-btn" onClick={onNew}>Add your first project</button>
    </div>
  );
}
