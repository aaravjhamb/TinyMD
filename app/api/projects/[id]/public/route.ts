import { NextRequest, NextResponse } from 'next/server';
import { many, one } from '../../../../lib/db';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;

  const project = await one(
    `SELECT id, name, color, cover_image, created_at, updated_at
       FROM projects WHERE id = $1 AND is_public = true`,
    [id]
  );
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const entries = await many(
    `SELECT id, title, body, created_at, updated_at
       FROM entries WHERE project_id = $1
      ORDER BY created_at ASC`,
    [id]
  );

  return NextResponse.json({ project, entries });
}
