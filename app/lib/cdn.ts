const BASE = '/api/cdn';

export type CdnUpload = {
  id: string;
  filename: string;
  size: number;
  content_type: string;
  url: string;
  created_at: string;
};

export type CdnMe = {
  id: string;
  email: string;
  name: string;
  storage_used: number;
  storage_limit: number;
  quota_tier: 'unverified' | 'verified' | 'functionally_unlimited' | string;
};

export async function uploadFile(file: File, apiKey: string): Promise<CdnUpload> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err.error || `Upload failed (${res.status})`);
  }
  return (await res.json()) as CdnUpload;
}

export async function getMe(apiKey: string): Promise<CdnMe> {
  const res = await fetch(`${BASE}/me`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as any));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as CdnMe;
}
