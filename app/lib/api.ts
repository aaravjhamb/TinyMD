import type { Entry, EntryKind, Project, ProjectWithCounts, User } from './types';

async function req<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  if (res.status === 401) {
    throw new ApiError('Unauthorized', 401);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.error || `HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

export class ApiError extends Error {
  status: number;
  constructor(msg: string, status: number) { super(msg); this.status = status; }
}

export async function getMe(): Promise<{ user: User | null }> {
  return req('/api/auth/me');
}

export async function listProjects(): Promise<{ projects: ProjectWithCounts[] }> {
  return req('/api/projects');
}

export async function createProject(body: { name: string; color?: string; cover_image?: string | null }): Promise<{ project: Project }> {
  return req('/api/projects', { method: 'POST', body: JSON.stringify(body) });
}

export async function getProject(id: string): Promise<{ project: Project; entries: Entry[] }> {
  return req(`/api/projects/${id}`);
}

export async function updateProject(id: string, body: Partial<{ name: string; color: string; cover_image: string | null; is_public: boolean }>): Promise<{ project: Project }> {
  return req(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteProject(id: string): Promise<{ ok: true }> {
  return req(`/api/projects/${id}`, { method: 'DELETE' });
}

export async function createEntry(projectId: string, body: { title?: string; body?: string; kind?: EntryKind; pinned?: boolean }): Promise<{ entry: Entry }> {
  return req(`/api/projects/${projectId}/entries`, { method: 'POST', body: JSON.stringify(body) });
}

export async function updateEntry(id: string, body: Partial<{ title: string; body: string; pinned: boolean; kind: EntryKind }>): Promise<{ entry: Entry }> {
  return req(`/api/entries/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function deleteEntry(id: string): Promise<{ ok: true }> {
  return req(`/api/entries/${id}`, { method: 'DELETE' });
}

export async function reorderEntries(projectId: string, order: string[]): Promise<{ ok: true }> {
  return req(`/api/projects/${projectId}/entries`, { method: 'PATCH', body: JSON.stringify({ order }) });
}

export async function saveCdnKey(key: string): Promise<{ cdn_api_key: string | null }> {
  return req('/api/me/cdn-key', { method: 'PUT', body: JSON.stringify({ key }) });
}
