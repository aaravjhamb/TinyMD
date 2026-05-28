'use client';

import { useEffect, useState } from 'react';

type Props = {
  open: boolean;
  projectId: string;
  isPublic: boolean;
  onClose: () => void;
  onToggle: (next: boolean) => Promise<void> | void;
  onToast: (msg: string, type?: 'success' | 'error') => void;
};

export default function ShareModal({ open, projectId, isPublic, onClose, onToggle, onToast }: Props) {
  const [busy, setBusy] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

  useEffect(() => {
    if (open && typeof window !== 'undefined') {
      setShareUrl(`${window.location.origin}/p/${projectId}`);
    }
  }, [open, projectId]);

  if (!open) return null;

  async function flip() {
    setBusy(true);
    try {
      await onToggle(!isPublic);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      onToast('Link copied', 'success');
    } catch {
      onToast('Copy failed — select and copy manually', 'error');
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">Share project</div>
          <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="share-toggle-row">
            <div className="share-toggle-text">
              <div className="share-toggle-title">{isPublic ? 'Public on the web' : 'Private'}</div>
              <div className="share-toggle-sub">
                {isPublic
                  ? 'Anyone with the link can read this project and all its entries.'
                  : 'Only you can see this project.'}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPublic}
              className={'share-switch' + (isPublic ? ' on' : '')}
              onClick={flip}
              disabled={busy}
            >
              <span className="share-switch-thumb" />
            </button>
          </div>

          {isPublic && (
            <label className="field">
              <span>Public link</span>
              <div className="share-link-row">
                <input readOnly value={shareUrl} onFocus={(e) => e.currentTarget.select()} />
                <button className="ghost-btn" type="button" onClick={copy}>Copy</button>
              </div>
              <small>
                <a href={shareUrl} target="_blank" rel="noopener noreferrer">Open in a new tab →</a>
              </small>
            </label>
          )}

          <div className="modal-actions">
            <button className="primary-btn" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
