'use client';

import { useEffect } from 'react';
import type { EntryKind } from '../lib/types';

type Props = {
  open: boolean;
  hasReadme: boolean;
  onClose: () => void;
  onPick: (kind: EntryKind) => void;
};

export default function NewEntryModal({ open, hasReadme, onClose, onPick }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">New entry</div>
          <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="entry-type-list">
            <button className="entry-type" onClick={() => onPick('journal')}>
              <span className="entry-type-icon">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </span>
              <span className="entry-type-text">
                <span className="entry-type-title">Journal entry</span>
                <span className="entry-type-desc">A dated build-log entry. Document the day’s progress.</span>
              </span>
            </button>

            <button
              className="entry-type"
              onClick={() => onPick('readme')}
              disabled={hasReadme}
            >
              <span className="entry-type-icon">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" />
                  <line x1="8" y1="17" x2="13" y2="17" />
                </svg>
              </span>
              <span className="entry-type-text">
                <span className="entry-type-title">
                  README
                  <span className="entry-type-pill">Pinned</span>
                </span>
                <span className="entry-type-desc">
                  {hasReadme
                    ? 'This project already has a README.'
                    : 'A project overview, pinned to the top of the list.'}
                </span>
              </span>
            </button>

            <button className="entry-type" onClick={() => onPick('bom')}>
              <span className="entry-type-icon">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="3" y1="15" x2="21" y2="15" />
                  <line x1="12" y1="3" x2="12" y2="21" />
                </svg>
              </span>
              <span className="entry-type-text">
                <span className="entry-type-title">Bill of materials</span>
                <span className="entry-type-desc">A parts table — quantities, sources and cost.</span>
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
