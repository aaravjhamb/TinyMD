import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '../../../lib/auth';
import { query } from '../../../lib/db';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { key?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = typeof body.key === 'string' ? body.key.trim() : '';
  const value = raw === '' ? null : raw;

  await query('UPDATE users SET cdn_api_key = $1, updated_at = NOW() WHERE id = $2', [value, user.id]);

  return NextResponse.json({ cdn_api_key: value });
}
