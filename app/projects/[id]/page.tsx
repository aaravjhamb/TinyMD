'use client';

import { useCallback, useEffect, useMemo, useRef, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import BomEditor from '../../components/BomEditor';
import EditorPane, { type EditorHandle } from '../../components/EditorPane';
import NewEntryModal from '../../components/NewEntryModal';
import Preview from '../../components/Preview';
import SettingsModal from '../../components/SettingsModal';
import ShareModal from '../../components/ShareModal';
import UserMenu from '../../components/UserMenu';
import {
  createEntry as apiCreateEntry,
  deleteEntry as apiDeleteEntry,
  deleteProject as apiDeleteProject,
  getMe,
  getProject,
  isGuestMode,
  reorderEntries as apiReorderEntries,
  saveCdnKey,
  updateEntry as apiUpdateEntry,
  updateProject as apiUpdateProject,
} from '../../lib/store';
import type { Entry, EntryKind, Project, ToastInfo, User } from '../../lib/types';
import { relTime } from '../../lib/utils';

// Pinned entries (e.g. the README) float to the top; otherwise manual order, then newest-first.
function sortEntries(list: Entry[]): Entry[] {
  return [...list].sort(
    (a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      a.position - b.position ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(true);
  const [apiKey, setApiKeyState] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; pos: 'above' | 'below' } | null>(null);
  const [guest, setGuest] = useState(false);
  const [toast, setToast] = useState<ToastInfo>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [counts, setCounts] = useState({ words: 0, chars: 0, line: 1, col: 1 });

  const splitRef = useRef<HTMLElement | null>(null);
  const editorHandle = useRef<EditorHandle>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragIdRef = useRef<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setGuest(isGuestMode());
        const me = await getMe();
        if (!me.user) { router.replace(`/login`); return; }
        setUser(me.user);
        const data = await getProject(projectId);
        setProject(data.project);
        const sorted = sortEntries(data.entries);
        setEntries(sorted);
        setActiveEntryId(sorted[0]?.id || null);
        setApiKeyState(me.user.cdn_api_key || '');
      } catch (e: any) {
        if (e.status === 401) { router.replace(`/login?return_to=/projects/${projectId}`); return; }
        if (e.status === 404) { router.replace('/'); return; }
        showToast(e.message || 'Failed to load', 'error');
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const activeEntry = useMemo(
    () => entries.find((e) => e.id === activeEntryId) || entries[0] || null,
    [entries, activeEntryId]
  );

  function showToast(msg: string, type?: 'success' | 'error') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2400);
  }

  const handleBodyChange = useCallback((body: string) => {
    if (!activeEntry) return;
    setEntries((es) => es.map((e) => (e.id === activeEntry.id ? { ...e, body, updated_at: new Date().toISOString() } : e)));
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await apiUpdateEntry(activeEntry.id, { body });
        setSaveStatus('saved');
      } catch (e: any) {
        setSaveStatus('error');
        showToast('Save failed: ' + (e.message || 'unknown'), 'error');
      }
    }, 500);

    const trimmed = body.trim();
    setCounts((c) => ({ ...c, words: trimmed ? trimmed.split(/\s+/).length : 0, chars: body.length }));
  }, [activeEntry]);

  const handleSelectionChange = useCallback((info: { line: number; col: number }) => {
    setCounts((c) => ({ ...c, line: info.line, col: info.col }));
  }, []);

  function handleTitleChange(value: string) {
    if (!activeEntry) return;
    const title = value || '';
    setEntries((es) => es.map((e) => (e.id === activeEntry.id ? { ...e, title } : e)));
    setSaveStatus('saving');
    if (titleSaveTimer.current) clearTimeout(titleSaveTimer.current);
    titleSaveTimer.current = setTimeout(async () => {
      try {
        await apiUpdateEntry(activeEntry.id, { title: title.trim() || 'Untitled' });
        setSaveStatus('saved');
      } catch (e: any) {
        setSaveStatus('error');
        showToast('Save failed: ' + (e.message || 'unknown'), 'error');
      }
    }, 400);
  }

  function templateForKind(kind: EntryKind): { title: string; body: string } {
    if (kind === 'readme') {
      const name = project?.name || 'Project';
      return {
        title: 'README',
        body: `# ${name}\n\n> One-line summary of what this project is.\n\n## Overview\n\nWhat it does and why it exists.\n\n## Status\n\n- [ ] In progress\n\n## Links\n\n- \n`,
      };
    }
    if (kind === 'bom') {
      return {
        title: 'Bill of materials',
        body: `| Qty | Part | Description | Source | Cost |\n| --- | --- | --- | --- | --- |\n|   |   |   |   |   |\n`,
      };
    }
    const idx = entries.filter((e) => e.kind === 'journal').length + 1;
    return { title: `Day ${idx} · ${new Date().toLocaleDateString()}`, body: `# Day ${idx}\n\n` };
  }

  async function createEntryOfKind(kind: EntryKind) {
    setNewEntryOpen(false);
    try {
      const { title, body } = templateForKind(kind);
      const { entry } = await apiCreateEntry(projectId, { title, body, kind, pinned: kind === 'readme' });
      setEntries((es) => sortEntries([entry, ...es]));
      setActiveEntryId(entry.id);
    } catch (e: any) {
      showToast(e.message || 'Failed to create entry', 'error');
    }
  }

  async function togglePin(entry: Entry) {
    const pinned = !entry.pinned;
    setEntries((es) => sortEntries(es.map((e) => (e.id === entry.id ? { ...e, pinned } : e))));
    try {
      await apiUpdateEntry(entry.id, { pinned });
    } catch (e: any) {
      setEntries((es) => sortEntries(es.map((e) => (e.id === entry.id ? { ...e, pinned: entry.pinned } : e))));
      showToast(e.message || 'Failed to update pin', 'error');
    }
  }

  function onEntryDragStart(e: React.DragEvent, id: string) {
    dragIdRef.current = id;
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', id); } catch {}
    try { e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, 12, 12); } catch {}
  }

  function onEntryDragOver(e: React.DragEvent, id: string) {
    const src = dragIdRef.current;
    if (!src || src === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos: 'above' | 'below' = e.clientY - rect.top < rect.height / 2 ? 'above' : 'below';
    setDropTarget((cur) => (cur && cur.id === id && cur.pos === pos ? cur : { id, pos }));
  }

  function onEntryDragEnd() {
    dragIdRef.current = null;
    setDragId(null);
    setDropTarget(null);
  }

  async function onEntryDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const sourceId = dragIdRef.current;
    const pos = dropTarget?.pos ?? 'above';
    dragIdRef.current = null;
    setDragId(null);
    setDropTarget(null);
    if (!sourceId || sourceId === targetId) return;

    const arr = entries.slice();
    const from = arr.findIndex((x) => x.id === sourceId);
    if (from < 0) return;
    const [moved] = arr.splice(from, 1);
    const targetIdx = arr.findIndex((x) => x.id === targetId);
    if (targetIdx < 0) return;
    const insertAt = pos === 'below' ? targetIdx + 1 : targetIdx;
    arr.splice(insertAt, 0, moved);

    const repositioned = arr.map((en, i) => ({ ...en, position: i }));
    const prev = entries;
    setEntries(sortEntries(repositioned));
    try {
      await apiReorderEntries(projectId, repositioned.map((en) => en.id));
    } catch (err: any) {
      setEntries(prev);
      showToast(err.message || 'Failed to reorder', 'error');
    }
  }

  async function removeEntry(id: string) {
    try {
      await apiDeleteEntry(id);
      const remaining = entries.filter((e) => e.id !== id);
      setEntries(remaining);
      if (id === activeEntryId) setActiveEntryId(remaining[0]?.id || null);
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', 'error');
    }
  }

  async function renameProject(name: string) {
    if (!project) return;
    setProject({ ...project, name });
    try { await apiUpdateProject(project.id, { name }); }
    catch (e: any) { showToast(e.message || 'Rename failed', 'error'); }
  }
  async function deleteProject() {
    if (!project) return;
    if (!confirm(`Delete project "${project.name}" and all its entries?`)) return;
    try {
      await apiDeleteProject(project.id);
      router.push('/');
    } catch (e: any) { showToast(e.message || 'Delete failed', 'error'); }
  }

  function exportProject() {
    if (!project) return;
    const sorted = [...entries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const exportedOn = new Date().toISOString().slice(0, 10);
    const header = `# ${project.name}\n\n*Exported ${exportedOn} · ${sorted.length} ${sorted.length === 1 ? 'entry' : 'entries'}*\n\n---\n\n`;
    const body = sorted.map((e) => e.body.trim()).join('\n\n---\n\n');
    const blob = new Blob([header + body + '\n'], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (project.name || 'project').replace(/[^a-z0-9\-_ ]/gi, '_') + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    showToast(`Exported ${sorted.length} ${sorted.length === 1 ? 'entry' : 'entries'}`, 'success');
  }

  useEffect(() => {
    let dragging = false;
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const sidebarWidth = document.querySelector('.sidebar')?.clientWidth || 260;
      const total = window.innerWidth - sidebarWidth;
      const x = e.clientX - sidebarWidth;
      const frac = Math.max(0.2, Math.min(0.8, x / total));
      const split = splitRef.current;
      if (split) split.style.gridTemplateColumns = `${frac}fr 6px ${1 - frac}fr`;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    const onDown = () => {
      dragging = true;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };
    const divider = document.getElementById('divider');
    divider?.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      divider?.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [loading]);

  useEffect(() => {
    const text = activeEntry?.body || '';
    const trimmed = text.trim();
    setCounts({
      words: trimmed ? trimmed.split(/\s+/).length : 0,
      chars: text.length,
      line: 1, col: 1,
    });
  }, [activeEntry?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="loading">loading project…</div>;
  if (!project) return <div className="loading">project not found</div>;

  return (
    <div className="journal-shell">
      <aside className="sidebar">
        <div className="sidebar-back">
          <button className="back-btn" onClick={() => router.push('/')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Dashboard
          </button>
        </div>

        <div className="sidebar-project">
          <button
            className={'sidebar-project-cover accent-' + project.color}
            title="Change cover image"
            onClick={() => {
              if (!apiKey) {
                showToast('Add a CDN key in Settings first', 'error');
                setSettingsOpen(true);
                return;
              }
              const inp = document.getElementById('cover-uploader') as HTMLInputElement | null;
              inp?.click();
            }}
          >
            {project.cover_image
              ? <img src={project.cover_image} alt="" />
              : <span className="cover-placeholder">cover</span>}
          </button>
          <input
            id="cover-uploader"
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.currentTarget.files?.[0];
              if (!f) return;
              try {
                const fd = new FormData();
                fd.append('file', f);
                const res = await fetch('/api/cdn/upload', {
                  method: 'POST',
                  headers: { Authorization: 'Bearer ' + apiKey },
                  body: fd,
                });
                if (!res.ok) throw new Error('Upload failed');
                const data = await res.json();
                setProject({ ...project, cover_image: data.url });
                await apiUpdateProject(project.id, { cover_image: data.url });
                showToast('Cover updated', 'success');
              } catch (err: any) {
                showToast(err.message || 'Upload failed', 'error');
              }
            }}
          />
          <input
            className="sidebar-project-name"
            value={project.name}
            onChange={(e) => setProject({ ...project, name: e.target.value })}
            onBlur={(e) => renameProject(e.target.value.trim() || 'Untitled')}
          />
        </div>

        <button className="new-project-btn" onClick={() => setNewEntryOpen(true)}>
          <span className="plus">+</span> New entry
        </button>

        <div className="entries-list">
          {entries.length === 0 && <div className="sidebar-empty">No entries yet</div>}
          {entries.map((en) => (
            <div
              key={en.id}
              draggable
              className={
                'entry' +
                (en.id === activeEntry?.id ? ' active' : '') +
                (en.pinned ? ' pinned' : '') +
                (en.id === dragId ? ' dragging' : '') +
                (dropTarget?.id === en.id && dragId !== en.id ? ' drop-' + dropTarget.pos : '')
              }
              onClick={() => setActiveEntryId(en.id)}
              onDragStart={(e) => onEntryDragStart(e, en.id)}
              onDragEnd={onEntryDragEnd}
              onDragOver={(e) => onEntryDragOver(e, en.id)}
              onDrop={(e) => onEntryDrop(e, en.id)}
            >
              <span className="entry-grip" title="Drag to reorder" aria-hidden="true">
                <svg width="10" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" />
                  <circle cx="15" cy="6" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="15" cy="18" r="1.6" />
                </svg>
              </span>
              <span className="entry-dot" />
              <span className="entry-name" title={en.title || 'Untitled'}>{en.title || 'Untitled'}</span>
              {(en.kind === 'readme' || en.kind === 'bom') && (
                <span className="entry-tag">{en.kind === 'readme' ? 'README' : 'BOM'}</span>
              )}
              <button
                className="entry-act"
                title={en.pinned ? 'Unpin' : 'Pin to top'}
                onClick={(e) => { e.stopPropagation(); togglePin(en); }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill={en.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 17v5" />
                  <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
                </svg>
              </button>
              <button
                className="entry-del"
                title="Delete entry"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete entry "${en.title || 'Untitled'}"?`)) removeEntry(en.id);
                }}
              >×</button>
            </div>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="footer-btn" onClick={() => setSettingsOpen(true)} title="Settings">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Settings
          </button>
          <button className="footer-btn" onClick={exportProject} title="Export project as .md">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-left">
            {activeEntry ? (
              <input
                className="entry-title"
                placeholder="Untitled entry"
                value={activeEntry.title || ''}
                onChange={(e) => handleTitleChange(e.target.value)}
              />
            ) : (
              <span className="entry-title static">{project.name}</span>
            )}
            <div className="entry-meta">
              {activeEntry
                ? `${project.name} · last edited ${relTime(new Date(activeEntry.updated_at))}`
                : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'} · hardware journal`}
            </div>
          </div>
          <div className="topbar-right">
            {activeEntry && (
              <span className={'save-indicator ' + saveStatus}>
                {saveStatus === 'saving' ? 'saving…' : saveStatus}
              </span>
            )}
            {activeEntry && activeEntry.kind !== 'bom' && (
              <button
                className="ghost-btn"
                onClick={() => {
                  if (!apiKey) {
                    showToast('Add a CDN key in Settings first', 'error');
                    setSettingsOpen(true);
                    return;
                  }
                  const input = document.querySelector('.editor-pane input[type="file"]') as HTMLInputElement | null;
                  input?.click();
                }}
                title="Upload image"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                Image
              </button>
            )}
            {activeEntry && (
              <button className="ghost-btn" onClick={() => setPreviewVisible((v) => !v)} title="Toggle preview">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                Preview
              </button>
            )}
            {!guest && (
              <button
                className={'ghost-btn' + (project.is_public ? ' is-public' : '')}
                onClick={() => setShareOpen(true)}
                title={project.is_public ? 'Public — manage sharing' : 'Share publicly'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                {project.is_public ? 'Public' : 'Share'}
              </button>
            )}
            {user && <UserMenu user={user} />}
          </div>
        </header>

        {activeEntry ? (
          <section
            ref={splitRef as any}
            className={'split' + (previewVisible ? '' : ' no-preview')}
          >
            {activeEntry.kind === 'bom' ? (
              <BomEditor
                key={activeEntry.id}
                entryId={activeEntry.id}
                title={activeEntry.title}
                initialBody={activeEntry.body}
                onChange={handleBodyChange}
                onToast={showToast}
              />
            ) : (
              <EditorPane
                ref={editorHandle}
                entryId={activeEntry.id}
                initialBody={activeEntry.body}
                onChange={handleBodyChange}
                onSelectionChange={handleSelectionChange}
                apiKey={apiKey}
                onToast={showToast}
                onRequestApiKey={() => setSettingsOpen(true)}
              />
            )}
            <div id="divider" className="divider" />
            <Preview source={activeEntry.body} />
          </section>
        ) : (
          <NoEntries project={project} onNew={() => setNewEntryOpen(true)} />
        )}

        <footer className="statusbar">
          <span>{counts.words} {counts.words === 1 ? 'word' : 'words'}</span>
          <span className="dot">·</span>
          <span>{counts.chars} chars</span>
          <span className="dot">·</span>
          <span>L{counts.line}:C{counts.col}</span>
          <span className="status-spacer" />
          <button className="ghost-btn danger" onClick={deleteProject} style={{ marginRight: 12 }}>Delete project</button>
          <span className="hint">
            Type <kbd>/</kbd> for commands · <kbd>⌘</kbd><kbd>B</kbd> bold · <kbd>⌘</kbd><kbd>I</kbd> italic · <kbd>⌘</kbd><kbd>K</kbd> link · <kbd>⌘</kbd><kbd>U</kbd> image
          </span>
        </footer>
      </main>

      <NewEntryModal
        open={newEntryOpen}
        hasReadme={entries.some((e) => e.kind === 'readme')}
        onClose={() => setNewEntryOpen(false)}
        onPick={createEntryOfKind}
      />

      <SettingsModal
        open={settingsOpen}
        initialKey={apiKey}
        onClose={() => setSettingsOpen(false)}
        onSave={async (k) => { await saveCdnKey(k); setApiKeyState(k); }}
        onToast={showToast}
      />

      <ShareModal
        open={shareOpen}
        projectId={project.id}
        isPublic={project.is_public}
        onClose={() => setShareOpen(false)}
        onToggle={async (next) => {
          try {
            const { project: updated } = await apiUpdateProject(project.id, { is_public: next });
            setProject({ ...project, is_public: updated.is_public });
            showToast(next ? 'Project is now public' : 'Project is now private', 'success');
          } catch (e: any) {
            showToast(e.message || 'Failed to update sharing', 'error');
          }
        }}
        onToast={showToast}
      />

      {toast && <div className={'toast' + (toast.type ? ' ' + toast.type : '')}>{toast.msg}</div>}
    </div>
  );
}

function NoEntries({ project, onNew }: { project: Project; onNew: () => void }) {
  return (
    <div className="no-entries-pane">
      <div className="no-entries-card">
        <div className={'no-entries-orb accent-' + project.color}>
          {project.cover_image ? (
            <img src={project.cover_image} alt="" />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          )}
        </div>
        <h2 className="no-entries-title">Your build log starts here.</h2>
        <p className="no-entries-text">
          Document <strong>{project.name}</strong> day by day. Photos, BOMs, pinouts and code, all in markdown.
        </p>
        <button className="primary-btn no-entries-cta" onClick={onNew}>
          <span style={{ marginRight: 6 }}>+</span> Create first entry
        </button>
        <div className="no-entries-features">
          <div className="feature"><kbd>/</kbd> Slash commands</div>
          <div className="feature"><kbd>⌘U</kbd> Photo uploads</div>
          <div className="feature"><kbd>⌘B</kbd> Markdown shortcuts</div>
        </div>
      </div>
    </div>
  );
}
