import { NextRequest, NextResponse } from 'next/server';
import { many, one, query } from '../../../lib/db';
import { requireUser } from '../../../lib/auth';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;

  const project = await one(
    `SELECT id, name, color, cover_image, is_public, created_at, updated_at
       FROM projects WHERE id = $1 AND user_id = $2`,
    [id, user.id]
  );
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entries = await many(
    `SELECT id, title, body, kind, pinned, created_at, updated_at
       FROM entries WHERE project_id = $1 AND user_id = $2
      ORDER BY pinned DESC, created_at DESC`,
    [id, user.id]
  );

  return NextResponse.json({ project, entries });
}

export async function PATCH(req: NextRequest, ctx: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;
  if (typeof body.name === 'string') { fields.push(`name = $${i++}`); values.push(body.name.trim() || 'Untitled'); }
  if (typeof body.color === 'string') { fields.push(`color = $${i++}`); values.push(body.color); }
  if (typeof body.cover_image === 'string' || body.cover_image === null) { fields.push(`cover_image = $${i++}`); values.push(body.cover_image); }
  if (typeof body.is_public === 'boolean') { fields.push(`is_public = $${i++}`); values.push(body.is_public); }
  if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });

  fields.push(`updated_at = NOW()`);
  values.push(id, user.id);

  const project = await one(
    `UPDATE projects SET ${fields.join(', ')}
      WHERE id = $${i++} AND user_id = $${i}
    RETURNING id, name, color, cover_image, is_public, created_at, updated_at`,
    values
  );
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ project });
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;

  const res = await query(
    'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, user.id]
  );
  if (!res.rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
