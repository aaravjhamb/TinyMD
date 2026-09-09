'use client';

import { useEffect, useState } from 'react';
import { PAGE_SIZES, pageSizeById, type PageSizeId, type PdfOptions } from '../lib/pdf';

type Props = {
  open: boolean;
  entryCount: number;
  onClose: () => void;
  onExport: (opts: PdfOptions) => Promise<void> | void;
};

export default function ExportPdfModal({ open, entryCount, onClose, onExport }: Props) {
  const [size, setSize] = useState<PageSizeId>('a4');
  const [coverPage, setCoverPage] = useState(true);
  const [entryTitles, setEntryTitles] = useState(true);
  const [pageBreaks, setPageBreaks] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const picked = pageSizeById(size);

  // Draw each preview at its true proportions, normalised so the longest side
  // is the same for every option.
  const shapeStyle = (w: number, h: number) => {
    const long = 34;
    const scale = long / Math.max(w, h);
    return { width: `${Math.round(w * scale)}px`, height: `${Math.round(h * scale)}px` };
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}
    >
      <div className="modal modal-wide">
        <div className="modal-head">
          <div className="modal-title">Export PDF</div>
          <button className="modal-close" aria-label="Close" onClick={onClose} disabled={busy}>×</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <span>Aspect ratio</span>
            <div className="pdf-size-grid" role="radiogroup" aria-label="Page aspect ratio">
              {PAGE_SIZES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={size === p.id}
                  className={'pdf-size' + (size === p.id ? ' selected' : '')}
                  onClick={() => setSize(p.id)}
                  disabled={busy}
                >
                  <span className="pdf-size-frame" aria-hidden="true">
                    <span className="pdf-size-shape" style={shapeStyle(p.width, p.height)} />
                  </span>
                  <span className="pdf-size-label">{p.label}</span>
                  <span className="pdf-size-note">{p.note}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <span>Include</span>
            <label className="pdf-check">
              <input type="checkbox" checked={coverPage} disabled={busy} onChange={(e) => setCoverPage(e.target.checked)} />
              <span>Cover page with contents</span>
            </label>
            <label className="pdf-check">
              <input type="checkbox" checked={entryTitles} disabled={busy} onChange={(e) => setEntryTitles(e.target.checked)} />
              <span>Entry titles and dates</span>
            </label>
            <label className="pdf-check">
              <input type="checkbox" checked={pageBreaks} disabled={busy} onChange={(e) => setPageBreaks(e.target.checked)} />
              <span>Start each entry on a new page</span>
            </label>
          </div>

          <p className="pdf-hint">
            {entryCount} {entryCount === 1 ? 'entry' : 'entries'} at {picked.width} × {picked.height} mm.
            Your browser&rsquo;s print dialog opens next — choose <strong>Save as PDF</strong> as the
            destination, and leave margins on Default.
          </p>

          <div className="modal-actions">
            <button className="ghost-btn" onClick={onClose} disabled={busy}>Cancel</button>
            <button
              className="primary-btn"
              disabled={busy || entryCount === 0}
              onClick={async () => {
                setBusy(true);
                try {
                  await onExport({ size, coverPage, entryTitles, pageBreaks });
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? 'Preparing…' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
