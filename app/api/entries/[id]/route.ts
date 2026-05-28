import { NextRequest, NextResponse } from 'next/server';
import { one, query } from '../../../lib/db';
import { requireUser } from '../../../lib/auth';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: any[] = [];
  let i = 1;
  if (typeof body.title === 'string') { fields.push(`title = $${i++}`); values.push(body.title.trim() || 'Untitled'); }
  if (typeof body.body === 'string')  { fields.push(`body = $${i++}`); values.push(body.body); }
  if (!fields.length) return NextResponse.json({ error: 'No fields' }, { status: 400 });
  fields.push(`updated_at = NOW()`);
  values.push(id, user.id);

  const entry = await one(
    `UPDATE entries SET ${fields.join(', ')}
      WHERE id = $${i++} AND user_id = $${i}
    RETURNING id, project_id, title, body, created_at, updated_at`,
    values
  );
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ entry });
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await ctx.params;
  const res = await query('DELETE FROM entries WHERE id = $1 AND user_id = $2 RETURNING id', [id, user.id]);
  if (!res.rowCount) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
