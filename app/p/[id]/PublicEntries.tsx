'use client';

import Preview from '../../components/Preview';
import type { Entry } from '../../lib/types';

// Fixed locale + UTC so server and client render identical text (no hydration mismatch).
function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

export default function PublicEntries({ entries }: { entries: Entry[] }) {
  return (
    <div className="public-entries">
      {entries.map((e) => (
        <article key={e.id} className="public-entry">
          <header className="public-entry-head">
            <time className="public-entry-date" dateTime={e.created_at}>
              {formatEntryDate(e.created_at)}
            </time>
            <h2 className="public-entry-title">
              {e.title || 'Untitled'}
              {(e.kind === 'readme' || e.kind === 'bom') && (
                <span className="public-entry-badge">{e.kind === 'readme' ? 'README' : 'BOM'}</span>
              )}
            </h2>
          </header>
          <div className="public-entry-body">
            <Preview source={e.body} />
          </div>
        </article>
      ))}
    </div>
  );
}
