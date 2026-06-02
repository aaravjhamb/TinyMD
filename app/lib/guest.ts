import type { Entry, EntryKind, Project, ProjectWithCounts, User } from './types';

const FLAG_KEY = 'tinymd.guest.enabled';
const DATA_KEY = 'tinymd.guest.v1';

type GuestData = {
  cdn_api_key: string | null;
  projects: Project[];
  entries: Record<string, Entry[]>;
};

const EMPTY: GuestData = { cdn_api_key: null, projects: [], entries: {} };

export const GUEST_USER: User = {
  id: 'guest',
  email: null,
  first_name: 'Guest',
  last_name: null,
  slack_id: null,
  cdn_api_key: null,
};

function ls(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function load(): GuestData {
  const s = ls();
  if (!s) return { ...EMPTY };
  const raw = s.getItem(DATA_KEY);
  if (!raw) return { ...EMPTY };
  try {
    const parsed = JSON.parse(raw);
    const projects: Project[] = Array.isArray(parsed.projects)
      ? parsed.projects.map((p: Project) => ({ ...p, is_public: !!p.is_public }))
      : [];
    const entries: Record<string, Entry[]> = {};
    if (parsed.entries && typeof parsed.entries === 'object') {
      for (const key of Object.keys(parsed.entries)) {
        const list = parsed.entries[key];
        if (Array.isArray(list)) entries[key] = list.map((e, i) => normalizeEntry(e, i));
      }
    }
    return {
      cdn_api_key: parsed.cdn_api_key ?? null,
      projects,
      entries,
    };
  } catch {
    return { ...EMPTY };
  }
}

function save(data: GuestData): void {
  const s = ls();
  if (!s) return;
  s.setItem(DATA_KEY, JSON.stringify(data));
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowISO(): string {
  return new Date().toISOString();
}

function normalizeEntry(e: Entry, index = 0): Entry {
  return {
    ...e,
    kind: e.kind ?? 'journal',
    pinned: !!e.pinned,
    position: typeof e.position === 'number' ? e.position : index,
  };
}

function sortGuestEntries(list: Entry[]): Entry[] {
  return [...list].sort(
    (a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      a.position - b.position ||
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}

export function isGuestMode(): boolean {
  const s = ls();
  return !!s && s.getItem(FLAG_KEY) === '1';
}

export function enableGuestMode(): void {
  const s = ls();
  if (!s) return;
  s.setItem(FLAG_KEY, '1');
}

export function disableGuestMode(): void {
  const s = ls();
  if (!s) return;
  s.removeItem(FLAG_KEY);
  s.removeItem(DATA_KEY);
}

export async function getMe(): Promise<{ user: User | null }> {
  const data = load();
  return { user: { ...GUEST_USER, cdn_api_key: data.cdn_api_key } };
}

export async function listProjects(): Promise<{ projects: ProjectWithCounts[] }> {
  const data = load();
  const projects = data.projects.map((p) => {
    const entries = data.entries[p.id] || [];
    const sorted = [...entries].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const last = sorted[0];
    return {
      ...p,
      entry_count: entries.length,
      last_entry_at: last ? last.updated_at : null,
      last_entry_title: last ? last.title : null,
    };
  });
  projects.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return { projects };
}

export async function createProject(body: {
  name: string;
  color?: string;
  cover_image?: string | null;
}): Promise<{ project: Project }> {
  const data = load();
  const now = nowISO();
  const project: Project = {
    id: uid(),
    name: body.name,
    color: body.color || 'red',
    cover_image: body.cover_image ?? null,
    is_public: false,
    created_at: now,
    updated_at: now,
  };
  data.projects.unshift(project);
  data.entries[project.id] = [];
  save(data);
  return { project };
}

export async function getProject(id: string): Promise<{ project: Project; entries: Entry[] }> {
  const data = load();
  const project = data.projects.find((p) => p.id === id);
  if (!project) throw new Error('Project not found');
  const entries = sortGuestEntries(data.entries[id] || []);
  return { project, entries };
}

export async function updateProject(
  id: string,
  body: Partial<{ name: string; color: string; cover_image: string | null; is_public: boolean }>
): Promise<{ project: Project }> {
  const data = load();
  const idx = data.projects.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Project not found');
  const merged: Project = { ...data.projects[idx], ...body, updated_at: nowISO() };
  data.projects[idx] = merged;
  save(data);
  return { project: merged };
}

export async function deleteProject(id: string): Promise<{ ok: true }> {
  const data = load();
  data.projects = data.projects.filter((p) => p.id !== id);
  delete data.entries[id];
  save(data);
  return { ok: true };
}

export async function createEntry(
  projectId: string,
  body: { title?: string; body?: string; kind?: EntryKind; pinned?: boolean }
): Promise<{ entry: Entry }> {
  const data = load();
  if (!data.projects.find((p) => p.id === projectId)) throw new Error('Project not found');
  const now = nowISO();
  const kind = body.kind ?? 'journal';
  const existing = data.entries[projectId] || [];
  const minPos = existing.reduce((m, e) => Math.min(m, e.position ?? 0), 0);
  const entry: Entry = {
    id: uid(),
    title: body.title || 'Untitled',
    body: body.body || '',
    kind,
    pinned: body.pinned ?? kind === 'readme',
    position: minPos - 1,
    created_at: now,
    updated_at: now,
  };
  data.entries[projectId] = sortGuestEntries([entry, ...existing]);
  const pIdx = data.projects.findIndex((p) => p.id === projectId);
  if (pIdx !== -1) data.projects[pIdx] = { ...data.projects[pIdx], updated_at: now };
  save(data);
  return { entry };
}

function findEntry(data: GuestData, id: string): { projectId: string; index: number } | null {
  for (const projectId of Object.keys(data.entries)) {
    const idx = data.entries[projectId].findIndex((e) => e.id === id);
    if (idx !== -1) return { projectId, index: idx };
  }
  return null;
}

export async function updateEntry(
  id: string,
  body: Partial<{ title: string; body: string }>
): Promise<{ entry: Entry }> {
  const data = load();
  const found = findEntry(data, id);
  if (!found) throw new Error('Entry not found');
  const existing = data.entries[found.projectId][found.index];
  const merged: Entry = { ...existing, ...body, updated_at: nowISO() };
  data.entries[found.projectId][found.index] = merged;
  const pIdx = data.projects.findIndex((p) => p.id === found.projectId);
  if (pIdx !== -1) data.projects[pIdx] = { ...data.projects[pIdx], updated_at: merged.updated_at };
  save(data);
  return { entry: merged };
}

export async function deleteEntry(id: string): Promise<{ ok: true }> {
  const data = load();
  const found = findEntry(data, id);
  if (!found) return { ok: true };
  data.entries[found.projectId].splice(found.index, 1);
  save(data);
  return { ok: true };
}

export async function reorderEntries(projectId: string, order: string[]): Promise<{ ok: true }> {
  const data = load();
  const list = data.entries[projectId];
  if (!list) return { ok: true };
  const rank = new Map(order.map((id, i) => [id, i]));
  for (const e of list) {
    const pos = rank.get(e.id);
    if (pos !== undefined) e.position = pos;
  }
  data.entries[projectId] = sortGuestEntries(list);
  save(data);
  return { ok: true };
}

export async function saveCdnKey(key: string): Promise<{ cdn_api_key: string | null }> {
  const data = load();
  const value = key.trim() === '' ? null : key.trim();
  data.cdn_api_key = value;
  save(data);
  return { cdn_api_key: value };
}
