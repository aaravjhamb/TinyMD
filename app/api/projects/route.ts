import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { many, one } from '../../lib/db';
import { requireUser } from '../../lib/auth';

export const runtime = 'nodejs';

const COLORS = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'] as const;

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const rows = await many<{
    id: string;
    name: string;
    color: string;
    cover_image: string | null;
    created_at: Date;
    updated_at: Date;
    entry_count: string;
    last_entry_at: Date | null;
    last_entry_title: string | null;
  }>(
    `SELECT p.id, p.name, p.color, p.cover_image, p.created_at, p.updated_at,
            COUNT(e.id)::int AS entry_count,
            MAX(e.updated_at) AS last_entry_at,
            (SELECT title FROM entries e2
              WHERE e2.project_id = p.id
              ORDER BY e2.updated_at DESC LIMIT 1) AS last_entry_title
       FROM projects p
       LEFT JOIN entries e ON e.project_id = p.id
      WHERE p.user_id = $1
      GROUP BY p.id
      ORDER BY COALESCE(MAX(e.updated_at), p.updated_at) DESC`,
    [user.id]
  );

  return NextResponse.json({ projects: rows });
}

export async function POST(req: NextRequest) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;

  const body = await req.json().catch(() => ({}));
  const name = (typeof body.name === 'string' && body.name.trim()) || 'New project';
  const color = COLORS.includes(body.color) ? body.color : COLORS[Math.floor(Math.random() * COLORS.length)];
  const cover = typeof body.cover_image === 'string' ? body.cover_image : null;
  const id = crypto.randomUUID();

  const project = await one(
    `INSERT INTO projects (id, user_id, name, color, cover_image)
       VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, color, cover_image, created_at, updated_at`,
    [id, user.id, name, color, cover]
  );

  return NextResponse.json({ project });
}
