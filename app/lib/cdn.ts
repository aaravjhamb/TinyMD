const BASE = '/api/cdn';

export type CdnUpload = {
  url: string;
  uuid: string;
  filename: string;
  mimetype: string;
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
