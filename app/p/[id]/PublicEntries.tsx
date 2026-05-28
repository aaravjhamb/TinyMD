'use client';

import Preview from '../../components/Preview';
import type { Entry } from '../../lib/types';

export default function PublicEntries({ entries }: { entries: Entry[] }) {
  return (
    <div className="public-entries">
      {entries.map((e) => (
        <article key={e.id} className="public-entry">
          <header className="public-entry-head">
            <h2 className="public-entry-title">{e.title || 'Untitled'}</h2>
            <time className="public-entry-date">
              {new Date(e.created_at).toLocaleDateString(undefined, {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </time>
          </header>
          <div className="public-entry-body">
            <Preview source={e.body} />
          </div>
        </article>
      ))}
    </div>
  );
}
