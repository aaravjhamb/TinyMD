import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { many, one, query } from '../../../../lib/db';
import { requireUser } from '../../../../lib/auth';

export const runtime = 'nodejs';

const KINDS = new Set(['journal', 'readme', 'bom']);

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;

  const entries = await many(
    `SELECT id, title, body, kind, pinned, position, created_at, updated_at
       FROM entries WHERE project_id = $1 AND user_id = $2
      ORDER BY pinned DESC, position ASC, created_at DESC`,
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
  const kind = KINDS.has(body.kind) ? body.kind : 'journal';
  const pinned = typeof body.pinned === 'boolean' ? body.pinned : kind === 'readme';
  const id = crypto.randomUUID();

  // New entries go to the top of the list.
  const top = await one<{ min: number | null }>(
    'SELECT MIN(position) AS min FROM entries WHERE project_id = $1 AND user_id = $2',
    [projectId, user.id]
  );
  const position = (top?.min ?? 0) - 1;

  const entry = await one(
    `INSERT INTO entries (id, project_id, user_id, title, body, kind, pinned, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, title, body, kind, pinned, position, created_at, updated_at`,
    [id, projectId, user.id, title, content, kind, pinned, position]
  );

  return NextResponse.json({ entry });
}

export async function PATCH(req: NextRequest, ctx: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id: projectId } = await ctx.params;

  const proj = await one('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, user.id]);
  if (!proj) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const order: string[] | null = Array.isArray(body.order)
    ? body.order.filter((x: unknown): x is string => typeof x === 'string')
    : null;
  if (!order || !order.length) return NextResponse.json({ error: 'order required' }, { status: 400 });

  const positions = order.map((_, i) => i);
  await query(
    `UPDATE entries AS e SET position = v.pos
       FROM unnest($1::text[], $2::int[]) AS v(id, pos)
      WHERE e.id = v.id AND e.project_id = $3 AND e.user_id = $4`,
    [order, positions, projectId, user.id]
  );

  return NextResponse.json({ ok: true });
}
