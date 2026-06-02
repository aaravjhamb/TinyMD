import { notFound } from 'next/navigation';
import { many, one } from '../../lib/db';
import PublicEntries from './PublicEntries';
import type { Entry, Project } from '../../lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RawProject = Omit<Project, 'is_public' | 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};
type RawEntry = Omit<Entry, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export default async function PublicProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const project = await one<RawProject>(
    `SELECT id, name, color, cover_image, created_at, updated_at
       FROM projects WHERE id = $1 AND is_public = true`,
    [id]
  );
  if (!project) notFound();

  const entries = await many<RawEntry>(
    `SELECT id, title, body, kind, pinned, position, created_at, updated_at
       FROM entries WHERE project_id = $1
      ORDER BY pinned DESC, created_at ASC`,
    [id]
  );

  const updated = new Date(project.updated_at).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  });

  return (
    <div className="public-page">
      <header className="public-header">
        <a href="/" className="public-back">← TinyMD</a>
        <div className="public-title-wrap">
          <h1 className={'public-title accent-' + project.color}>{project.name}</h1>
          <div className="public-meta">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · Updated {updated}
          </div>
        </div>
        {project.cover_image && (
          <div className="public-cover">
            <img src={project.cover_image} alt="" />
          </div>
        )}
      </header>

      <main className="public-main">
        {entries.length === 0 ? (
          <p className="public-empty">No entries yet.</p>
        ) : (
          <PublicEntries
            entries={entries.map((e) => ({
              ...e,
              created_at: new Date(e.created_at).toISOString(),
              updated_at: new Date(e.updated_at).toISOString(),
            }))}
          />
        )}
      </main>

      <footer className="public-footer">
        <a href="/">Make your own at TinyMD</a>
      </footer>
    </div>
  );
}
