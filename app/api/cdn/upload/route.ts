import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CDN_BASE_URL = process.env.CDN_BASE_URL || 'https://cdn.aaravj.tech';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth) {
    return NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 });
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 });
  }

  const file = incoming.get('file');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }

  const outgoing = new FormData();
  const name = (file as { name?: string }).name || 'upload';
  outgoing.append('file', file, name);

  const upstream = await fetch(`${CDN_BASE_URL}/api/upload`, {
    method: 'POST',
    headers: { Authorization: auth },
    body: outgoing,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') || 'application/json' },
  });
}
