import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { many, one } from '../../../../lib/db';
import { requireUser } from '../../../../lib/auth';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;

  const entries = await many(
    `SELECT id, title, body, created_at, updated_at
       FROM entries WHERE project_id = $1 AND user_id = $2
      ORDER BY created_at DESC`,
    [id, user.id]
  );

  return NextResponse.json({ entries });
}

export async function POST(req: NextRequest, ctx: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: projectId } = await ctx.params;

  const proj = await one('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, user.id]);
  if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const title = (typeof body.title === 'string' && body.title.trim()) || 'Untitled';
  const content = typeof body.body === 'string' ? body.body : '';
  const id = crypto.randomUUID();

  const entry = await one(
    `INSERT INTO entries (id, project_id, user_id, title, body)
       VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, body, created_at, updated_at`,
    [id, projectId, user.id, title, content]
  );

  return NextResponse.json({ entry });
}
