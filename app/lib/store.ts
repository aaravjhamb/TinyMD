import * as api from './api';
import * as guest from './guest';
import type { Entry, EntryKind, Project, ProjectWithCounts, User } from './types';

export { isGuestMode, enableGuestMode, disableGuestMode } from './guest';
export { ApiError } from './api';

export function getMe(): Promise<{ user: User | null }> {
  return guest.isGuestMode() ? guest.getMe() : api.getMe();
}

export function listProjects(): Promise<{ projects: ProjectWithCounts[] }> {
  return guest.isGuestMode() ? guest.listProjects() : api.listProjects();
}

export function createProject(body: {
  name: string;
  color?: string;
  cover_image?: string | null;
}): Promise<{ project: Project }> {
  return guest.isGuestMode() ? guest.createProject(body) : api.createProject(body);
}

export function getProject(id: string): Promise<{ project: Project; entries: Entry[] }> {
  return guest.isGuestMode() ? guest.getProject(id) : api.getProject(id);
}

export function updateProject(
  id: string,
  body: Partial<{ name: string; color: string; cover_image: string | null; is_public: boolean }>
): Promise<{ project: Project }> {
  return guest.isGuestMode() ? guest.updateProject(id, body) : api.updateProject(id, body);
}

export function deleteProject(id: string): Promise<{ ok: true }> {
  return guest.isGuestMode() ? guest.deleteProject(id) : api.deleteProject(id);
}

export function createEntry(
  projectId: string,
  body: { title?: string; body?: string; kind?: EntryKind; pinned?: boolean }
): Promise<{ entry: Entry }> {
  return guest.isGuestMode() ? guest.createEntry(projectId, body) : api.createEntry(projectId, body);
}

export function updateEntry(
  id: string,
  body: Partial<{ title: string; body: string; pinned: boolean; kind: EntryKind }>
): Promise<{ entry: Entry }> {
  return guest.isGuestMode() ? guest.updateEntry(id, body) : api.updateEntry(id, body);
}

export function deleteEntry(id: string): Promise<{ ok: true }> {
  return guest.isGuestMode() ? guest.deleteEntry(id) : api.deleteEntry(id);
}

export function saveCdnKey(key: string): Promise<{ cdn_api_key: string | null }> {
  return guest.isGuestMode() ? guest.saveCdnKey(key) : api.saveCdnKey(key);
}
